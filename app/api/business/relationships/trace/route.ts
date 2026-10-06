import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

const entityTypes = new Set([
  'customer',
  'sale',
  'service',
  'department',
  'workflow',
  'automation_execution',
  'outcome',
])

type EntityType =
  | 'customer'
  | 'sale'
  | 'service'
  | 'department'
  | 'workflow'
  | 'automation_execution'
  | 'outcome'

type Node = {
  id: string
  type: EntityType
  label: string
  evidence: 'recorded' | 'explicit'
}

type Edge = {
  source: string
  target: string
  relationship: string
  evidence: 'recorded' | 'explicit'
  evidenceStatus?: string
  confidence?: number | null
}

const key = (type: EntityType, id: string) => type + ':' + id

const labelFor = (
  type: EntityType,
  row: Record<string, unknown> | undefined,
) => {
  if (!row) return type
  if (type === 'sale') {
    const amount = Number(row.amount)
    return Number.isFinite(amount)
      ? 'Sale · ' + amount.toLocaleString()
      : 'Sale'
  }
  return String(row.name ?? row.title ?? type)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)
  const organizationId = profile?.organization_id

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const sourceType = searchParams.get('source_type') as EntityType | null
  const sourceId = searchParams.get('source_id')
  const depth = Math.min(
    Math.max(Number(searchParams.get('depth') ?? 2) || 2, 1),
    4,
  )

  if (!sourceType || !sourceId || !entityTypes.has(sourceType)) {
    return NextResponse.json(
      {
        error:
          'source_type and source_id are required. source_type must be customer, sale, service, department, workflow, automation_execution, or outcome.',
      },
      { status: 400 },
    )
  }

  const [
    customersR,
    salesR,
    servicesR,
    departmentsR,
    workflowsR,
    executionsR,
    outcomesR,
    relationshipsR,
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id,name,status')
      .eq('organization_id', organizationId),
    supabase
      .from('sales')
      .select('id,customer_id,service_id,amount,quantity,currency,status,sale_date')
      .eq('organization_id', organizationId),
    supabase
      .from('services')
      .select('id,name,department_id,status')
      .eq('organization_id', organizationId),
    supabase
      .from('departments')
      .select('id,name')
      .eq('organization_id', organizationId),
    supabase
      .from('workflows')
      .select('id,name,status')
      .eq('organization_id', organizationId),
    supabase
      .from('automation_executions')
      .select('id,workflow_id,status,started_at,completed_at')
      .eq('organization_id', organizationId),
    supabase
      .from('business_outcomes')
      .select(
        'id,title,evidence_status,hours_saved,cost_avoided,revenue_impact,implementation_cost,currency',
      )
      .eq('organization_id', organizationId),
    supabase
      .from('business_relationships')
      .select(
        'source_type,source_id,relationship_type,target_type,target_id,evidence_status,confidence',
      )
      .eq('organization_id', organizationId),
  ])

  const failed = [
    customersR,
    salesR,
    servicesR,
    departmentsR,
    workflowsR,
    executionsR,
    outcomesR,
    relationshipsR,
  ].find((result) => result.error)

  if (failed?.error) {
    return NextResponse.json(
      { error: failed.error.message },
      { status: 500 },
    )
  }

  const customers = customersR.data ?? []
  const sales = salesR.data ?? []
  const services = servicesR.data ?? []
  const departments = departmentsR.data ?? []
  const workflows = workflowsR.data ?? []
  const executions = executionsR.data ?? []
  const outcomes = outcomesR.data ?? []
  const explicit = relationshipsR.data ?? []

  const rows: Record<EntityType, Map<string, Record<string, unknown>>> = {
    customer: new Map(customers.map((row) => [row.id, row])),
    sale: new Map(sales.map((row) => [row.id, row])),
    service: new Map(services.map((row) => [row.id, row])),
    department: new Map(departments.map((row) => [row.id, row])),
    workflow: new Map(workflows.map((row) => [row.id, row])),
    automation_execution: new Map(executions.map((row) => [row.id, row])),
    outcome: new Map(outcomes.map((row) => [row.id, row])),
  }

  if (!rows[sourceType].has(sourceId)) {
    return NextResponse.json(
      { error: 'The requested source entity was not found in this organization.' },
      { status: 404 },
    )
  }

  const nodes = new Map<string, Node>()
  const edges = new Map<string, Edge>()

  const addNode = (
    type: EntityType,
    id: string,
    evidence: 'recorded' | 'explicit' = 'recorded',
  ) => {
    const nodeKey = key(type, id)
    const row = rows[type].get(id)
    if (!row) return
    const existing = nodes.get(nodeKey)
    if (existing?.evidence === 'explicit' || evidence === existing?.evidence) return
    nodes.set(nodeKey, {
      id,
      type,
      label: labelFor(type, row),
      evidence,
    })
  }

  const addEdge = (
    source: string,
    target: string,
    relationship: string,
    evidence: 'recorded' | 'explicit',
    evidenceStatus?: string,
    confidence?: number | null,
  ) => {
    const edgeKey = source + '|' + relationship + '|' + target
    if (!edges.has(edgeKey)) {
      edges.set(edgeKey, {
        source,
        target,
        relationship,
        evidence,
        ...(evidenceStatus ? { evidenceStatus } : {}),
        ...(confidence !== undefined ? { confidence } : {}),
      })
    }
  }

  const addRecordedEdge = (
    sourceType: EntityType,
    sourceId: string,
    targetType: EntityType,
    targetId: string,
    relationship: string,
  ) => {
    const source = key(sourceType, sourceId)
    const target = key(targetType, targetId)
    if (!nodes.has(source) || !nodes.has(target)) return
    addEdge(source, target, relationship, 'recorded')
  }

  const addExplicitEdge = (link: (typeof explicit)[number]) => {
    if (
      !entityTypes.has(link.source_type as EntityType) ||
      !entityTypes.has(link.target_type as EntityType)
    ) {
      return
    }

    const sourceType = link.source_type as EntityType
    const targetType = link.target_type as EntityType

    if (
      !rows[sourceType].has(link.source_id) ||
      !rows[targetType].has(link.target_id)
    ) {
      return
    }

    addNode(sourceType, link.source_id, 'explicit')
    addNode(targetType, link.target_id, 'explicit')
    addEdge(
      key(sourceType, link.source_id),
      key(targetType, link.target_id),
      link.relationship_type,
      'explicit',
      link.evidence_status,
      link.confidence,
    )
  }

  addNode(sourceType, sourceId)

  for (const sale of sales) {
    if (sale.customer_id) {
      addNode('customer', sale.customer_id)
      addNode('sale', sale.id)
      addRecordedEdge(
        'customer',
        sale.customer_id,
        'sale',
        sale.id,
        'customer_to_sale',
      )
    }

    if (sale.service_id) {
      addNode('service', sale.service_id)
      addNode('sale', sale.id)
      addRecordedEdge(
        'sale',
        sale.id,
        'service',
        sale.service_id,
        'sale_to_service',
      )
    }
  }

  for (const service of services) {
    if (!service.department_id) continue
    addNode('service', service.id)
    addNode('department', service.department_id)
    addRecordedEdge(
      'service',
      service.id,
      'department',
      service.department_id,
      'service_to_department',
    )
  }

  for (const execution of executions) {
    if (!execution.workflow_id) continue
    addNode('workflow', execution.workflow_id)
    addNode('automation_execution', execution.id)
    addRecordedEdge(
      'workflow',
      execution.workflow_id,
      'automation_execution',
      execution.id,
      'workflow_to_execution',
    )
  }

  for (const link of explicit) {
    addExplicitEdge(link)
  }

  const adjacency = new Map<string, Set<string>>()
  for (const edge of edges.values()) {
    const forward = adjacency.get(edge.source) ?? new Set<string>()
    forward.add(edge.target)
    adjacency.set(edge.source, forward)

    const reverse = adjacency.get(edge.target) ?? new Set<string>()
    reverse.add(edge.source)
    adjacency.set(edge.target, reverse)
  }

  const root = key(sourceType, sourceId)
  const distances = new Map<string, number>([[root, 0]])
  const queue = [root]

  while (queue.length) {
    const current = queue.shift() as string
    const currentDepth = distances.get(current) ?? 0
    if (currentDepth >= depth) continue

    for (const neighbor of adjacency.get(current) ?? []) {
      if (distances.has(neighbor)) continue
      distances.set(neighbor, currentDepth + 1)
      queue.push(neighbor)
    }
  }

  const visibleNodes = [...nodes.entries()]
    .filter(([nodeKey]) => distances.has(nodeKey))
    .map(([nodeKey, node]) => ({
      ...node,
      depth: distances.get(nodeKey) ?? 0,
    }))
    .sort((a, b) => a.depth - b.depth || a.type.localeCompare(b.type))

  const visibleNodeKeys = new Set(
    visibleNodes.map((node) => key(node.type, node.id)),
  )

  const visibleEdges = [...edges.values()].filter(
    (edge) =>
      visibleNodeKeys.has(edge.source) &&
      visibleNodeKeys.has(edge.target),
  )

  const evidenceGaps: Array<{
    type: string
    message: string
    source: string
  }> = []

  const rootNode = rows[sourceType].get(sourceId)

  if (sourceType === 'customer') {
    const linkedSales = sales.filter((sale) => sale.customer_id === sourceId)
    if (!linkedSales.length) {
      evidenceGaps.push({
        type: 'missing_customer_sales',
        message: 'No recorded sales are linked to this customer.',
        source: 'sales.customer_id',
      })
    }
  }

  if (sourceType === 'service') {
    const linkedSales = sales.filter((sale) => sale.service_id === sourceId)
    if (!linkedSales.length) {
      evidenceGaps.push({
        type: 'missing_service_sales',
        message: 'No recorded sales are linked to this service.',
        source: 'sales.service_id',
      })
    }
    if (!rootNode?.department_id) {
      evidenceGaps.push({
        type: 'missing_service_department',
        message: 'This service has no recorded department relationship.',
        source: 'services.department_id',
      })
    }
  }

  if (sourceType === 'workflow') {
    const linkedExecutions = executions.filter(
      (execution) => execution.workflow_id === sourceId,
    )
    if (!linkedExecutions.length) {
      evidenceGaps.push({
        type: 'missing_workflow_executions',
        message: 'No recorded automation executions are linked to this workflow.',
        source: 'automation_executions.workflow_id',
      })
    }

    const linkedOutcomes = explicit.filter(
      (link) =>
        link.source_type === 'workflow' &&
        link.source_id === sourceId &&
        link.target_type === 'outcome',
    )

    if (!linkedOutcomes.length) {
      evidenceGaps.push({
        type: 'missing_workflow_outcome',
        message: 'No explicit workflow-to-outcome evidence is recorded.',
        source: 'business_relationships',
      })
    }
  }

  if (sourceType === 'automation_execution') {
    const execution = executions.find((row) => row.id === sourceId)
    if (!execution?.workflow_id) {
      evidenceGaps.push({
        type: 'missing_execution_workflow',
        message: 'This execution has no recorded workflow relationship.',
        source: 'automation_executions.workflow_id',
      })
    }
  }

  if (
    sourceType === 'outcome' &&
    !['measured', 'attributed'].includes(String(rootNode?.evidence_status))
  ) {
    evidenceGaps.push({
      type: 'unverified_outcome',
      message:
        'This outcome is not marked measured or attributed, so impact should not be treated as verified.',
      source: 'business_outcomes.evidence_status',
    })
  }

  return NextResponse.json({
    ok: true,
    source: {
      type: sourceType,
      id: sourceId,
      label: labelFor(sourceType, rootNode),
    },
    depth,
    nodes: visibleNodes,
    edges: visibleEdges,
    evidenceGaps,
    methodology:
      'The trace combines organization-scoped foreign-key relationships with explicit business_relationships evidence. It does not infer missing relationships, profitability, ROI, or causal impact.',
  })
}
