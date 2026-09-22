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

function quantityFor(sale: SaleRow) {
  return Math.max(1, toNumber(sale.quantity))
}

function saleValue(sale: SaleRow) {
  return toNumber(sale.amount) * quantityFor(sale)
}

function revenueFor(sales: SaleRow[]) {
  return sales.reduce((total, sale) => {
    if (sale.status !== 'won') {
      return total
    }

    return total + saleValue(sale)
  }, 0)
}

function sortByValue(
  values: Array<{
    id: string
    value: number
  }>,
) {
  return [...values].sort(
    (a, b) => b.value - a.value,
  )
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { profile } =
      await getCurrentProfile(supabase)

    const organizationId =
      profile?.organization_id

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
        .eq(
          'organization_id',
          organizationId,
        ),

      supabase
        .from('customers')
        .select('id,status')
        .eq(
          'organization_id',
          organizationId,
        ),

      supabase
        .from('services')
        .select(
          'id,name,status',
        )
        .eq(
          'organization_id',
          organizationId,
        ),
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
      (salesResult.data ??
        []) as SaleRow[]

    const customers =
      (customersResult.data ??
        []) as CustomerRow[]

    const services =
      (servicesResult.data ??
        []) as ServiceRow[]

    const wonSales =
      sales.filter(
        (sale) =>
          sale.status === 'won',
      )

    const pendingSales =
      sales.filter(
        (sale) =>
          sale.status === 'pending' ||
          sale.status === 'draft',
      )

    const lostSales =
      sales.filter(
        (sale) =>
          sale.status === 'lost',
      )

    const unpaidSales =
      sales.filter(
        (sale) =>
          sale.payment_status ===
            'unpaid' ||
          sale.payment_status ===
            'partial',
      )

    const leads =
      customers.filter(
        (customer) =>
          customer.status ===
          'lead',
      )

    const activeCustomers =
      customers.filter(
        (customer) =>
          customer.status ===
            'active' ||
          customer.status ===
            'customer',
      )

    const revenue =
      revenueFor(sales)

    const currency =
      wonSales.find(
        (sale) =>
          Boolean(sale.currency),
      )?.currency ?? 'NGN'

    /*
     * Build relationships between
     * customers, services and sales.
     */
    const customerSales = new Map<
      string,
      SaleRow[]
    >()

    const serviceSales = new Map<
      string,
      SaleRow[]
    >()

    for (const sale of sales) {
      if (sale.customer_id) {
        const existing =
          customerSales.get(
            sale.customer_id,
          ) ?? []

        existing.push(sale)

        customerSales.set(
          sale.customer_id,
          existing,
        )
      }

      if (sale.service_id) {
        const existing =
          serviceSales.get(
            sale.service_id,
          ) ?? []

        existing.push(sale)

        serviceSales.set(
          sale.service_id,
          existing,
        )
      }
    }

    /*
     * Service-level performance.
     */
    const servicePerformance =
      services.map((service) => {
        const relatedSales =
          serviceSales.get(
            service.id,
          ) ?? []

        const wonServiceSales =
          relatedSales.filter(
            (sale) =>
              sale.status ===
              'won',
          )

        const serviceRevenue =
          revenueFor(
            relatedSales,
          )

        const unitsSold =
          wonServiceSales.reduce(
            (total, sale) =>
              total +
              quantityFor(
                sale,
              ),
            0,
          )

        return {
          service,
          sales: relatedSales,
          wonSales:
            wonServiceSales,
          revenue:
            serviceRevenue,
          unitsSold,
        }
      })

    const servicesWithWonSales =
      servicePerformance.filter(
        (item) =>
          item.wonSales.length >
          0,
      )

    const servicesWithoutSales =
      servicePerformance.filter(
        (item) =>
          item.sales.length ===
          0,
      )

    const topServices =
      sortByValue(
        servicesWithWonSales.map(
          (item) => ({
            id: item.service.id,
            value: item.revenue,
          }),
        ),
      )

    /*
     * Customer-level performance.
     */
    const customerPerformance =
      customers.map((customer) => {
        const relatedSales =
          customerSales.get(
            customer.id,
          ) ?? []

        const wonCustomerSales =
          relatedSales.filter(
            (sale) =>
              sale.status ===
              'won',
          )

        const customerRevenue =
          revenueFor(
            relatedSales,
          )

        const outstandingSales =
          relatedSales.filter(
            (sale) =>
              sale.payment_status ===
                'unpaid' ||
              sale.payment_status ===
                'partial',
          )

        const servicesPurchased =
          new Set(
            wonCustomerSales
              .map(
                (sale) =>
                  sale.service_id,
              )
              .filter(
                Boolean,
              ),
          ).size

        return {
          customer,
          sales: relatedSales,
          wonSales:
            wonCustomerSales,
          revenue:
            customerRevenue,
          outstandingSales,
          servicesPurchased,
        }
      })

    const customersWithWonSales =
      customerPerformance.filter(
        (item) =>
          item.wonSales.length >
          0,
      )

    const customersWithoutSales =
      customerPerformance.filter(
        (item) =>
          item.sales.length ===
          0,
      )

    const topCustomers =
      sortByValue(
        customersWithWonSales.map(
          (item) => ({
            id: item.customer.id,
            value: item.revenue,
          }),
        ),
      )

    /*
     * Customer conversion signal.
     */
    const leadCustomers =
      customerPerformance.filter(
        (item) =>
          item.customer.status ===
          'lead',
      )

    const leadsWithWonSales =
      leadCustomers.filter(
        (item) =>
          item.wonSales.length >
          0,
      )

    /*
     * Customers with recorded
     * transactions but outstanding
     * payments.
     */
    const customersWithOutstandingPayments =
      customerPerformance.filter(
        (item) =>
          item.outstandingSales
            .length > 0,
      )

    const decisions: Decision[] =
      []

    /*
     * 1. Lead pipeline.
     */
    if (leads.length > 0) {
      decisions.push({
        id: 'lead-pipeline',
        type: 'opportunity',
        title:
          'Lead pipeline needs follow-up',
        message: `${leads.length} lead${
          leads.length === 1
            ? ''
            : 's'
        } are currently recorded in the customer pipeline.`,
        priority:
          leads.length >= 10
            ? 'high'
            : 'medium',
        action:
          'Review the lead list and follow up with the highest-value prospects.',
        evidence: {
          leads:
            leads.length,
          customers:
            customers.length,
        },
      })
    }

    /*
     * 2. Pending opportunities.
     */
    if (
      pendingSales.length > 0
    ) {
      decisions.push({
        id: 'pending-sales',
        type: 'attention',
        title:
          'Sales are still pending',
        message: `${pendingSales.length} sale${
          pendingSales.length ===
          1
            ? ''
            : 's'
        } have not reached a won or lost outcome.`,
        priority:
          pendingSales.length >=
          5
            ? 'high'
            : 'medium',
        action:
          'Review pending sales and update the next step for each opportunity.',
        evidence: {
          pendingSales:
            pendingSales.length,
          totalSales:
            sales.length,
        },
      })
    }

    /*
     * 3. Outstanding payments.
     */
    if (
      unpaidSales.length > 0
    ) {
      decisions.push({
        id: 'unpaid-sales',
        type: 'attention',
        title:
          'Outstanding payments require review',
        message: `${unpaidSales.length} sale${
          unpaidSales.length ===
          1
            ? ''
            : 's'
        } are unpaid or partially paid.`,
        priority:
          unpaidSales.length >=
          5
            ? 'high'
            : 'medium',
        action:
          'Review payment status and follow up on outstanding customer balances.',
        evidence: {
          unpaidSales:
            unpaidSales.length,
          affectedCustomers:
            customersWithOutstandingPayments.length,
        },
      })
    }

    /*
     * 4. Confirmed revenue.
     */
    if (wonSales.length > 0) {
      const averageSale =
        revenue /
        wonSales.length

      decisions.push({
        id: 'revenue-signal',
        type: 'signal',
        title:
          'Revenue activity is confirmed',
        message: `${wonSales.length} won sale${
          wonSales.length ===
          1
            ? ''
            : 's'
        } currently contribute ${currency} ${revenue.toLocaleString()} in recorded revenue.`,
        priority: 'low',
        action:
          'Use confirmed sales activity to identify which customers and services should receive more attention.',
        evidence: {
          wonSales:
            wonSales.length,
          revenue,
          averageSale:
            Math.round(
              averageSale *
                100,
            ) / 100,
        },
      })
    }

    /*
     * 5. Top service signal.
     *
     * Only generated when there
     * is actual transaction evidence.
     */
    if (
      topServices.length > 0
    ) {
      const topServiceId =
        topServices[0].id

      const topService =
        servicePerformance.find(
          (item) =>
            item.service.id ===
            topServiceId,
        )

      if (topService) {
        decisions.push({
          id: 'top-service',
          type: 'signal',
          title:
            'A service is generating confirmed sales',
          message: `${topService.service.name} has ${topService.wonSales.length} won sale${
            topService.wonSales.length ===
            1
              ? ''
              : 's'
          } and ${currency} ${topService.revenue.toLocaleString()} in recorded revenue.`,
          priority: 'low',
          action:
            'Review this service’s customers, pricing and delivery capacity before expanding its activity.',
          evidence: {
            service:
              topService.service.name,
            wonSales:
              topService.wonSales.length,
            revenue:
              topService.revenue,
            unitsSold:
              topService.unitsSold,
          },
        })
      }
    }

    /*
     * 6. Services with no transaction
     * evidence.
     */
    if (
      servicesWithoutSales.length >
      0
    ) {
      decisions.push({
        id: 'services-without-sales',
        type: 'opportunity',
        title:
          'Some services have no sales evidence',
        message: `${servicesWithoutSales.length} configured service${
          servicesWithoutSales.length ===
          1
            ? ''
            : 's'
        } currently have no recorded sales.`,
        priority:
          servicesWithoutSales.length >=
          5
            ? 'medium'
            : 'low',
        action:
          'Review whether these services are actively offered and record sales against them when transactions occur.',
        evidence: {
          servicesWithoutSales:
            servicesWithoutSales.length,
          totalServices:
            services.length,
        },
      })
    }

    /*
     * 7. Customers without transactions.
     */
    if (
      customers.length > 0 &&
      customersWithoutSales.length >
        0
    ) {
      decisions.push({
        id: 'customers-without-sales',
        type: 'opportunity',
        title:
          'Customers have no recorded sales',
        message: `${customersWithoutSales.length} customer${
          customersWithoutSales.length ===
          1
            ? ''
            : 's'
        } currently have no associated sales records.`,
        priority:
          customersWithoutSales.length >=
          10
            ? 'medium'
            : 'low',
        action:
          'Review these customer records and confirm whether they are prospects, inactive accounts or customers whose transactions have not yet been recorded.',
        evidence: {
          customersWithoutSales:
            customersWithoutSales.length,
          totalCustomers:
            customers.length,
        },
      })
    }

    /*
     * 8. Lead conversion evidence.
     */
    if (
      leadCustomers.length >
        0 &&
      leadsWithWonSales.length >
        0
    ) {
      decisions.push({
        id: 'lead-conversion',
        type: 'signal',
        title:
          'Lead conversion activity is visible',
        message: `${leadsWithWonSales.length} recorded lead${
          leadsWithWonSales.length ===
          1
            ? ''
            : 's'
        } has at least one won sale connected to the customer record.`,
        priority: 'low',
        action:
          'Review converted leads to identify common services and customer patterns.',
        evidence: {
          leads:
            leadCustomers.length,
          convertedLeads:
            leadsWithWonSales.length,
        },
      })
    }

    /*
     * 9. Customers with multiple
     * services.
     */
    const repeatServiceCustomers =
      customersWithWonSales.filter(
        (item) =>
          item.servicesPurchased >
          1,
      )

    if (
      repeatServiceCustomers.length >
      0
    ) {
      decisions.push({
        id: 'multi-service-customers',
        type: 'opportunity',
        title:
          'Some customers use multiple services',
        message: `${repeatServiceCustomers.length} customer${
          repeatServiceCustomers.length ===
          1
            ? ''
            : 's'
        } have confirmed purchases across more than one service.`,
        priority: 'low',
        action:
          'Review these customer relationships for cross-service opportunities and retention patterns.',
        evidence: {
          customers:
            repeatServiceCustomers.length,
          servicesPerCustomer:
            Math.max(
              ...repeatServiceCustomers.map(
                (item) =>
                  item.servicesPurchased,
              ),
            ),
        },
      })
    }

    /*
     * 10. No won sales yet.
     */
    if (
      activeCustomers.length >
        0 &&
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
          wonSales:
            wonSales.length,
        },
      })
    }

    /*
     * 11. Services exist but no
     * transactions connect them.
     */
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
          services:
            services.length,
          wonSales:
            wonSales.length,
        },
      })
    }

    /*
     * 12. Lost sales signal.
     */
    if (
      lostSales.length > 0
    ) {
      decisions.push({
        id: 'lost-sales',
        type: 'attention',
        title:
          'Lost sales should be reviewed',
        message: `${lostSales.length} sale${
          lostSales.length ===
          1
            ? ''
            : 's'
        } are currently marked as lost.`,
        priority:
          lostSales.length >=
          5
            ? 'medium'
            : 'low',
        action:
          'Review lost opportunities for recurring service, customer or sales-process patterns.',
        evidence: {
          lostSales:
            lostSales.length,
          totalSales:
            sales.length,
        },
      })
    }

    /*
     * Final fallback.
     */
    if (
      decisions.length === 0
    ) {
      decisions.push({
        id: 'build-evidence',
        type: 'signal',
        title:
          'Build the evidence base',
        message:
          'There is not enough operational activity to produce a meaningful business decision signal yet.',
        priority: 'low',
        action:
          'Add customers and record services and sales so TechUnified can analyze real business activity.',
        evidence: {
          customers:
            customers.length,
          services:
            services.length,
          sales:
            sales.length,
        },
      })
    }

    return NextResponse.json({
      ok: true,

      generatedAt:
        new Date().toISOString(),

      summary: {
        customers:
          customers.length,

        leads:
          leads.length,

        activeCustomers:
          activeCustomers.length,

        services:
          services.length,

        servicesWithWonSales:
          servicesWithWonSales.length,

        servicesWithoutSales:
          servicesWithoutSales.length,

        sales:
          sales.length,

        wonSales:
          wonSales.length,

        pendingSales:
          pendingSales.length,

        lostSales:
          lostSales.length,

        unpaidSales:
          unpaidSales.length,

        customersWithWonSales:
          customersWithWonSales.length,

        customersWithoutSales:
          customersWithoutSales.length,

        revenue,

        currency,
      },

      relationships: {
        topService:
          topServices.length > 0
            ? servicePerformance.find(
                (item) =>
                  item.service.id ===
                  topServices[0].id,
              )?.service.name ??
              null
            : null,

        topCustomerRevenue:
          topCustomers.length > 0
            ? topCustomers[0].value
            : 0,

        convertedLeads:
          leadsWithWonSales.length,

        multiServiceCustomers:
          repeatServiceCustomers.length,
      },

      decisions,

      methodology:
        'Decisions are derived only from organization-scoped Customers, Services, and Sales records. Relationships are calculated from recorded customer_id and service_id links. No missing business values are invented. Revenue is not converted between currencies.',
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
