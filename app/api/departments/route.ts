import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
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

    const { data, error } = await supabase
      .from("departments")
      .select(
        "id,organization_id,name,slug,description,icon,is_active,sort_order,created_at"
      )
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      departments: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load departments.",
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
        { error: "Department name is required." },
        { status: 400 }
      );
    }

    const description = String(
      body.description ?? ""
    ).trim();

    const icon = String(body.icon ?? "").trim();

    const requestedSlug = String(
      body.slug ?? ""
    ).trim();

    const slug = slugify(requestedSlug || name);

    if (!slug) {
      return NextResponse.json(
        { error: "A valid department name is required." },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("departments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error:
            "A department with this name already exists.",
        },
        { status: 409 }
      );
    }

    const { data: latest } = await supabase
      .from("departments")
      .select("sort_order")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder =
      Number(latest?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from("departments")
      .insert({
        organization_id: organizationId,
        name,
        slug,
        description: description || null,
        icon: icon || null,
        is_active: true,
        sort_order: nextSortOrder,
      })
      .select(
        "id,organization_id,name,slug,description,icon,is_active,sort_order,created_at"
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
        department: data,
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
            : "Failed to create department.",
      },
      { status: 500 }
    );
  }
}
