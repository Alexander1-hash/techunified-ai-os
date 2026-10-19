import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'
import * as XLSX from 'xlsx'

const MAX_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 5000
const allowed = new Set(['csv', 'xlsx'])

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
    const { data: existing } = await supabase.from('business_data_sources').select('id').eq('organization_id', profile.organization_id).eq('provider', provider).eq('category', 'integration').maybeSingle()
    const query = existing?.id
      ? supabase.from('business_data_sources').update(payload).eq('id', existing.id)
      : supabase.from('business_data_sources').insert(payload)
    const { data, error } = await query.select('id,name,provider,category,status,configuration_metadata,last_synced_at').single()
    if (error || !data) return NextResponse.json({ error: 'Setup details could not be saved. Confirm the Company Brain data-source migration is applied.' }, { status: 500 })
    return NextResponse.json({ source: data, connected: false }, { status: existing?.id ? 200 : 201 })
  }

  const form = await request.formData()
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
  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, sheetRows: MAX_ROWS + 1 })
  const sheetName = String(form.get('sheet') || workbook.SheetNames[0] || '')
  if (!sheetName || !workbook.Sheets[sheetName]) return NextResponse.json({ error: 'Select a valid workbook sheet.' }, { status: 400 })
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' }).slice(0, MAX_ROWS)
  if (!rows.length) return NextResponse.json({ error: 'The file contains no data rows.' }, { status: 422 })
  const quality = inspect(rows)
  const { data, error } = await supabase.from('business_data_sources').insert({ organization_id: profile.organization_id, name: file.name, provider: extension === 'xlsx' ? 'excel' : 'csv', category: 'file', status: 'connected', configuration_metadata: { file_name: file.name, sheet: sheetName, quality, columns: quality.columns, sample: rows.slice(0, 10), mappings: [], imported_at: new Date().toISOString() }, last_synced_at: new Date().toISOString() }).select('id,name,provider,category,status,configuration_metadata,last_synced_at').single()
  if (error || !data) return NextResponse.json({ error: 'The file was validated but could not be saved. Confirm the Brain data migration is applied.' }, { status: 500 })
  const records = rows.map((row, index) => ({ organization_id: profile.organization_id, source_id: data.id, record_key: `${file.name}:${sheetName}:${index}`, payload: row, recorded_at: typeof row.date === 'string' ? row.date : null }))
  const { error: recordsError } = await supabase.from('business_source_records').upsert(records, { onConflict: 'source_id,record_key' })
  if (recordsError) return NextResponse.json({ error: 'The source was saved but normalized records could not be persisted.' }, { status: 500 })
  return NextResponse.json({ source: data, quality, columns: quality.columns, recordsPersisted: records.length })
}
