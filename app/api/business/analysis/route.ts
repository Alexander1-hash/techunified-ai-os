import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

const METRICS = ['Revenue','Sales','Orders','Customers','Leads','Expenses','Profit','Conversion Rate','Churn','Retention','Inventory','Transactions']
const units: Record<string,string> = { Revenue:'currency', Sales:'currency', Expenses:'currency', Profit:'currency', 'Conversion Rate':'percent', Churn:'percent', Retention:'percent' }

async function context() { const supabase = await createClient(); const { profile } = await getCurrentProfile(supabase); return { supabase, organizationId: profile?.organization_id } }
export async function GET() {
  const { supabase, organizationId } = await context(); if (!organizationId) return NextResponse.json({ error:'Authentication required.' }, { status:401 })
  const [kpis, mappings, sources] = await Promise.all([
    supabase.from('business_kpis').select('id,name,value,previous_value,unit,period,trend,status,source,recorded_at,updated_at').eq('organization_id', organizationId).order('recorded_at',{ascending:false}),
    supabase.from('business_kpi_mappings').select('id,source_id,field_name,metric_name,unit,confirmed_at').eq('organization_id', organizationId),
    supabase.from('business_data_sources').select('id,name,provider,status,configuration_metadata,last_synced_at').eq('organization_id', organizationId),
  ])
  if (kpis.error || mappings.error || sources.error) return NextResponse.json({ error:'Unable to load analyst data.' },{status:500})
  const rows = kpis.data ?? []; const areas = new Set(rows.map((k:any)=>k.name)); const quality = rows.length ? Math.round((rows.filter((k:any)=>k.status !== 'warning').length / rows.length)*100) : 0
  const health = rows.length >= 2 ? Math.round(rows.reduce((sum:number,k:any)=>sum + (k.trend === 'down' ? 40 : k.trend === 'up' ? 90 : 70),0) / rows.length) : null
  const recommendations = rows.filter((k:any)=>k.previous_value !== null && k.previous_value !== undefined && k.value !== null && k.value < k.previous_value).map((k:any)=>({ title:`${k.name} declined`, problem:`${k.name} fell from ${k.previous_value} to ${k.value}.`, recommended_action:`Review the ${k.source ?? 'connected'} data behind ${k.name}.`, category:k.name, confidence:quality/100, evidence:{kpi:k.name,current:k.value,previous:k.previous_value} }))
  const nextAction = !sources.data?.length ? 'Connect your first source.' : !mappings.data?.length ? 'Complete KPI mappings.' : rows.length < 2 ? 'Import additional historical data.' : quality < 80 ? 'Resolve data-quality warnings.' : recommendations[0]?.recommended_action ?? 'Review the latest evidence across your business areas.'
  return NextResponse.json({ kpis:rows, mappings:mappings.data??[], sources:sources.data??[], health, areas:[...areas], quality, recommendations, nextAction })
}
export async function POST(request: Request) {
  const { supabase, organizationId } = await context(); if (!organizationId) return NextResponse.json({error:'Authentication required.'},{status:401})
  const body = await request.json().catch(()=>null); if (!body?.sourceId || !Array.isArray(body.mappings)) return NextResponse.json({error:'Source and mappings are required.'},{status:400})
  const { data: source } = await supabase.from('business_data_sources').select('id,name,configuration_metadata').eq('id',body.sourceId).eq('organization_id',organizationId).single(); if (!source) return NextResponse.json({error:'Source not found.'},{status:404})
  const sample = Array.isArray(source.configuration_metadata?.sample) ? source.configuration_metadata.sample : []; const valid = body.mappings.filter((m:any)=>typeof m.fieldName==='string' && METRICS.includes(m.metricName))
  if (!valid.length) return NextResponse.json({error:'Confirm at least one supported KPI mapping.'},{status:422})
  for (const mapping of valid) { const values = sample.map((r:any)=>Number(r[mapping.fieldName])).filter(Number.isFinite); if (!values.length) continue; const value = values.reduce((a:number,b:number)=>a+b,0); const kpiPayload={organization_id:organizationId,name:mapping.metricName,value,unit:mapping.unit || units[mapping.metricName] || 'count',period:'Imported records',status:'verified',source:source.name,recorded_at:new Date().toISOString(),updated_at:new Date().toISOString()}; const {data:existingKpi}=await supabase.from('business_kpis').select('id').eq('organization_id',organizationId).eq('name',mapping.metricName).maybeSingle(); const {error}=existingKpi?.id ? await supabase.from('business_kpis').update(kpiPayload).eq('id',existingKpi.id) : await supabase.from('business_kpis').insert(kpiPayload); if(error) return NextResponse.json({error:'Could not persist KPI.'},{status:500}); const {error: mappingError}=await supabase.from('business_kpi_mappings').upsert({organization_id:organizationId,source_id:source.id,field_name:mapping.fieldName,metric_name:mapping.metricName,unit:mapping.unit || units[mapping.metricName] || 'count'},{onConflict:'source_id,field_name'}); if(mappingError) return NextResponse.json({error:'Could not persist mapping.'},{status:500}) }
  return NextResponse.json({ok:true})
}
