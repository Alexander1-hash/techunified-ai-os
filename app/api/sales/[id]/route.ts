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

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

function clean(value: unknown) {
  const result = String(value ?? '').trim()
  return result || null
}

function parseAmount(value: unknown) {
  if (value === null || value === undefined || value === '') {
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
  if (value === null || value === undefined || value === '') {
    return 1
  }

  const quantity = Number(value)

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(
      'Quantity must be a positive whole number',
    )
  }

  return quantity
}

function isSaleStatus(value: string) {
  return SALE_STATUSES.includes(
    value as (typeof SALE_STATUSES)[number],
  )
}

function isPaymentStatus(value: string) {
  return PAYMENT_STATUSES.includes(
    value as (typeof PAYMENT_STATUSES)[number],
  )
}

const SALE_SELECT =
  'id, organization_id, customer_id, service_id, amount, currency, quantity, status, payment_status, sale_date, notes, metadata, created_at, updated_at'

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sale ID is required',
        },
        { status: 400 },
      )
    }

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

    const organizationId = profile.organization_id

    const { data: existingSale, error: existingError } =
      await supabase
        .from('sales')
        .select(SALE_SELECT)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    if (!existingSale) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sale not found',
        },
        { status: 404 },
      )
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = {}

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'customer_id',
      )
    ) {
      const customerId = clean(body.customer_id)

      if (customerId) {
        const { data: customer, error: customerError } =
          await supabase
            .from('customers')
            .select('id')
            .eq('id', customerId)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (customerError) {
          throw new Error(customerError.message)
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
      }

      updateData.customer_id = customerId
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'service_id',
      )
    ) {
      const serviceId = clean(body.service_id)

      if (serviceId) {
        const { data: service, error: serviceError } =
          await supabase
            .from('services')
            .select('id')
            .eq('id', serviceId)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (serviceError) {
          throw new Error(serviceError.message)
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
      }

      updateData.service_id = serviceId
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'amount',
      )
    ) {
      try {
        updateData.amount = parseAmount(body.amount)
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
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'quantity',
      )
    ) {
      try {
        updateData.quantity = parseQuantity(
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
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'currency',
      )
    ) {
      const currency = clean(body.currency)

      if (!currency) {
        return NextResponse.json(
          {
            success: false,
            error: 'Currency is required',
          },
          { status: 400 },
        )
      }

      updateData.currency = currency.toUpperCase()
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'status',
      )
    ) {
      const status =
        typeof body.status === 'string'
          ? body.status.trim().toLowerCase()
          : ''

      if (!isSaleStatus(status)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid sale status',
          },
          { status: 400 },
        )
      }

      updateData.status = status
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'payment_status',
      )
    ) {
      const paymentStatus =
        typeof body.payment_status === 'string'
          ? body.payment_status.trim().toLowerCase()
          : ''

      if (!isPaymentStatus(paymentStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid payment status',
          },
          { status: 400 },
        )
      }

      updateData.payment_status = paymentStatus
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'sale_date',
      )
    ) {
      const saleDate = clean(body.sale_date)

      if (!saleDate || Number.isNaN(Date.parse(saleDate))) {
        return NextResponse.json(
          {
            success: false,
            error: 'Sale date must be a valid date',
          },
          { status: 400 },
        )
      }

      updateData.sale_date = saleDate
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'notes',
      )
    ) {
      updateData.notes = clean(body.notes)
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'metadata',
      )
    ) {
      if (
        body.metadata === null ||
        (typeof body.metadata === 'object' &&
          !Array.isArray(body.metadata))
      ) {
        updateData.metadata = body.metadata ?? {}
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Metadata must be an object',
          },
          { status: 400 },
        )
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid fields provided for update',
        },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('sales')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select(SALE_SELECT)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sale not found',
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      sale: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update sale',
      },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sale ID is required',
        },
        { status: 400 },
      )
    }

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

    const { data, error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select('id')
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sale not found',
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      deleted_id: data.id,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to delete sale',
      },
      { status: 500 },
    )
  }
}
