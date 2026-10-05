import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

const num = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function GET() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  const organizationId = profile?.organization_id

  if (!organizationId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const [customersR, salesR, servicesR, departmentsR, workflowsR, executionsR, outcomesR, linksR] =
    await Promise.all([
      supabase.from('customers').select('id,name,status').eq('organization_id', organizationId),
      supabase.from('sales').select('id,customer_id,service_id,amount,quantity,currency,status,sale_date').eq('organization_id', organizationId),
      supabase.from('services').select('id,name,department_id,status').eq('organization_id', organizationId),
      supabase.from('departments').select('id,name').eq('organization_id', organizationId),
      supabase.from('workflows').select('id,name,status').eq('organization_id', organizationId),
      supabase.from('automation_executions').select('id,workflow_id,status,started_at,completed_at').eq('organization_id', organizationId),
      supabase.from('business_outcomes').select('id,title,evidence_status,hours_saved,cost_avoided,revenue_impact,implementation_cost,currency').eq('organization_id', organizationId),
      supabase.from('business_relationships').select('source_type,source_id,relationship_type,target_type,target_id,evidence_status,confidence').eq('organization_id', organizationId),
    ])

  const failed = [customersR, salesR, servicesR, departmentsR, workflowsR, executionsR, outcomesR, linksR].find((r) => r.error)
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 })
  }

  const customers = customersR.data ?? []
  const sales = salesR.data ?? []
  const services = servicesR.data ?? []
  const departments = departmentsR.data ?? []
  const workflows = workflowsR.data ?? []
  const executions = executionsR.data ?? []
  const outcomes = outcomesR.data ?? []
  const explicit = linksR.data ?? []

  const customerMap = new Map(customers.map((x) => [x.id, x]))
  const serviceMap = new Map(services.map((x) => [x.id, x]))
  const departmentMap = new Map(departments.map((x) => [x.id, x]))
  const workflowMap = new Map(workflows.map((x) => [x.id, x]))

  const won = sales.filter((x) => x.status === 'won')
  const lost = sales.filter((x) => x.status === 'lost')

  const valueOf = (sale: (typeof sales)[number]) =>
    // The sales schema does not establish amount as a unit price.
    // Use the recorded amount for financial totals; quantity remains operational data.
    num(sale.amount)

  const customerRevenue = new Map<string, number>()
  const serviceRevenue = new Map<string, number>()

  for (const sale of won) {
    if (sale.customer_id) customerRevenue.set(sale.customer_id, (customerRevenue.get(sale.customer_id) ?? 0) + valueOf(sale))
    if (sale.service_id) serviceRevenue.set(sale.service_id, (serviceRevenue.get(sale.service_id) ?? 0) + valueOf(sale))
  }

  const topCustomer = [...customerRevenue.entries()]
    .sort((a, b) => b[1] - a[1])[0]

  const topService = [...serviceRevenue.entries()]
    .sort((a, b) => b[1] - a[1])[0]

  const leadCustomers = customers.filter((x) => x.status === 'lead')
  const convertedLeads = leadCustomers.filter((customer) =>
    won.some((sale) => sale.customer_id === customer.id),
  )

  const servicesWithCostEvidence = explicit.filter(
    (x) =>
      x.relationship_type.toLowerCase().includes('cost') &&
      x.target_type === 'outcome',
  )

  const measuredOutcomes = outcomes.filter(
    (x) => x.evidence_status === 'measured' || x.evidence_status === 'attributed',
  )

  const workflowExecutionCounts = workflows.map((workflow) => {
    const rows = executions.filter((execution) => execution.workflow_id === workflow.id)
    return {
      workflow,
      executions: rows.length,
      completed: rows.filter((x) => x.status === 'completed').length,
      failed: rows.filter((x) => x.status === 'failed').length,
    }
  }).sort((a, b) => b.executions - a.executions)

  const workflowWithOutcome = workflowExecutionCounts
    .map((item) => ({
      ...item,
      outcomes: explicit.filter(
        (x) =>
          x.source_type === 'workflow' &&
          x.source_id === item.workflow.id &&
          x.target_type === 'outcome',
      ).length,
    }))
    .filter((item) => item.outcomes > 0)

  const revenueByDepartment = new Map<string, number>()
  for (const sale of won) {
    const service = sale.service_id ? serviceMap.get(sale.service_id) : null
    const departmentId = service?.department_id
    if (departmentId) revenueByDepartment.set(departmentId, (revenueByDepartment.get(departmentId) ?? 0) + valueOf(sale))
  }

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),

    questions: {
      highestRevenueCustomer: topCustomer
        ? {
            answerable: true,
            customer: customerMap.get(topCustomer[0]) ?? null,
            revenue: topCustomer[1],
            evidence: 'won sales linked to customer_id',
          }
        : {
            answerable: false,
            reason: 'No won sales with customer relationships are recorded.',
          },

      highestRevenueService: topService
        ? {
            answerable: true,
            service: serviceMap.get(topService[0]) ?? null,
            revenue: topService[1],
            evidence: 'won sales linked to service_id',
          }
        : {
            answerable: false,
            reason: 'No won sales with service relationships are recorded.',
          },

      leadLossLocation: {
        answerable: lost.length > 0,
        lostSales: lost.length,
        convertedLeads: convertedLeads.length,
        evidence: 'customer status plus won/lost sales',
        limitation: 'The current sales model does not contain a full multi-stage opportunity history, so this identifies recorded loss activity rather than a complete stage-by-stage funnel.',
      },

      serviceProfitability: {
        answerable: false,
        reason: 'No verified service-level cost basis is present in the current Phase 5 relationship model.',
        revenueAvailable: serviceRevenue.size > 0,
        costEvidenceLinks: servicesWithCostEvidence.length,
      },

      operationalCost: {
        answerable: false,
        reason: 'Workflow executions are available, but execution-level cost or time valuation is not yet connected to a verified business outcome.',
        workflows: workflows.length,
        executions: executions.length,
      },

      automationImpact: {
        answerable: workflowWithOutcome.length > 0,
        workflowsWithLinkedOutcomes: workflowWithOutcome.map((x) => ({
          workflow: x.workflow,
          executions: x.executions,
          completed: x.completed,
          failed: x.failed,
          linkedOutcomes: x.outcomes,
        })),
        measuredOutcomes: measuredOutcomes.length,
        limitation: 'Measurable impact requires an explicit workflow/automation-to-outcome relationship and verified outcome evidence.',
      },

      departmentRevenue: {
        answerable: revenueByDepartment.size > 0,
        departments: [...revenueByDepartment.entries()]
          .map(([id, revenue]) => ({
            department: departmentMap.get(id) ?? null,
            revenue,
          }))
          .sort((a, b) => b.revenue - a.revenue),
      },
    },

    graphCoverage: {
      customers: customers.length,
      sales: sales.length,
      services: services.length,
      departments: departments.length,
      workflows: workflows.length,
      automationExecutions: executions.length,
      outcomes: outcomes.length,
      explicitRelationships: explicit.length,
    },

    methodology:
      'Answers are derived only from organization-scoped records and explicit relationship evidence. Unsupported profitability, cost, ROI, or funnel claims are intentionally reported as unavailable rather than inferred.',
  })
}
