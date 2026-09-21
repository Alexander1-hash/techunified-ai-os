import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

type SalesRow = {
  amount: number | string | null
  quantity: number | string | null
  currency: string | null
  status: string | null
  payment_status: string | null
  sale_date: string | null
}

type CustomerRow = {
  status: string | null
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function getContext() {
  const supabase = await createClient()
  const { profile } = await getCurrentProfile(supabase)

  return {
    supabase,
    organizationId: profile?.organization_id ?? null,
  }
}

async function calculateSalesMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
) {
  const [salesResult, customersResult] = await Promise.all([
    supabase
      .from('sales')
      .select(
        'amount,quantity,currency,status,payment_status,sale_date',
      )
      .eq('organization_id', organizationId),

    supabase
      .from('customers')
      .select('status')
      .eq('organization_id', organizationId),
  ])

  if (salesResult.error || customersResult.error) {
    throw new Error('Unable to read sales intelligence data.')
  }

  const sales = (salesResult.data ?? []) as SalesRow[]
  const customers = (customersResult.data ?? []) as CustomerRow[]

  const wonSales = sales.filter(
    (sale) => sale.status === 'won',
  )

  const paidSales = sales.filter(
    (sale) => sale.payment_status === 'paid',
  )

  const revenueByCurrency = new Map<string, number>()

  for (const sale of wonSales) {
    const currency = sale.currency || 'NGN'

    const amount =
      toNumber(sale.amount) *
      Math.max(1, toNumber(sale.quantity))

    revenueByCurrency.set(
      currency,
      (revenueByCurrency.get(currency) ?? 0) + amount,
    )
  }

  const paidRevenueByCurrency = new Map<string, number>()

  for (const sale of paidSales) {
    const currency = sale.currency || 'NGN'

    const amount =
      toNumber(sale.amount) *
      Math.max(1, toNumber(sale.quantity))

    paidRevenueByCurrency.set(
      currency,
      (paidRevenueByCurrency.get(currency) ?? 0) + amount,
    )
  }

  const latestCurrency =
    revenueByCurrency.keys().next().value ?? 'NGN'

  const totalRevenue =
    revenueByCurrency.get(latestCurrency) ?? 0

  const paidRevenue =
    paidRevenueByCurrency.get(latestCurrency) ?? 0

  const leadCount = customers.filter(
    (customer) => customer.status === 'lead',
  ).length

  const activeCustomerCount = customers.filter(
    (customer) =>
      customer.status === 'active' ||
      customer.status === 'customer',
  ).length

  const metrics = [
    {
      name: 'Sales',
      category: 'Sales',
      value: wonSales.reduce(
        (sum, sale) =>
          sum + Math.max(1, toNumber(sale.quantity)),
        0,
      ),
      unit: 'count',
    },
    {
      name: 'Revenue',
      category: 'Sales',
      value: totalRevenue,
      unit: 'currency',
    },
    {
      name: 'Customers',
      category: 'Customers',
      value: customers.length,
      unit: 'count',
    },
    {
      name: 'Leads',
      category: 'Sales',
      value: leadCount,
      unit: 'count',
    },
    {
      name: 'Paid Revenue',
      category: 'Finance',
      value: paidRevenue,
      unit: 'currency',
    },
    {
      name: 'Active Customers',
      category: 'Customers',
      value: activeCustomerCount,
      unit: 'count',
    },
  ]

  return {
    metrics,
    revenueCurrency: latestCurrency,

    currencyBreakdown: [
      ...revenueByCurrency.entries(),
    ].map(([currency, value]) => ({
      currency,
      value,
    })),

    paidCurrencyBreakdown: [
      ...paidRevenueByCurrency.entries(),
    ].map(([currency, value]) => ({
      currency,
      value,
    })),
  }
}

export async function GET() {
  try {
    const { supabase, organizationId } = await getContext()

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 },
      )
    }

    const result = await calculateSalesMetrics(
      supabase,
      organizationId,
    )

    return NextResponse.json({
      ok: true,
      ...result,
      message:
        'Sales intelligence is calculated from organization-scoped Customers and Sales records.',
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to calculate sales intelligence.' },
      { status: 500 },
    )
  }
}

export async function POST() {
  try {
    const { supabase, organizationId } = await getContext()

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 },
      )
    }

    const result = await calculateSalesMetrics(
      supabase,
      organizationId,
    )

    const recordedAt = new Date().toISOString()
    const persisted = []

    for (const metric of result.metrics) {
      const { data: previous } = await supabase
        .from('business_kpis')
        .select('value')
        .eq('organization_id', organizationId)
        .eq('name', metric.name)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const previousValue =
        previous?.value === null ||
        previous?.value === undefined
          ? null
          : toNumber(previous.value)

      const { data, error } = await supabase
        .from('business_kpis')
        .insert({
          organization_id: organizationId,
          name: metric.name,
          description: `Sales intelligence snapshot for ${metric.name}.`,
          category: metric.category,
          value: metric.value,
          previous_value: previousValue,
          unit:
            metric.unit === 'currency'
              ? result.revenueCurrency
              : metric.unit,
          period: 'Sales intelligence snapshot',
          trend:
            previousValue === null
              ? 'flat'
              : metric.value > previousValue
                ? 'up'
                : metric.value < previousValue
                  ? 'down'
                  : 'flat',
          status: 'verified',
          source: 'Sales Intelligence',
          recorded_at: recordedAt,
        })
        .select(
          'id,name,value,previous_value,unit,period,trend,status,source,recorded_at',
        )
        .single()

      if (error) {
        return NextResponse.json(
          {
            error: 'Unable to persist sales intelligence KPI.',
            detail: error.message,
          },
          { status: 500 },
        )
      }

      persisted.push(data)
    }

    return NextResponse.json({
      ok: true,
      persisted,
      ...result,
      message:
        'Sales intelligence has been synchronized into verified Business KPI records.',
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to synchronize sales intelligence.' },
      { status: 500 },
    )
  }
}
