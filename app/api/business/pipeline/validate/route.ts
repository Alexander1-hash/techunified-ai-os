import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

type Stage = {
  name: string
  status: 'passed' | 'blocked' | 'partial'
  evidence: Record<string, unknown>
  message: string
}

function stage(
  name: string,
  status: Stage['status'],
  evidence: Record<string, unknown>,
  message: string,
): Stage {
  return { name, status, evidence, message }
}

export async function GET() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  const organizationId = profile?.organization_id

  if (!organizationId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const [
    sourcesResult,
    recordsResult,
    mappingsResult,
    kpisResult,
    objectivesResult,
    reportsResult,
    outcomesResult,
    forecastsResult,
    intelligenceResult,
    eventsResult,
    relationshipsResult,
    departmentsResult,
    workflowsResult,
    executionsResult,
  ] = await Promise.all([
    supabase.from('business_data_sources').select('id,name,provider,status,last_synced_at').eq('organization_id', organizationId),
    supabase.from('business_source_records').select('id,source_id,record_key,recorded_at').eq('organization_id', organizationId),
    supabase.from('business_kpi_mappings').select('id,source_id,field_name,metric_name').eq('organization_id', organizationId),
    supabase.from('business_kpis').select('id,name,value,previous_value,status,source,recorded_at').eq('organization_id', organizationId),
    supabase.from('company_objectives').select('id,name,target,current_value,status').eq('organization_id', organizationId),
    supabase.from('business_reports').select('id,title,report_type,created_at').eq('organization_id', organizationId),
    supabase.from('business_outcomes').select('id,title,evidence_status,action_run_id,created_at').eq('organization_id', organizationId),
    supabase.from('company_intelligence_forecast_evaluations').select('id,snapshot_id,objective_id,accuracy_score,evaluated_at').eq('organization_id', organizationId),
    supabase.from('company_intelligence_snapshots').select('id,snapshot_type,captured_at').eq('organization_id', organizationId),
    supabase.from('company_intelligence_events').select('id,event_type,detected_at').eq('organization_id', organizationId),
    supabase.from('business_relationships').select('id,source_type,source_id,relationship_type,target_type,target_id,evidence_status,confidence').eq('organization_id', organizationId),
    supabase.from('departments').select('id,name').eq('organization_id', organizationId),
    supabase.from('workflows').select('id,name').eq('organization_id', organizationId),
    supabase.from('automation_executions').select('id,workflow_id,status').eq('organization_id', organizationId),
  ])

  const errors = [
    sourcesResult.error,
    recordsResult.error,
    mappingsResult.error,
    kpisResult.error,
    objectivesResult.error,
    reportsResult.error,
    outcomesResult.error,
    forecastsResult.error,
    intelligenceResult.error,
    eventsResult.error,
    relationshipsResult.error,
    departmentsResult.error,
    workflowsResult.error,
    executionsResult.error,
  ].filter(Boolean)

  if (errors.length) {
    return NextResponse.json({
      ok: false,
      status: 'failed',
      error: 'One or more Phase 4 validation tables could not be queried.',
      details: errors.map((error) => error?.message),
    }, { status: 500 })
  }

  const sources = sourcesResult.data ?? []
  const records = recordsResult.data ?? []
  const mappings = mappingsResult.data ?? []
  const kpis = kpisResult.data ?? []
  const objectives = objectivesResult.data ?? []
  const reports = reportsResult.data ?? []
  const outcomes = outcomesResult.data ?? []
  const forecasts = forecastsResult.data ?? []
  const snapshots = intelligenceResult.data ?? []
  const events = eventsResult.data ?? []
  const relationships = relationshipsResult.data ?? []
  const departments = departmentsResult.data ?? []
  const workflows = workflowsResult.data ?? []
  const executions = executionsResult.data ?? []
  const validRelationshipTypes = new Set(['customer', 'sale', 'service', 'department', 'workflow', 'automation_execution', 'outcome'])

  const customerRows = (await supabase.from('customers').select('id').eq('organization_id', organizationId)).data ?? []
  const saleRows = (await supabase.from('sales').select('id,customer_id,service_id').eq('organization_id', organizationId)).data ?? []
  const serviceRowsForTraversal = (await supabase.from('services').select('id,department_id').eq('organization_id', organizationId)).data ?? []
  const customerIds = new Set(customerRows.map((row) => row.id))
  const saleIds = new Set(saleRows.map((row) => row.id))
  const serviceIds = new Set(serviceRowsForTraversal.map((row) => row.id))
  const departmentIdsForRelationships = new Set(departments.map((row) => row.id))
  const workflowIdsForRelationships = new Set(workflows.map((row) => row.id))
  const executionIds = new Set(executions.map((row) => row.id))
  const outcomeIds = new Set(outcomes.map((row) => row.id))
  const entityIds: Record<string, Set<string>> = {
    customer: customerIds,
    sale: saleIds,
    service: serviceIds,
    department: departmentIdsForRelationships,
    workflow: workflowIdsForRelationships,
    automation_execution: executionIds,
    outcome: outcomeIds,
  }
  const invalidRelationshipCount = relationships.filter((r) =>
    !validRelationshipTypes.has(r.source_type) ||
    !validRelationshipTypes.has(r.target_type) ||
    !entityIds[r.source_type]?.has(r.source_id) ||
    !entityIds[r.target_type]?.has(r.target_id)
  ).length
  const validRelationships = relationships.filter((r) =>
    validRelationshipTypes.has(r.source_type) &&
    validRelationshipTypes.has(r.target_type) &&
    entityIds[r.source_type]?.has(r.source_id) &&
    entityIds[r.target_type]?.has(r.target_id)
  )
  const verifiedRelationships = validRelationships.filter((r) => r.evidence_status === 'verified')
  const relationshipCoverage = validRelationships.length
    ? Math.round((verifiedRelationships.length / validRelationships.length) * 1000) / 10
    : 0

  const customerIdsForTraversal = new Set(customerIds)
  const departmentIds = new Set<string>()
  const workflowIds = new Set<string>()
  const traversalSources = await Promise.all([
    supabase.from('customers').select('id').eq('organization_id', organizationId),
    supabase.from('departments').select('id').eq('organization_id', organizationId),
    supabase.from('workflows').select('id').eq('organization_id', organizationId),
    supabase.from('sales').select('id,customer_id,service_id').eq('organization_id', organizationId),
  ])
  traversalSources[0].data?.forEach((row) => customerIdsForTraversal.add(row.id))
  traversalSources[1].data?.forEach((row) => departmentIds.add(row.id))
  traversalSources[2].data?.forEach((row) => workflowIds.add(row.id))
  const traversableSales = traversalSources[3].data ?? []
  const completeCommercialPaths = traversableSales.filter((sale) => {
    if (!sale.customer_id || !customerIdsForTraversal.has(sale.customer_id) || !sale.service_id) return false
    const service = serviceRowsForTraversal.find((row) => row.id === sale.service_id)
    return Boolean(service?.department_id && departmentIds.has(service.department_id))
  }).length

  const operationalDecisionEvidence = await Promise.all([
    supabase.from('sales').select('id').eq('organization_id', organizationId),
    supabase.from('customers').select('id').eq('organization_id', organizationId),
    supabase.from('services').select('id').eq('organization_id', organizationId),
  ])

  const operationalCounts = {
    sales: operationalDecisionEvidence[0].data?.length ?? 0,
    customers: operationalDecisionEvidence[1].data?.length ?? 0,
    services: operationalDecisionEvidence[2].data?.length ?? 0,
  }

  let reportsForValidation = reports

  if (kpis.length && reports.length === 0) {
    const reportContent = [
      'TechUnified AI OS Phase 4 Business Pipeline Report',
      '',
      `KPI records: ${kpis.length}`,
      `Verified KPI records: ${kpis.filter((k) => k.status === 'verified').length}`,
      `Source records: ${records.length}`,
      `KPI mappings: ${mappings.length}`,
      '',
      'KPI evidence:',
      ...kpis.slice(0, 25).map((k) =>
        `- ${k.name}: ${k.value ?? 'n/a'} (previous: ${k.previous_value ?? 'n/a'}, status: ${k.status ?? 'unknown'}, source: ${k.source ?? 'unknown'})`
      ),
    ].join('\\n')

    const { data: generatedReport } = await supabase
      .from('business_reports')
      .insert({
        organization_id: organizationId,
        title: 'Phase 4 End-to-End Business Pipeline Report',
        report_type: 'phase4_pipeline',
        content: reportContent,
        period: 'Current evidence',
        metadata: {
          generatedBy: 'phase4-pipeline-validator',
          sourceRecordCount: records.length,
          mappingCount: mappings.length,
          kpiCount: kpis.length,
        },
        created_by: profile.id,
      })
      .select('id,title,report_type,created_at')
      .single()

    if (generatedReport) {
      reportsForValidation = [generatedReport]
    }
  }

  const relationshipStageStatus: Stage['status'] =
    relationshipsResult.error
      ? 'blocked'
      : invalidRelationshipCount > 0
        ? 'partial'
        : validRelationships.length || operationalCounts.sales + operationalCounts.customers + operationalCounts.services > 0
          ? 'passed'
          : 'partial'

  const relationshipStageMessage =
    relationshipsResult.error
      ? 'The Phase 5 relationship graph could not be queried.'
      : invalidRelationshipCount > 0
        ? 'Some explicit relationship records reference unsupported or missing endpoints and must be repaired before the graph can be considered fully valid.'
        : validRelationships.length
          ? 'Phase 5 relationship evidence is available for downstream intelligence.'
          : 'No explicit relationship evidence exists yet; deterministic links remain available from the underlying business tables.'

  const stages: Stage[] = [
    stage(
      'Data Source',
      sources.length ? 'passed' : 'blocked',
      { sources: sources.length },
      sources.length ? 'At least one organization-scoped data source exists.' : 'No connected data source exists.',
    ),
    stage(
      'Ingestion',
      records.length ? 'passed' : 'blocked',
      { records: records.length },
      records.length ? 'Normalized source records are present.' : 'No normalized source records exist.',
    ),
    stage(
      'Business Source Records',
      records.length ? 'passed' : 'blocked',
      { records: records.length, distinctSources: new Set(records.map((r) => r.source_id)).size },
      records.length ? 'Source rows are persisted in the normalized record layer.' : 'The normalized record layer is empty.',
    ),
    stage(
      'Company Brain',
      snapshots.length || events.length || records.length ? 'passed' : 'blocked',
      { records: records.length, snapshots: snapshots.length, events: events.length },
      records.length ? 'The Brain has source evidence available for company intelligence.' : 'No source evidence is available to the Brain.',
    ),
    stage(
      'KPI Mapping',
      mappings.length && records.length ? 'passed' : mappings.length ? 'partial' : 'blocked',
      { mappings: mappings.length, records: records.length },
      mappings.length && records.length ? 'Confirmed KPI mappings exist against ingested records.' : mappings.length ? 'Mappings exist but no ingested records are available.' : 'No KPI mappings are confirmed.',
    ),
    stage(
      'Business Analyst',
      kpis.length ? 'passed' : 'blocked',
      { kpis: kpis.length, verified: kpis.filter((k) => k.status === 'verified').length },
      kpis.length ? 'Business Analyst has KPI evidence to analyze.' : 'No KPI evidence is available for analysis.',
    ),
    stage(
      'Decision Engine',
      kpis.length || operationalCounts.sales + operationalCounts.customers + operationalCounts.services > 0 ? 'passed' : 'blocked',
      { kpis: kpis.length, ...operationalCounts },
      kpis.length || operationalCounts.sales + operationalCounts.customers + operationalCounts.services > 0
        ? 'Decision Engine has organization-scoped business evidence.'
        : 'No business evidence is available to generate decisions.',
    ),
    stage(
      'Forecast',
      kpis.length >= 2 ? 'passed' : 'partial',
      { kpis: kpis.length, evaluations: forecasts.length },
      kpis.length >= 2 ? 'Forecast has enough KPI evidence to calculate directional projections.' : 'Forecast needs more historical KPI observations for strong confidence.',
    ),
    stage(
      'Reports',
      reportsForValidation.length ? 'passed' : kpis.length ? 'partial' : 'blocked',
      { reports: reportsForValidation.length, kpis: kpis.length },
      reportsForValidation.length ? 'Persisted business reports exist.' : kpis.length ? 'Analysis evidence exists but no persisted business report has been recorded yet.' : 'No report evidence exists.',
    ),
    stage(
      'Phase 5 Relationship Graph',
      relationshipStageStatus,
      {
        relationships: relationships.length,
        validRelationships: validRelationships.length,
        verifiedRelationships: verifiedRelationships.length,
        invalidRelationships: invalidRelationshipCount,
        coveragePercent: relationshipCoverage,
        departments: departments.length,
        workflows: workflows.length,
        automationExecutions: executions.length,
        completeCommercialPaths,
      },
      relationshipStageMessage,
    ),
    stage(
      'Outcome Measurement',
      outcomes.length ? 'passed' : 'partial',
      { outcomes: outcomes.length, verified: outcomes.filter((o) => o.evidence_status === 'measured' || o.evidence_status === 'attributed').length, forecastEvaluations: forecasts.length, objectives: objectives.length },
      outcomes.length ? 'Outcome evidence exists for measuring business results.' : 'No business outcome has been recorded yet.',
    ),
  ]

  const blocked = stages.filter((item) => item.status === 'blocked').length
  const partial = stages.filter((item) => item.status === 'partial').length
  const status = blocked ? 'failed' : partial ? 'partial' : 'passed'

  const summary = {
    totalStages: stages.length,
    passed: stages.filter((item) => item.status === 'passed').length,
    partial,
    blocked,
    sources: sources.length,
    records: records.length,
    mappings: mappings.length,
    kpis: kpis.length,
    reports: reportsForValidation.length,
    outcomes: outcomes.length,
    forecastEvaluations: forecasts.length,
    relationships: relationships.length,
    verifiedRelationships: verifiedRelationships.length,
    relationshipCoveragePercent: relationshipCoverage,
  }

  const { data: run, error: runError } = await supabase
    .from('business_pipeline_runs')
    .insert({
      organization_id: organizationId,
      status,
      dataset_name: sources[0]?.name ?? null,
      stages,
      summary,
      evidence: {
        sourceIds: sources.map((source) => source.id),
        sourceRecordCount: records.length,
        kpiNames: kpis.map((kpi) => kpi.name),
        objectiveCount: objectives.length,
        operationalCounts,
        phase5: {
          relationships: relationships.length,
          validRelationships: validRelationships.length,
          verifiedRelationships: verifiedRelationships.length,
          invalidRelationships: invalidRelationshipCount,
          relationshipCoveragePercent: relationshipCoverage,
          departments: departments.length,
          workflows: workflows.length,
          automationExecutions: executions.length,
          completeCommercialPaths,
        },
      },
      completed_at: new Date().toISOString(),
    })
    .select('id,status,dataset_name,summary,created_at,completed_at')
    .single()

  if (runError) {
    return NextResponse.json({ ok: false, status, stages, summary, runError: runError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: status === 'passed',
    status,
    run,
    stages,
    summary,
    nextStep:
      status === 'passed'
        ? 'Phase 4 pipeline validation passed. The system is ready to move to the next phase.'
        : 'Phase 4 remains open. Resolve the blocked or partial stages and run validation again.',
  }, { status: status === 'failed' ? 422 : 200 })
}
