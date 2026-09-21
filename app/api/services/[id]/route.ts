import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parsePrice(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const price = Number(value)

  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Price must be a valid positive number')
  }

  return price
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { profile, error: profileError } =
      await getCurrentProfile(supabase)

    const { id } = await context.params

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

    const name =
      typeof body.name === 'string'
        ? body.name.trim()
        : ''

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Service name is required',
        },
        { status: 400 },
      )
    }

    const slug = slugify(name)

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: 'A valid service name is required',
        },
        { status: 400 },
      )
    }

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from('services')
      .select('id')
      .eq(
        'organization_id',
        profile.organization_id,
      )
      .eq('slug', slug)
      .neq('id', id)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error:
            'A service with this name already exists',
        },
        { status: 409 },
      )
    }

    let price: number | null

    try {
      price = parsePrice(body.price)
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Invalid price',
        },
        { status: 400 },
      )
    }

    const billingType =
      typeof body.billing_type === 'string' &&
      [
        'one_time',
        'monthly',
        'yearly',
        'custom',
      ].includes(body.billing_type)
        ? body.billing_type
        : 'one_time'

    const status =
      typeof body.status === 'string' &&
      ['active', 'inactive', 'draft'].includes(
        body.status,
      )
        ? body.status
        : 'active'

    const currency =
      typeof body.currency === 'string' &&
      body.currency.trim()
        ? body.currency.trim().toUpperCase()
        : 'NGN'

    const { data, error } = await supabase
      .from('services')
      .update({
        department_id:
          typeof body.department_id === 'string' &&
          body.department_id.trim()
            ? body.department_id.trim()
            : null,

        name,

        slug,

        description:
          typeof body.description === 'string'
            ? body.description.trim() || null
            : null,

        category:
          typeof body.category === 'string'
            ? body.category.trim() || null
            : null,

        price,

        currency,

        billing_type: billingType,

        status,

        is_active:
          body.is_active !== false,

        metadata:
          body.metadata &&
          typeof body.metadata === 'object' &&
          !Array.isArray(body.metadata)
            ? body.metadata
            : {},
      })
      .eq('id', id)
      .eq(
        'organization_id',
        profile.organization_id,
      )
      .select(
        'id, organization_id, department_id, name, slug, description, category, price, currency, billing_type, status, is_active, sort_order, metadata, created_at, updated_at',
      )
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Service not found',
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      service: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update service',
      },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { profile, error: profileError } =
      await getCurrentProfile(supabase)

    const { id } = await context.params

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
      .from('services')
      .delete()
      .eq('id', id)
      .eq(
        'organization_id',
        profile.organization_id,
      )
      .select('id')
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Service not found',
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
            : 'Unable to delete service',
      },
      { status: 500 },
    )
  }
}
