import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

const ENTITY_TYPES = [
  'customer',
  'sale',
  'service',
  'department',
  'workflow',
  'automation_execution',
  'outcome',
] as const

type EntityType = (typeof ENTITY_TYPES)[number]

const n = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function validEntityType(value: unknown): value is EntityType {
  return typeof value === 'string' && ENTITY_TYPES.includes(value as EntityType)
}

async function entityExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  type: EntityType,
  id: string,
) {
  const tableByType: Record<EntityType, string> = {
    customer: 'customers',
    sale: 'sales',
    service: 'services',
    department: 'departments',
    workflow: 'workflows',
    automation_execution: 'automation_executions',
    outcome: 'business_outcomes',
  }

  const { data, error } = await supabase
    .from(tableByType[type])
    .select('id')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    const organizationId = profile?.organization_id

    if (!organizationId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const [
      customersR,
      salesR,
      servicesR,
      departmentsR,
      workflowsR,
      executionsR,
      outcomesR,
      linksR,
    ] = await Promise.all([
      supabase.from('customers').select('id,name,status').eq('organization_id', organizationId),
      supabase.from('sales').select('id,customer_id,service_id,amount,quantity,currency,status,payment_status,sale_date').eq('organization_id', organizationId),
      supabase.from('services').select('id,name,department_id,price,status').eq('organization_id', organizationId),
      supabase.from('departments').select('id,name').eq('organization_id', organizationId),
      supabase.from('workflows').select('id,name,status').eq('organization_id', organizationId),
      supabase.from('automation_executions').select('id,workflow_id,status,started_at,completed_at').eq('organization_id', organizationId),
      supabase.from('business_outcomes').select('id,title,outcome_type,evidence_status,hours_saved,cost_avoided,revenue_impact,implementation_cost,currency').eq('organization_id', organizationId),
      supabase.from('business_relationships').select('source_type,source_id,relationship_type,target_type,target_id,evidence_status,confidence').eq('organization_id', organizationId),
    ])

    const failed = [customersR, salesR, servicesR, departmentsR, workflowsR, executionsR, outcomesR, linksR].find((result) => result.error)
    if (failed?.error) throw new Error(failed.error.message)

    const customers = customersR.data ?? []
    const sales = salesR.data ?? []
    const services = servicesR.data ?? []
    const departments = departmentsR.data ?? []
    const workflows = workflowsR.data ?? []
    const executions = executionsR.data ?? []
    const outcomes = outcomesR.data ?? []
    const links = linksR.data ?? []

    const customerMap = new Map(customers.map((item) => [item.id, item]))
    const serviceMap = new Map(services.map((item) => [item.id, item]))
    const departmentMap = new Map(departments.map((item) => [item.id, item]))

    const wonSales = sales.filter((sale) => sale.status === 'won')
    const lostSales = sales.filter((sale) => sale.status === 'lost')

    const revenueByCustomer = new Map<string, number>()
    const revenueByService = new Map<string, number>()

    for (const sale of wonSales) {
      // The sales schema does not define amount as a unit price.
      // Treat amount as the recorded monetary amount; quantity remains operational data.
      const value = n(sale.amount)

      if (sale.customer_id) {
        revenueByCustomer.set(
          sale.customer_id,
          (revenueByCustomer.get(sale.customer_id) ?? 0) + value,
        )
      }

      if (sale.service_id) {
        revenueByService.set(
          sale.service_id,
          (revenueByService.get(sale.service_id) ?? 0) + value,
        )
      }
    }

    const topCustomers = [...revenueByCustomer.entries()]
      .map(([id, revenue]) => ({
        customer: customerMap.get(id) ?? null,
        revenue,
      }))
      .filter((item) => item.customer)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    const servicePerformance = [...revenueByService.entries()]
      .map(([id, revenue]) => ({
        service: serviceMap.get(id) ?? null,
        department:
          serviceMap.get(id)?.department_id
            ? departmentMap.get(serviceMap.get(id)!.department_id!)
            : null,
        revenue,
        sales: wonSales.filter((sale) => sale.service_id === id).length,
      }))
      .filter((item) => item.service)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    const leadCount = customers.filter((customer) => customer.status === 'lead').length
    const conversionDenominator = wonSales.length + lostSales.length
    const conversionRate =
      conversionDenominator > 0
        ? wonSales.length / conversionDenominator
        : null

    const workflowExecutions = workflows
      .map((workflow) => {
        const rows = executions.filter((execution) => execution.workflow_id === workflow.id)
        return {
          workflow,
          executions: rows.length,
          completed: rows.filter((row) => row.status === 'completed').length,
          failed: rows.filter((row) => row.status === 'failed').length,
        }
      })
      .sort((a, b) => b.executions - a.executions)

    const outcomeSummary = outcomes.reduce(
      (summary, outcome) => {
        summary.count += 1
        summary.hoursSaved += n(outcome.hours_saved)
        summary.costAvoided += n(outcome.cost_avoided)
        summary.revenueImpact += n(outcome.revenue_impact)
        summary.implementationCost += n(outcome.implementation_cost)

        if (outcome.evidence_status === 'measured') {
          summary.measured += 1
        }

        return summary
      },
      {
        count: 0,
        measured: 0,
        hoursSaved: 0,
        costAvoided: 0,
        revenueImpact: 0,
        implementationCost: 0,
      },
    )

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      graph: {
        nodes: {
          customers: customers.length,
          sales: sales.length,
          services: services.length,
          departments: departments.length,
          workflows: workflows.length,
          automationExecutions: executions.length,
          outcomes: outcomes.length,
        },
        relationships: {
          customersWithSales: new Set(
            sales.map((sale) => sale.customer_id).filter(Boolean),
          ).size,
          servicesWithSales: new Set(
            sales.map((sale) => sale.service_id).filter(Boolean),
          ).size,
          servicesWithDepartments: services.filter(
            (service) =>
              service.department_id &&
              departmentMap.has(service.department_id),
          ).length,
          workflowsWithExecutions: new Set(
            executions.map((execution) => execution.workflow_id),
          ).size,
          explicitRelationships: links.length,
        },
      },
      customerIntelligence: {
        customers: customers.length,
        leadCount,
        topCustomers,
      },
      salesIntelligence: {
        wonSales: wonSales.length,
        lostSales: lostSales.length,
        conversionRate,
      },
      serviceIntelligence: {
        performance: servicePerformance,
      },
      operationalIntelligence: {
        workflows: workflowExecutions,
      },
      outcomeIntelligence: outcomeSummary,
      explicitRelationships: links,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to calculate relationship intelligence.',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    const organizationId = profile?.organization_id

    if (!organizationId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const body = await request.json()
    const sourceType = body.source_type
    const targetType = body.target_type
    const sourceId = String(body.source_id ?? '').trim()
    const targetId = String(body.target_id ?? '').trim()
    const relationshipType = String(body.relationship_type ?? '').trim()

    if (
      !validEntityType(sourceType) ||
      !validEntityType(targetType) ||
      !sourceId ||
      !targetId ||
      !relationshipType
    ) {
      return NextResponse.json(
        {
          error:
            'source_type, source_id, relationship_type, target_type, and target_id are required.',
        },
        { status: 400 },
      )
    }

    const evidenceStatus =
      ['verified', 'estimated', 'inferred'].includes(body.evidence_status)
        ? body.evidence_status
        : 'verified'

    const confidence =
      body.confidence === undefined ||
      body.confidence === null ||
      body.confidence === ''
        ? null
        : Number(body.confidence)

    if (
      confidence !== null &&
      (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
    ) {
      return NextResponse.json(
        { error: 'confidence must be between 0 and 1.' },
        { status: 400 },
      )
    }

    const [sourceExists, targetExists] = await Promise.all([
      entityExists(supabase, organizationId, sourceType, sourceId),
      entityExists(supabase, organizationId, targetType, targetId),
    ])

    if (!sourceExists || !targetExists) {
      return NextResponse.json(
        { error: 'Both relationship entities must exist in this organization.' },
        { status: 404 },
      )
    }

    const { data, error } = await supabase
      .from('business_relationships')
      .insert({
        organization_id: organizationId,
        source_type: sourceType,
        source_id: sourceId,
        relationship_type: relationshipType,
        target_type: targetType,
        target_id: targetId,
        evidence_status: evidenceStatus,
        confidence,
        metadata:
          body.metadata &&
          typeof body.metadata === 'object' &&
          !Array.isArray(body.metadata)
            ? body.metadata
            : {},
        created_by: profile?.id ?? null,
      })
      .select(
        'id,source_type,source_id,relationship_type,target_type,target_id,evidence_status,confidence,metadata,created_at',
      )
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This business relationship already exists.' },
          { status: 409 },
        )
      }

      throw new Error(error.message)
    }

    return NextResponse.json({ ok: true, relationship: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create business relationship.',
      },
      { status: 500 },
    )
  }
}
