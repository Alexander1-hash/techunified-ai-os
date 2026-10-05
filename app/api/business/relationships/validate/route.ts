import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

export async function GET() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  const organizationId = profile?.organization_id

  if (!organizationId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const [customers, sales, services, departments, workflows, executions, outcomes, relationships] =
    await Promise.all([
      supabase.from('customers').select('id').eq('organization_id', organizationId),
      supabase.from('sales').select('id,customer_id,service_id,status').eq('organization_id', organizationId),
      supabase.from('services').select('id,department_id').eq('organization_id', organizationId),
      supabase.from('departments').select('id').eq('organization_id', organizationId),
      supabase.from('workflows').select('id').eq('organization_id', organizationId),
      supabase.from('automation_executions').select('id,workflow_id,status').eq('organization_id', organizationId),
      supabase.from('business_outcomes').select('id,evidence_status').eq('organization_id', organizationId),
      supabase.from('business_relationships').select('id,source_type,source_id,relationship_type,target_type,target_id,evidence_status').eq('organization_id', organizationId),
    ])

  const results = [customers, sales, services, departments, workflows, executions, outcomes, relationships]
  const failed = results.find((result) => result.error)

  if (failed?.error) {
    return NextResponse.json(
      { ok: false, status: 'failed', error: failed.error.message },
      { status: 500 },
    )
  }

  const customerRows = customers.data ?? []
  const saleRows = sales.data ?? []
  const serviceRows = services.data ?? []
  const departmentRows = departments.data ?? []
  const workflowRows = workflows.data ?? []
  const executionRows = executions.data ?? []
  const outcomeRows = outcomes.data ?? []
  const relationshipRows = relationships.data ?? []

  const customerIds = new Set(customerRows.map((row) => row.id))
  const serviceIds = new Set(serviceRows.map((row) => row.id))
  const departmentIds = new Set(departmentRows.map((row) => row.id))
  const workflowIds = new Set(workflowRows.map((row) => row.id))

  const salesWithCustomers = saleRows.filter((row) => row.customer_id && customerIds.has(row.customer_id)).length
  const salesWithServices = saleRows.filter((row) => row.service_id && serviceIds.has(row.service_id)).length
  const servicesWithDepartments = serviceRows.filter((row) => row.department_id && departmentIds.has(row.department_id)).length
  const executionsWithWorkflows = executionRows.filter((row) => workflowIds.has(row.workflow_id)).length

  const checks: Array<{ name: string; passed: boolean; evidence: Record<string, unknown> }> = [
    {
      name: 'Customer → Sales',
      passed: salesWithCustomers > 0 || saleRows.length === 0,
      evidence: { sales: saleRows.length, linkedSales: salesWithCustomers },
    },
    {
      name: 'Sales → Services',
      passed: salesWithServices > 0 || saleRows.length === 0,
      evidence: { sales: saleRows.length, linkedSales: salesWithServices },
    },
    {
      name: 'Services → Departments',
      passed: servicesWithDepartments > 0 || serviceRows.length === 0,
      evidence: { services: serviceRows.length, linkedServices: servicesWithDepartments },
    },
    {
      name: 'Workflows → Automation Executions',
      passed: executionsWithWorkflows > 0 || executionRows.length === 0,
      evidence: { executions: executionRows.length, linkedExecutions: executionsWithWorkflows },
    },
    {
      name: 'Outcome evidence',
      passed: outcomeRows.length > 0,
      evidence: {
        outcomes: outcomeRows.length,
        measured: outcomeRows.filter((row) => row.evidence_status === 'measured' || row.evidence_status === 'attributed').length,
      },
    },
  ]

  const entityIds: Record<string, Set<string>> = {
    customer: customerIds,
    sale: new Set(saleRows.map((row) => row.id)),
    service: serviceIds,
    department: departmentIds,
    workflow: workflowIds,
    automation_execution: new Set(executionRows.map((row) => row.id)),
    outcome: new Set(outcomeRows.map((row) => row.id)),
  }
  const relationshipTypes = new Set(relationshipRows.map((row) => row.relationship_type))
  const invalidExplicitRelationships = relationshipRows.filter(
    (row) =>
      !Object.prototype.hasOwnProperty.call(entityIds, row.source_type) ||
      !Object.prototype.hasOwnProperty.call(entityIds, row.target_type) ||
      !entityIds[row.source_type].has(row.source_id) ||
      !entityIds[row.target_type].has(row.target_id),
  ).length
  const validExplicitRelationships = relationshipRows.length - invalidExplicitRelationships
  const verifiedExplicitRelationships = relationshipRows.filter(
    (row) => row.evidence_status === 'verified',
  ).length
  const relationshipEvidencePassed = invalidExplicitRelationships === 0

  // Validate the complete deterministic business path using foreign-key-backed data.
  // This does not invent relationships: every edge must already exist in the source tables.
  const serviceById = new Map(serviceRows.map((row) => [row.id, row]))
  const workflowById = new Set(workflowRows.map((row) => row.id))
  const outcomeIds = new Set(outcomeRows.map((row) => row.id))
  const saleServiceDepartmentPaths = saleRows.filter((sale) => {
    if (!sale.customer_id || !customerIds.has(sale.customer_id) || !sale.service_id) return false
    const service = serviceById.get(sale.service_id)
    return Boolean(service?.department_id && departmentIds.has(service.department_id))
  }).length
  const executionWorkflowPaths = executionRows.filter((execution) => workflowById.has(execution.workflow_id)).length
  const explicitAutomationOutcomePaths = relationshipRows.filter((row) =>
    row.source_type === 'automation_execution' &&
    row.target_type === 'outcome' &&
    entityIds.automation_execution.has(row.source_id) &&
    outcomeIds.has(row.target_id) &&
    row.evidence_status === 'verified',
  ).length
  const completeCommercialPaths = saleServiceDepartmentPaths
  const graphTraversalPassed =
    (saleRows.length === 0 || completeCommercialPaths > 0) &&
    (executionRows.length === 0 || executionWorkflowPaths > 0) &&
    invalidExplicitRelationships === 0

  checks.push({
    name: 'End-to-end graph traversal',
    passed: graphTraversalPassed,
    evidence: {
      customerToSaleToServiceToDepartment: completeCommercialPaths,
      sales: saleRows.length,
      automationToWorkflow: executionWorkflowPaths,
      automationExecutions: executionRows.length,
      verifiedAutomationOutcomeLinks: explicitAutomationOutcomePaths,
    },
  })

  checks.push({
    name: 'Explicit relationship evidence',
    passed: relationshipEvidencePassed,
    evidence: {
      relationships: relationshipRows.length,
      verified: verifiedExplicitRelationships,
      relationshipTypes: relationshipTypes.size,
      invalid: invalidExplicitRelationships,
      valid: validExplicitRelationships,
    },
  })

  const status = checks.every((check) => check.passed) ? 'passed' : 'partial'

  return NextResponse.json({
    ok: status === 'passed',
    status,
    organizationId,
    graph: {
      customers: customerRows.length,
      sales: saleRows.length,
      services: serviceRows.length,
      departments: departmentRows.length,
      workflows: workflowRows.length,
      automationExecutions: executionRows.length,
      outcomes: outcomeRows.length,
      explicitRelationships: relationshipRows.length,
    },
    checks,
    coverage: {
      customerSales: saleRows.length ? salesWithCustomers / saleRows.length : null,
      salesServices: saleRows.length ? salesWithServices / saleRows.length : null,
      servicesDepartments: serviceRows.length ? servicesWithDepartments / serviceRows.length : null,
      workflowExecutions: executionRows.length ? executionsWithWorkflows / executionRows.length : null,
    },
    methodology:
      'Phase 5 validates organization-scoped relationships already recorded in the business model. It does not infer missing commercial or financial facts.',
  })
}
