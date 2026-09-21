import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

const SALE_STATUSES = [
  'draft',
  'pending',
  'won',
  'lost',
  'cancelled',
] as const

const PAYMENT_STATUSES = [
  'unpaid',
  'partial',
  'paid',
  'refunded',
] as const

function clean(value: unknown) {
  const result = String(value ?? '').trim()
  return result || null
}

function parseAmount(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0
  }

  const amount = Number(value)

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(
      'Amount must be a valid non-negative number',
    )
  }

  return amount
}

function parseQuantity(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 1
  }

  const quantity = Number(value)

  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      'Quantity must be a positive whole number',
    )
  }

  return quantity
}

function isSaleStatus(
  value: string,
): value is (typeof SALE_STATUSES)[number] {
  return SALE_STATUSES.includes(
    value as (typeof SALE_STATUSES)[number],
  )
}

function isPaymentStatus(
  value: string,
): value is (typeof PAYMENT_STATUSES)[number] {
  return PAYMENT_STATUSES.includes(
    value as (typeof PAYMENT_STATUSES)[number],
  )
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { profile, error: profileError } =
      await getCurrentProfile(supabase)

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          error: profileError.message,
        },
        { status: 401 },
      )
    }

    if (!profile?.organization_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization not found',
        },
        { status: 400 },
      )
    }

    const { searchParams } =
      new URL(request.url)

    const status =
      searchParams.get('status')?.trim() ?? ''

    const paymentStatus =
      searchParams
        .get('payment_status')
        ?.trim() ?? ''

    const customerId =
      searchParams
        .get('customer_id')
        ?.trim() ?? ''

    const serviceId =
      searchParams
        .get('service_id')
        ?.trim() ?? ''

    let query = supabase
      .from('sales')
      .select(
        'id, organization_id, customer_id, service_id, amount, currency, quantity, status, payment_status, sale_date, notes, metadata, created_at, updated_at',
      )
      .eq(
        'organization_id',
        profile.organization_id,
      )
      .order('sale_date', {
        ascending: false,
      })

    if (status) {
      if (!isSaleStatus(status)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid sale status',
          },
          { status: 400 },
        )
      }

      query = query.eq('status', status)
    }

    if (paymentStatus) {
      if (!isPaymentStatus(paymentStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid payment status',
          },
          { status: 400 },
        )
      }

      query = query.eq(
        'payment_status',
        paymentStatus,
      )
    }

    if (customerId) {
      query = query.eq(
        'customer_id',
        customerId,
      )
    }

    if (serviceId) {
      query = query.eq(
        'service_id',
        serviceId,
      )
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      sales: data ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load sales',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { profile, error: profileError } =
      await getCurrentProfile(supabase)

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          error: profileError.message,
        },
        { status: 401 },
      )
    }

    if (!profile?.organization_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization not found',
        },
        { status: 400 },
      )
    }

    const body = await request.json()

    const customerId = clean(
      body.customer_id,
    )

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer is required',
        },
        { status: 400 },
      )
    }

    const serviceId = clean(
      body.service_id,
    )

    if (!serviceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Service is required',
        },
        { status: 400 },
      )
    }

    const { data: customer, error: customerError } =
      await supabase
        .from('customers')
        .select('id')
        .eq(
          'id',
          customerId,
        )
        .eq(
          'organization_id',
          profile.organization_id,
        )
        .maybeSingle()

    if (customerError) {
      throw new Error(
        customerError.message,
      )
    }

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Customer not found in this organization',
        },
        { status: 404 },
      )
    }

    const { data: service, error: serviceError } =
      await supabase
        .from('services')
        .select('id')
        .eq(
          'id',
          serviceId,
        )
        .eq(
          'organization_id',
          profile.organization_id,
        )
        .maybeSingle()

    if (serviceError) {
      throw new Error(
        serviceError.message,
      )
    }

    if (!service) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Service not found in this organization',
        },
        { status: 404 },
      )
    }

    let amount: number

    try {
      amount = parseAmount(body.amount)
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Invalid amount',
        },
        { status: 400 },
      )
    }

    let quantity: number

    try {
      quantity = parseQuantity(
        body.quantity,
      )
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Invalid quantity',
        },
        { status: 400 },
      )
    }

    const status =
      typeof body.status === 'string' &&
      isSaleStatus(
        body.status.trim().toLowerCase(),
      )
        ? body.status.trim().toLowerCase()
        : 'pending'

    const paymentStatus =
      typeof body.payment_status ===
        'string' &&
      isPaymentStatus(
        body.payment_status
          .trim()
          .toLowerCase(),
      )
        ? body.payment_status
            .trim()
            .toLowerCase()
        : 'unpaid'

    const currency =
      typeof body.currency === 'string' &&
      body.currency.trim()
        ? body.currency
            .trim()
            .toUpperCase()
        : 'NGN'

    const saleDate =
      typeof body.sale_date === 'string' &&
      body.sale_date.trim()
        ? body.sale_date.trim()
        : new Date().toISOString()

    const { data, error } = await supabase
      .from('sales')
      .insert({
        organization_id:
          profile.organization_id,

        customer_id: customerId,

        service_id: serviceId,

        amount,

        currency,

        quantity,

        status,

        payment_status: paymentStatus,

        sale_date: saleDate,

        notes: clean(body.notes),

        metadata:
          body.metadata &&
          typeof body.metadata === 'object' &&
          !Array.isArray(body.metadata)
            ? body.metadata
            : {},
      })
      .select(
        'id, organization_id, customer_id, service_id, amount, currency, quantity, status, payment_status, sale_date, notes, metadata, created_at, updated_at',
      )
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json(
      {
        success: true,
        sale: data,
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create sale',
      },
      { status: 500 },
    )
  }
}
