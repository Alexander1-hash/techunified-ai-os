import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";

const CUSTOMER_STATUSES = [
  "lead",
  "prospect",
  "customer",
  "inactive",
] as const;

function clean(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { profile } = await getCurrentProfile(supabase);

    const organizationId = profile?.organization_id;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";

    let query = supabase
      .from("customers")
      .select(
        "id,organization_id,name,email,phone,company_name,status,source,notes,metadata,created_at,updated_at"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (status) {
      if (
        !CUSTOMER_STATUSES.includes(
          status as (typeof CUSTOMER_STATUSES)[number]
        )
      ) {
        return NextResponse.json(
          { error: "Invalid customer status." },
          { status: 400 }
        );
      }

      query = query.eq("status", status);
    }

    if (search) {
      const escapedSearch = search
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/,/g, "\\,");

      query = query.or(
        `name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%,phone.ilike.%${escapedSearch}%,company_name.ilike.%${escapedSearch}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      customers: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load customers.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { profile } = await getCurrentProfile(supabase);

    const organizationId = profile?.organization_id;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const name = String(body.name ?? "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 }
      );
    }

    const status = String(
      body.status ?? "lead"
    )
      .trim()
      .toLowerCase();

    if (
      !CUSTOMER_STATUSES.includes(
        status as (typeof CUSTOMER_STATUSES)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Invalid customer status." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({
        organization_id: organizationId,
        name,
        email: clean(body.email),
        phone: clean(body.phone),
        company_name: clean(body.company_name),
        status,
        source: clean(body.source),
        notes: clean(body.notes),
        metadata:
          body.metadata &&
          typeof body.metadata === "object" &&
          !Array.isArray(body.metadata)
            ? body.metadata
            : {},
      })
      .select(
        "id,organization_id,name,email,phone,company_name,status,source,notes,metadata,created_at,updated_at"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        customer: data,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create customer.",
      },
      { status: 500 }
    );
  }
}
