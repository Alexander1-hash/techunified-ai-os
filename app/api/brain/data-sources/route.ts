import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'
import * as XLSX from 'xlsx'

const MAX_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 5000
const allowed = new Set(['csv', 'xlsx'])

function parseCsv(text: string): Record<string, unknown>[] {
  const input = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field.length === 0) {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      if (rows.length > MAX_ROWS + 1) break
    } else {
      field += char
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted field.')
  if (field.length || row.length) {
    row.push(field)
    if (row.some((value) => value.trim() !== '')) rows.push(row)
  }
  if (!rows.length) return []

  const headers = rows[0].map((header) => header.trim())
  if (headers.some((header) => !header)) throw new Error('Every CSV column must have a non-empty header.')
  if (new Set(headers).size !== headers.length) throw new Error('CSV column headers must be unique.')
  if (rows.length - 1 > MAX_ROWS) throw new Error(`This file contains more than the ${MAX_ROWS.toLocaleString()}-row import limit. Split it into smaller files so no records are silently omitted.`)

  return rows.slice(1).map((values) => {
    if (values.length > headers.length) throw new Error('A CSV row contains more values than the header row.')
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

function inspect(rows: Record<string, unknown>[]) {
  const columns = Object.keys(rows[0] ?? {})
  const details = columns.map((name) => {
    const values = rows.map((row) => row[name]).filter((value) => value !== '' && value !== null && value !== undefined)
    const numeric = values.length > 0 && values.every((value) => typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))))
    const dates = values.length > 0 && values.every((value) => !Number.isNaN(Date.parse(String(value))))
    return { name, type: numeric ? 'number' : dates ? 'date' : 'text', missing: rows.length - values.length }
  })
  const seen = new Set<string>()
  let duplicates = 0
  for (const row of rows) { const key = JSON.stringify(row); if (seen.has(key)) duplicates += 1; else seen.add(key) }
  return { columns: details, duplicateRows: duplicates, rowCount: rows.length }
}

