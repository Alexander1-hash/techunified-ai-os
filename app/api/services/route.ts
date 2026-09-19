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

export async function GET() {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)

    if (!profile?.organization_id) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('services')
      .select(
        'id, organization_id, department_id, name, slug, description, category, price, currency, billing_type, status, is_active, sort_order, metadata, created_at, updated_at',
      )
      .eq('organization_id', profile.organization_id)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      services: data ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load services',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)

    if (!profile?.organization_id) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 400 },
      )
    }

    const body = await request.json()

    const name =
      typeof body.name === 'string' ? body.name.trim() : ''

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Service name is required' },
        { status: 400 },
      )
    }

    const slug = slugify(name)

    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'A valid service name is required' },
        { status: 400 },
      )
    }

    const { data: existing, error: existingError } = await supabase
      .from('services')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('slug', slug)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'A service with this name already exists',
        },
        { status: 409 },
      )
    }

    let sortOrder = 0

    const { data: lastService, error: lastServiceError } = await supabase
      .from('services')
      .select('sort_order')
      .eq('organization_id', profile.organization_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastServiceError) {
      throw new Error(lastServiceError.message)
    }

    if (lastService?.sort_order !== undefined) {
      sortOrder = Number(lastService.sort_order) + 1
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

    const { data, error } = await supabase
      .from('services')
      .insert({
        organization_id: profile.organization_id,
        department_id:
          typeof body.department_id === 'string' &&
          body.department_id
            ? body.department_id
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
        currency:
          typeof body.currency === 'string' &&
          body.currency.trim()
            ? body.currency.trim().toUpperCase()
            : 'NGN',
        billing_type:
          typeof body.billing_type === 'string' &&
          ['one_time', 'monthly', 'yearly', 'custom'].includes(
            body.billing_type,
          )
            ? body.billing_type
            : 'one_time',
        status:
          typeof body.status === 'string' &&
          ['active', 'inactive', 'draft'].includes(body.status)
            ? body.status
            : 'active',
        is_active: body.is_active !== false,
        sort_order: sortOrder,
        metadata:
          body.metadata &&
          typeof body.metadata === 'object' &&
          !Array.isArray(body.metadata)
            ? body.metadata
            : {},
      })
      .select(
        'id, organization_id, department_id, name, slug, description, category, price, currency, billing_type, status, is_active, sort_order, metadata, created_at, updated_at',
      )
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json(
      {
        success: true,
        service: data,
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
            : 'Unable to create service',
      },
      { status: 500 },
    )
  }
}
