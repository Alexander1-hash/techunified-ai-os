import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'
import * as XLSX from 'xlsx'

const MAX_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 5000
const BATCH_SIZE = 500
const allowed = new Set(['csv', 'xlsx'])

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
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
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      field = ''
      if (rows.length > MAX_ROWS + 1) throw new Error('The CSV exceeds the 5,000-row limit.')
    } else {
      field += char
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted field.')
  if (field.length || row.length) {
    row.push(field)
    if (row.some((value) => value.trim() !== '')) rows.push(row)
  }
  if (rows.length > MAX_ROWS + 1) throw new Error('The CSV exceeds the 5,000-row limit.')
  return rows
}

function csvToObjects(text: string): Record<string, unknown>[] {
  const parsed = parseCsv(text.replace(/^\uFEFF/, ''))
  if (parsed.length < 2) throw new Error('The CSV must contain a header and at least one data row.')

  const headers = parsed[0].map((value) => value.trim())
  if (headers.some((header) => !header)) throw new Error('Every CSV column must have a non-empty header.')
  const normalizedHeaders = headers.map((header) => header.toLocaleLowerCase())
  if (new Set(normalizedHeaders).size !== headers.length) throw new Error('CSV column headers must be unique.')

  const dataRows = parsed.slice(1)
  if (dataRows.length > MAX_ROWS) throw new Error('The CSV exceeds the 5,000-row limit.')
  return dataRows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}.`)
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]))
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

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart upload.' }, { status: 400 })
  }

  const file = form.get('file')
  const provider = String(form.get('provider') ?? '')
  if (provider === 'supabase') {
    const now = new Date().toISOString()
    const payload = { organization_id: profile.organization_id, name: 'TechUnified Supabase', provider: 'supabase', category: 'database', status: 'connected', configuration_metadata: { connection_type: 'application_database', verification: 'authenticated_session', verified_at: now, note: 'Confirms access to the current application database only; it does not import external tables.' }, last_synced_at: now }
    const { data: existing } = await supabase.from('business_data_sources').select('id').eq('organization_id', profile.organization_id).eq('provider', 'supabase').maybeSingle()
    const query = existing?.id ? supabase.from('business_data_sources').update(payload).eq('id', existing.id) : supabase.from('business_data_sources').insert(payload)
    const { data, error } = await query.select('id,name,provider,category,status,configuration_metadata,last_synced_at').single()
    if (error) return NextResponse.json({ error: 'Supabase verification failed.' }, { status: 502 })
    return NextResponse.json({ source: data })
  }

  if (!(file instanceof File)) return NextResponse.json({ error: 'Upload a CSV or XLSX file.' }, { status: 400 })
  const extension = file.name.toLowerCase().split('.').pop() ?? ''
  if (!allowed.has(extension)) return NextResponse.json({ error: 'Only .csv and .xlsx files are supported.' }, { status: 415 })
  if (file.size === 0) return NextResponse.json({ error: 'The uploaded file is empty.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Files must be 10 MB or smaller.' }, { status: 413 })

  let rows: Record<string, unknown>[]
  let sheetName = 'CSV'
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    if (extension === 'csv') {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      rows = csvToObjects(decoded)
    } else {
      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        return NextResponse.json({ error: 'The .xlsx file is not a valid ZIP-based Excel workbook.' }, { status: 415 })
      }
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, sheetRows: MAX_ROWS + 2 })
      sheetName = String(form.get('sheet') || workbook.SheetNames[0] || '')
      if (!sheetName || !workbook.Sheets[sheetName]) return NextResponse.json({ error: 'Select a valid workbook sheet.' }, { status: 400 })
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' })
      if (rows.length > MAX_ROWS) return NextResponse.json({ error: 'The workbook exceeds the 5,000-row limit.' }, { status: 413 })
      if (!rows.length) return NextResponse.json({ error: 'The file contains no data rows.' }, { status: 422 })
      const headers = Object.keys(rows[0])
      if (!headers.length || headers.some((header) => !header.trim()) || new Set(headers.map((header) => header.toLocaleLowerCase())).size !== headers.length) {
        return NextResponse.json({ error: 'Excel columns must have non-empty, unique headers.' }, { status: 422 })
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return NextResponse.json({ error: message.includes('5,000-row') ? message : 'The file could not be parsed. Check its encoding, headers, quoting, and workbook format.' }, { status: 422 })
  }

  if (!rows.length) return NextResponse.json({ error: 'The file contains no data rows.' }, { status: 422 })
  const quality = inspect(rows)
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('business_data_sources').insert({
    organization_id: profile.organization_id,
    name: file.name,
    provider: extension === 'xlsx' ? 'excel' : 'csv',
    category: 'file',
    status: 'syncing',
    configuration_metadata: { file_name: file.name, sheet: sheetName, quality, columns: quality.columns, mappings: [], imported_at: now },
    last_synced_at: null,
  }).select('id,name,provider,category,configuration_metadata').single()
  if (error || !data) return NextResponse.json({ error: 'The file was validated but could not be saved. Confirm the Brain data migration is applied.' }, { status: 500 })

  const records = rows.map((row, index) => {
    const dateField = Object.keys(row).find((key) =>
      ['date', 'datetime', 'timestamp', 'recorded_at'].includes(key.trim().toLocaleLowerCase()),
    )
    const rawDate = dateField ? row[dateField] : null
    const parsedDate = rawDate instanceof Date
      ? rawDate
      : typeof rawDate === 'string' || typeof rawDate === 'number'
        ? new Date(rawDate)
        : null
    const recordedAt = parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toISOString()
      : null

    return {
      organization_id: profile.organization_id,
      source_id: data.id,
      record_key: file.name + ':' + sheetName + ':' + index,
      payload: row,
      recorded_at: recordedAt,
    }
  })

  for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
    const batch = records.slice(offset, offset + BATCH_SIZE)
    const { error: recordsError } = await supabase.from('business_source_records').upsert(batch, { onConflict: 'source_id,record_key' })
    if (recordsError) {
      const { error: cleanupError } = await supabase.from('business_data_sources').delete().eq('id', data.id).eq('organization_id', profile.organization_id)
      if (cleanupError) {
        await supabase.from('business_data_sources').update({ status: 'sync_failed', configuration_metadata: { file_name: file.name, sheet: sheetName, quality, columns: quality.columns, import_error: 'Record persistence failed; cleanup also failed.', failed_at: new Date().toISOString() } }).eq('id', data.id).eq('organization_id', profile.organization_id)
      }
      return NextResponse.json({ error: cleanupError ? 'Record persistence failed and cleanup needs attention. The source is marked sync_failed.' : 'The import could not be fully persisted; the partial source was rolled back.' }, { status: 500 })
    }
  }

  const { data: completedSource, error: completeError } = await supabase.from('business_data_sources').update({ status: 'connected', last_synced_at: new Date().toISOString() }).eq('id', data.id).eq('organization_id', profile.organization_id).select('id,name,provider,category,configuration_metadata,last_synced_at').single()
  if (completeError || !completedSource) return NextResponse.json({ error: 'Records were persisted, but the source status could not be finalized. Refresh sources before retrying to avoid duplicate imports.', sourceId: data.id }, { status: 500 })
  return NextResponse.json({ source: completedSource, quality, columns: quality.columns, recordsPersisted: records.length })
}
