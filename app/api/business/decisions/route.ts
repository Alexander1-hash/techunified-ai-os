import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

type SaleRow = {
  id: string
  customer_id: string | null
  service_id: string | null
  amount: number | string | null
  quantity: number | string | null
  currency: string | null
  status: string | null
  payment_status: string | null
  sale_date: string | null
}

type CustomerRow = {
  id: string
  status: string | null
}

type ServiceRow = {
  id: string
  name: string
  status: string | null
}

type Decision = {
  id: string
  type: 'opportunity' | 'attention' | 'signal'
  title: string
  message: string
  priority: 'high' | 'medium' | 'low'
  action: string
  evidence: Record<string, string | number>
}

function toNumber(
  value: number | string | null | undefined,
) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

function revenueFor(sales: SaleRow[]) {
  return sales.reduce((total, sale) => {
    if (sale.status !== 'won') {
      return total
    }

    return (
      total +
      toNumber(sale.amount) *
        Math.max(1, toNumber(sale.quantity))
    )
  }, 0)
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    const organizationId = profile?.organization_id

    if (!organizationId) {
      return NextResponse.json(
        {
          error: 'Authentication required.',
        },
        { status: 401 },
      )
    }

    const [
      salesResult,
      customersResult,
      servicesResult,
    ] = await Promise.all([
      supabase
        .from('sales')
        .select(
          'id,customer_id,service_id,amount,quantity,currency,status,payment_status,sale_date',
        )
        .eq('organization_id', organizationId),

      supabase
        .from('customers')
        .select('id,status')
        .eq('organization_id', organizationId),

      supabase
        .from('services')
        .select('id,name,status')
        .eq('organization_id', organizationId),
    ])

    if (
      salesResult.error ||
      customersResult.error ||
      servicesResult.error
    ) {
      return NextResponse.json(
        {
          error:
            'Unable to load decision evidence.',
        },
        { status: 500 },
      )
    }

    const sales =
      (salesResult.data ?? []) as SaleRow[]

    const customers =
      (customersResult.data ?? []) as CustomerRow[]

    const services =
      (servicesResult.data ?? []) as ServiceRow[]

    const wonSales = sales.filter(
      (sale) => sale.status === 'won',
    )

    const pendingSales = sales.filter(
      (sale) =>
        sale.status === 'pending' ||
        sale.status === 'draft',
    )

    const unpaidSales = sales.filter(
      (sale) =>
        sale.payment_status === 'unpaid' ||
        sale.payment_status === 'partial',
    )

    const leads = customers.filter(
      (customer) => customer.status === 'lead',
    )

    const activeCustomers = customers.filter(
      (customer) =>
        customer.status === 'active' ||
        customer.status === 'customer',
    )

    const revenue = revenueFor(sales)

    const currency =
      wonSales.find(
        (sale) => sale.currency,
      )?.currency ?? 'NGN'

    const decisions: Decision[] = []

    if (leads.length > 0) {
      decisions.push({
        id: 'lead-pipeline',
        type: 'opportunity',
        title: 'Lead pipeline needs follow-up',
        message: `${leads.length} lead${
          leads.length === 1 ? '' : 's'
        } are currently recorded in the customer pipeline.`,
        priority:
          leads.length >= 10
            ? 'high'
            : 'medium',
        action:
          'Review the lead list and follow up with the highest-value prospects.',
        evidence: {
          leads: leads.length,
          customers: customers.length,
        },
      })
    }

    if (pendingSales.length > 0) {
      decisions.push({
        id: 'pending-sales',
        type: 'attention',
        title: 'Sales are still pending',
        message: `${pendingSales.length} sale${
          pendingSales.length === 1 ? '' : 's'
        } have not reached a won or lost outcome.`,
        priority:
          pendingSales.length >= 5
            ? 'high'
            : 'medium',
        action:
          'Review pending sales and update the next step for each opportunity.',
        evidence: {
          pendingSales: pendingSales.length,
          totalSales: sales.length,
        },
      })
    }

    if (unpaidSales.length > 0) {
      decisions.push({
        id: 'unpaid-sales',
        type: 'attention',
        title:
          'Outstanding payments require review',
        message: `${unpaidSales.length} sale${
          unpaidSales.length === 1 ? '' : 's'
        } are unpaid or partially paid.`,
        priority:
          unpaidSales.length >= 5
            ? 'high'
            : 'medium',
        action:
          'Review payment status and follow up on outstanding customer balances.',
        evidence: {
          unpaidSales: unpaidSales.length,
          wonSales: wonSales.length,
        },
      })
    }

    if (wonSales.length > 0) {
      const averageSale =
        revenue / wonSales.length

      decisions.push({
        id: 'revenue-signal',
        type: 'signal',
        title: 'Revenue activity is confirmed',
        message: `${wonSales.length} won sale${
          wonSales.length === 1 ? '' : 's'
        } currently contribute ${currency} ${revenue.toLocaleString()} in recorded revenue.`,
        priority: 'low',
        action:
          'Use the confirmed sales activity to identify which customers and services should receive more attention.',
        evidence: {
          wonSales: wonSales.length,
          revenue,
          averageSale:
            Math.round(
              averageSale * 100,
            ) / 100,
        },
      })
    }

    if (
      activeCustomers.length > 0 &&
      wonSales.length === 0
    ) {
      decisions.push({
        id: 'customer-conversion',
        type: 'opportunity',
        title:
          'Customers exist without won sales',
        message:
          'The organization has active customers recorded, but no won sales are currently confirmed.',
        priority: 'medium',
        action:
          'Review customer activity and record confirmed sales so business intelligence can measure conversion.',
        evidence: {
          activeCustomers:
            activeCustomers.length,
          wonSales: wonSales.length,
        },
      })
    }

    if (
      services.length > 0 &&
      wonSales.length === 0
    ) {
      decisions.push({
        id: 'service-evidence',
        type: 'opportunity',
        title:
          'Services need transaction evidence',
        message:
          'Services are configured, but no won sales currently connect business activity to service performance.',
        priority: 'low',
        action:
          'Record sales against services to establish service-level performance evidence.',
        evidence: {
          services: services.length,
          wonSales: wonSales.length,
        },
      })
    }

    if (!decisions.length) {
      decisions.push({
        id: 'build-evidence',
        type: 'signal',
        title: 'Build the evidence base',
        message:
          'There is not enough operational activity to produce a meaningful business decision signal yet.',
        priority: 'low',
        action:
          'Add customers and record services and sales so TechUnified can analyze real business activity.',
        evidence: {
          customers: customers.length,
          services: services.length,
          sales: sales.length,
        },
      })
    }

    return NextResponse.json({
      ok: true,

      generatedAt:
        new Date().toISOString(),

      summary: {
        customers: customers.length,
        leads: leads.length,
        activeCustomers:
          activeCustomers.length,
        services: services.length,
        sales: sales.length,
        wonSales: wonSales.length,
        pendingSales:
          pendingSales.length,
        unpaidSales:
          unpaidSales.length,
        revenue,
        currency,
      },

      decisions,

      methodology:
        'Decisions are derived only from organization-scoped Customers, Services, and Sales records. No missing business values are invented.',
    })
  } catch {
    return NextResponse.json(
      {
        error:
          'Unable to generate business decisions.',
      },
      { status: 500 },
    )
  }
}