export async function GET() {
  const supabase = await createClient()
  const { profile, error: profileError } = await getCurrentProfile(supabase)
  if (profileError || !profile?.organization_id) return NextResponse.json({ error: 'Organization context is required.' }, { status: 401 })
  const { data, error } = await supabase.from('business_data_sources').select('id,name,provider,category,status,configuration_metadata,last_synced_at,created_at,updated_at').eq('organization_id', profile.organization_id).order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Unable to load data sources.' }, { status: 500 })
  return NextResponse.json({ sources: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { profile, error: profileError } = await getCurrentProfile(supabase)
  if (profileError || !profile?.organization_id) return NextResponse.json({ error: 'Organization context is required.' }, { status: 401 })
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > 64 * 1024) {
      return NextResponse.json({ error: 'Integration setup is too large. Keep setup details under 64 KB and never include database passwords or API secrets.' }, { status: 413 })
    }
    const body = await request.json().catch(() => null)
    const provider = typeof body?.provider === 'string' ? body.provider : ''
    const allowedProviders = new Set(['google-sheets', 'postgresql', 'crm', 'accounting', 'analytics'])
    if (!allowedProviders.has(provider)) {
      return NextResponse.json({ error: 'Choose a supported external integration.' }, { status: 400 })
    }
    const setup = body?.setup && typeof body.setup === 'object' && !Array.isArray(body.setup) ? body.setup as Record<string, unknown> : {}
    const clean = (key: string, max = 500) => typeof setup[key] === 'string' ? (setup[key] as string).trim().slice(0, max) : ''
    const name = clean('name', 120)
    if (!name) return NextResponse.json({ error: 'Integration name is required.' }, { status: 400 })
    if (['crm', 'accounting', 'analytics'].includes(provider) && !clean('product', 120)) {
      return NextResponse.json({ error: 'Enter the exact CRM, accounting, or analytics provider.' }, { status: 400 })
    }
    if (provider === 'postgresql') {
      const port = Number(clean('port', 5) || '5432')
      if (!clean('host', 255) || !clean('database', 120) || !clean('username', 120) || !Number.isInteger(port) || port < 1 || port > 65535) {
        return NextResponse.json({ error: 'Enter a valid PostgreSQL host, port, database, and read-only username.' }, { status: 400 })
      }
    }
    const urlFields = provider === 'google-sheets' ? ['spreadsheetUrl'] : ['accountUrl']
    for (const key of urlFields) {
      const value = clean(key, 1000)
      if (!value) continue
      if (key === 'spreadsheetUrl' && !value.includes('://')) {
        if (!/^[A-Za-z0-9_-]{20,200}$/.test(value)) {
          return NextResponse.json({ error: 'Enter a valid Google Sheets URL or spreadsheet ID.' }, { status: 400 })
        }
        continue
      }
      try {
        const parsed = new URL(value)
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error()
      } catch {
        return NextResponse.json({ error: (key === 'spreadsheetUrl' ? 'Spreadsheet URL' : 'Account URL') + ' must be a valid HTTPS URL.' }, { status: 400 })
      }
    }
    const safeSetup: Record<string, string> = {}
    for (const key of ['spreadsheetUrl', 'host', 'port', 'database', 'schema', 'username', 'product', 'accountUrl', 'dataAreas']) {
      const value = clean(key, key === 'dataAreas' ? 2000 : 1000)
      if (value) safeSetup[key] = value
    }
    const payload = {
      organization_id: profile.organization_id,
      name,
      provider,
      category: 'integration',
      status: 'setup_required',
      configuration_metadata: { setup: safeSetup, setup_saved_at: new Date().toISOString(), connection_verified: false },
      last_synced_at: null,
    }
    const { data: existing } = await supabase.from('business_data_sources').select('id').eq('organization_id', profile.organization_id).eq('provider', provider).eq('category', 'integration').order('updated_at', { ascending: false }).limit(1).maybeSingle()
    const query = existing?.id
      ? supabase.from('business_data_sources').update(payload).eq('id', existing.id)
      : supabase.from('business_data_sources').insert(payload)
    const { data, error } = await query.select('id,name,provider,category,status,configuration_metadata,last_synced_at').single()
    if (error || !data) return NextResponse.json({ error: 'Setup details could not be saved. Confirm the Company Brain data-source migration is applied.' }, { status: 500 })
    return NextResponse.json({ source: data, connected: false }, { status: existing?.id ? 200 : 201 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Send a valid multipart form with a CSV or XLSX file.' }, { status: 400 })
  }
  const file = form.get('file')
  const provider = String(form.get('provider') ?? '')
  if (provider === 'supabase') {
    const payload = { organization_id: profile.organization_id, name: 'TechUnified Supabase', provider: 'supabase', category: 'database', status: 'connected', configuration_metadata: { verification: 'server-authenticated', verified_at: new Date().toISOString() }, last_synced_at: new Date().toISOString() }
    const { data: existing } = await supabase.from('business_data_sources').select('id').eq('organization_id', profile.organization_id).eq('provider', 'supabase').maybeSingle()
    const query = existing?.id ? supabase.from('business_data_sources').update(payload).eq('id', existing.id) : supabase.from('business_data_sources').insert(payload)
    const { data, error } = await query.select('id,name,provider,category,status,configuration_metadata,last_synced_at').single()
    if (error) return NextResponse.json({ error: 'Supabase verification failed.' }, { status: 502 })
    return NextResponse.json({ source: data })
  }
  if (!(file instanceof File)) return NextResponse.json({ error: 'Upload a CSV or XLSX file.' }, { status: 400 })
  const extension = file.name.toLowerCase().split('.').pop() ?? ''
  if (!allowed.has(extension)) return NextResponse.json({ error: 'Only .csv and .xlsx files are supported.' }, { status: 415 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Files must be 10 MB or smaller.' }, { status: 413 })
  if (file.size === 0) return NextResponse.json({ error: 'The selected file is empty.' }, { status: 422 })
  const buffer = Buffer.from(await file.arrayBuffer())
  if (extension === 'xlsx' && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    return NextResponse.json({ error: 'The file does not look like a valid XLSX workbook.' }, { status: 415 })
  }
  if (extension === 'csv' && buffer.includes(0)) {
    return NextResponse.json({ error: 'The CSV contains binary data. Export it as a UTF-8 CSV and try again.' }, { status: 415 })
  }
  let rows: Record<string, unknown>[]
  let sheetName = 'CSV'
  if (extension === 'csv') {
    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      rows = parseCsv(text)
    } catch (error) {
      const detail = error instanceof Error ? error.message : ''
      const tooManyRows = detail.includes('row import limit')
      return NextResponse.json(
        { error: detail || 'The CSV could not be decoded as UTF-8.' },
        { status: tooManyRows ? 413 : 422 },
      )
    }
  } else {
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, sheetRows: MAX_ROWS + 1 })
    } catch {
      return NextResponse.json({ error: 'The workbook could not be parsed. Check that it is a valid XLSX file.' }, { status: 422 })
    }
    sheetName = String(form.get('sheet') || workbook.SheetNames[0] || '')
    if (!sheetName || !workbook.Sheets[sheetName]) return NextResponse.json({ error: 'Select a valid workbook sheet.' }, { status: 400 })
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' })
  }
  if (!rows.length) return NextResponse.json({ error: 'The file contains no data rows.' }, { status: 422 })
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `This file contains more than the ${MAX_ROWS.toLocaleString()}-row import limit. Split it into smaller files so no records are silently omitted.` }, { status: 413 })
  }
  const quality = inspect(rows)
  const seenRows = new Set<string>()
  const uniqueRows = rows.filter((row) => {
    const key = JSON.stringify(row)
    if (seenRows.has(key)) return false
    seenRows.add(key)
    return true
  })
  const { data, error } = await supabase.from('business_data_sources').insert({ organization_id: profile.organization_id, name: file.name, provider: extension === 'xlsx' ? 'excel' : 'csv', category: 'file', status: 'connected', configuration_metadata: { file_name: file.name, sheet: sheetName, quality, rowCount: rows.length, uniqueRowCount: uniqueRows.length, duplicatesExcluded: quality.duplicateRows, columns: quality.columns, mappings: [], imported_at: new Date().toISOString() }, last_synced_at: new Date().toISOString() }).select('id,name,provider,category,status,configuration_metadata,last_synced_at').single()
  if (error || !data) return NextResponse.json({ error: 'The file was validated but could not be saved. Confirm the Brain data migration is applied.' }, { status: 500 })
  const records = uniqueRows.map((row, index) => {
    const dateKey = Object.keys(row).find((key) => /^(date|timestamp|recorded_at|created_at|transaction_date|order_date)$/i.test(key))
    const rawDate = dateKey ? row[dateKey] : null
    const parsedDate = rawDate instanceof Date
      ? rawDate.getTime()
      : typeof rawDate === 'string' && rawDate.trim()
        ? Date.parse(rawDate)
        : Number.NaN
    return {
      organization_id: profile.organization_id,
      source_id: data.id,
      record_key: `${file.name}:${sheetName}:${index}`,
      payload: row,
      recorded_at: Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : null,
    }
  })
  // Keep payloads bounded and roll back partial writes so a failed import cannot leave
  // a source that appears usable while containing only some of its rows.
  let recordsError: { message?: string } | null = null
  const recordBatchSize = 500
  for (let start = 0; start < records.length; start += recordBatchSize) {
    const batch = records.slice(start, start + recordBatchSize)
    const { error } = await supabase.from('business_source_records').upsert(batch, { onConflict: 'source_id,record_key' })
    if (error) {
      recordsError = error
      break
    }
  }
  if (recordsError) {
    await supabase.from('business_source_records').delete().eq('source_id', data.id).eq('organization_id', profile.organization_id)
    await supabase.from('business_data_sources').update({
      status: 'sync_failed',
      configuration_metadata: { ...(data.configuration_metadata ?? {}), ingestion_status: 'failed', ingestion_error: 'Normalized record persistence failed; partial records were cleaned up.' },
    }).eq('id', data.id).eq('organization_id', profile.organization_id)
    return NextResponse.json({ error: 'The source could not be fully saved. Any partial records were removed; check the Company Brain database migration and try importing again.' }, { status: 500 })
  }
  return NextResponse.json({ source: data, quality, columns: quality.columns, recordsPersisted: records.length })
}
