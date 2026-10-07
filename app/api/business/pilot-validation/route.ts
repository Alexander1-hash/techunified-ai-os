import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

const measurementTypes = ['baseline', 'during', 'after'] as const
const evidenceStatuses = ['unverified', 'observed', 'measured', 'attributed'] as const

async function context() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  return { supabase, userId: profile?.id ?? null, organizationId: profile?.organization_id ?? null }
}

export async function GET(request: Request) {
  try {
    const { supabase, organizationId } = await context()
    if (!organizationId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const pilotId = new URL(request.url).searchParams.get('pilotId')?.trim() || null
    let pilotsQuery = supabase
      .from('business_pilot_validations')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
    if (pilotId) pilotsQuery = pilotsQuery.eq('id', pilotId)

    const { data: pilots, error: pilotsError } = await pilotsQuery
    if (pilotsError) throw pilotsError

    const ids = (pilots ?? []).map((pilot) => pilot.id)
    if (!ids.length) return NextResponse.json({ ok: true, pilots: [] })

    const [{ data: measurements, error: measurementsError }, { data: roiEvidence, error: roiError }] = await Promise.all([
      supabase.from('business_pilot_measurements').select('*').eq('organization_id', organizationId).in('pilot_id', ids).order('recorded_at', { ascending: false }),
      supabase.from('business_pilot_roi_evidence').select('*').eq('organization_id', organizationId).in('pilot_id', ids).order('created_at', { ascending: false }),
    ])
    if (measurementsError) throw measurementsError
    if (roiError) throw roiError

    const enriched = (pilots ?? []).map((pilot) => ({
      ...pilot,
      measurements: (measurements ?? []).filter((item) => item.pilot_id === pilot.id),
      roiEvidence: (roiEvidence ?? []).filter((item) => item.pilot_id === pilot.id),
    }))

    return NextResponse.json({ ok: true, pilots: enriched })
  } catch (error) {
    console.error('[Pilot Validation] GET failed:', error)
    return NextResponse.json({ error: 'Unable to load pilot validation data.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, organizationId } = await context()
    if (!organizationId || !userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const action = typeof body?.action === 'string' ? body.action : 'create_pilot'

    if (action === 'create_pilot') {
      const name = typeof body?.name === 'string' ? body.name.trim() : ''
      if (!name) return NextResponse.json({ error: 'Pilot name is required.' }, { status: 400 })

      const { data, error } = await supabase.from('business_pilot_validations').insert({
        organization_id: organizationId,
        objective_id: typeof body?.objectiveId === 'string' ? body.objectiveId : null,
        name,
        status: typeof body?.status === 'string' ? body.status : 'planning',
        baseline_start: typeof body?.baselineStart === 'string' ? body.baselineStart : null,
        baseline_end: typeof body?.baselineEnd === 'string' ? body.baselineEnd : null,
        deployment_start: typeof body?.deploymentStart === 'string' ? body.deploymentStart : null,
        measurement_start: typeof body?.measurementStart === 'string' ? body.measurementStart : null,
        measurement_end: typeof body?.measurementEnd === 'string' ? body.measurementEnd : null,
        success_criteria: Array.isArray(body?.successCriteria) ? body.successCriteria : [],
        scope: body?.scope && typeof body.scope === 'object' ? body.scope : {},
        notes: typeof body?.notes === 'string' ? body.notes.trim() : null,
        created_by: userId,
      }).select('*').single()
      if (error) throw error
      return NextResponse.json({ ok: true, pilot: data }, { status: 201 })
    }

    if (action === 'record_measurement') {
      const pilotId = typeof body?.pilotId === 'string' ? body.pilotId.trim() : ''
      const metricName = typeof body?.metricName === 'string' ? body.metricName.trim() : ''
      const metricType = typeof body?.metricType === 'string' ? body.metricType : ''
      if (!pilotId || !metricName || !measurementTypes.includes(metricType as typeof measurementTypes[number])) {
        return NextResponse.json({ error: 'pilotId, metricName and a valid metricType are required.' }, { status: 400 })
      }

      const { data: pilot } = await supabase.from('business_pilot_validations').select('id').eq('id', pilotId).eq('organization_id', organizationId).maybeSingle()
      if (!pilot) return NextResponse.json({ error: 'Pilot not found.' }, { status: 404 })

      const value = body?.value == null ? null : Number(body.value)
      if (value !== null && !Number.isFinite(value)) return NextResponse.json({ error: 'Measurement value must be numeric.' }, { status: 400 })

      const evidenceStatus = typeof body?.evidenceStatus === 'string' ? body.evidenceStatus : 'unverified'
      if (!evidenceStatuses.includes(evidenceStatus as typeof evidenceStatuses[number])) {
        return NextResponse.json({ error: 'Invalid evidence status.' }, { status: 400 })
      }

      const { data, error } = await supabase.from('business_pilot_measurements').insert({
        organization_id: organizationId,
        pilot_id: pilotId,
        metric_name: metricName,
        metric_type: metricType,
        value,
        unit: typeof body?.unit === 'string' ? body.unit.trim() : null,
        period_start: typeof body?.periodStart === 'string' ? body.periodStart : null,
        period_end: typeof body?.periodEnd === 'string' ? body.periodEnd : null,
        source: typeof body?.source === 'string' ? body.source.trim() : null,
        evidence_status: evidenceStatus,
        evidence: body?.evidence && typeof body.evidence === 'object' ? body.evidence : {},
        notes: typeof body?.notes === 'string' ? body.notes.trim() : null,
        recorded_by: userId,
      }).select('*').single()
      if (error) throw error
      return NextResponse.json({ ok: true, measurement: data }, { status: 201 })
    }

    if (action === 'verify_roi') {
      const pilotId = typeof body?.pilotId === 'string' ? body.pilotId.trim() : ''
      const baselineMeasurementId = typeof body?.baselineMeasurementId === 'string' ? body.baselineMeasurementId.trim() : ''
      const afterMeasurementId = typeof body?.afterMeasurementId === 'string' ? body.afterMeasurementId.trim() : ''
      const metricName = typeof body?.metricName === 'string' ? body.metricName.trim() : ''
      if (!pilotId || !baselineMeasurementId || !afterMeasurementId || !metricName) {
        return NextResponse.json({ error: 'Pilot, baseline measurement, after measurement and metric are required.' }, { status: 400 })
      }

      const { data: measurements, error: measurementError } = await supabase
        .from('business_pilot_measurements')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('pilot_id', pilotId)
        .in('id', [baselineMeasurementId, afterMeasurementId])
      if (measurementError) throw measurementError

      const baseline = (measurements ?? []).find((item) => item.id === baselineMeasurementId)
      const after = (measurements ?? []).find((item) => item.id === afterMeasurementId)
      if (!baseline || !after) return NextResponse.json({ error: 'Both measurements must belong to the selected pilot.' }, { status: 404 })
      if (baseline.metric_name !== metricName || after.metric_name !== metricName) return NextResponse.json({ error: 'Baseline and after measurements must use the same metric.' }, { status: 409 })
      if (baseline.value == null || after.value == null) return NextResponse.json({ error: 'Both measurements need numeric values before verification.' }, { status: 409 })
      if (!['measured', 'attributed'].includes(String(baseline.evidence_status)) || !['measured', 'attributed'].includes(String(after.evidence_status))) {
        return NextResponse.json({ error: 'ROI evidence requires measured or attributed source measurements.' }, { status: 409 })
      }

      const deltaValue = Number(after.value) - Number(baseline.value)
      const deltaPercent = Number(baseline.value) === 0 ? null : (deltaValue / Math.abs(Number(baseline.value))) * 100

      const { data, error } = await supabase.from('business_pilot_roi_evidence').insert({
        organization_id: organizationId,
        pilot_id: pilotId,
        baseline_measurement_id: baseline.id,
        after_measurement_id: after.id,
        metric_name: metricName,
        baseline_value: baseline.value,
        after_value: after.value,
        delta_value: deltaValue,
        delta_percent: deltaPercent,
        hours_saved: body?.hoursSaved == null ? null : Number(body.hoursSaved),
        cost_avoided: body?.costAvoided == null ? null : Number(body.costAvoided),
        revenue_impact: body?.revenueImpact == null ? null : Number(body.revenueImpact),
        currency: typeof body?.currency === 'string' ? body.currency.trim() : null,
        verification_status: 'verified',
        methodology: typeof body?.methodology === 'string' ? body.methodology.trim() : 'Verified comparison of measured baseline and after-period values.',
        evidence: body?.evidence && typeof body.evidence === 'object' ? body.evidence : {},
        verified_by: userId,
        verified_at: new Date().toISOString(),
      }).select('*').single()
      if (error) throw error
      return NextResponse.json({ ok: true, roiEvidence: data }, { status: 201 })
    }

    return NextResponse.json({ error: 'Unsupported pilot validation action.' }, { status: 400 })
  } catch (error) {
    console.error('[Pilot Validation] POST failed:', error)
    return NextResponse.json({ error: 'Unable to process pilot validation request.' }, { status: 500 })
  }
}
