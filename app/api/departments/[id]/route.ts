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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Department ID is required." },
        { status: 400 }
      );
    }

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

    const { data: existing, error: existingError } = await supabase
      .from("departments")
      .select(
        "id,organization_id,name,slug,description,icon,is_active,sort_order,created_at"
      )
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Department not found." },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();

      if (!name) {
        return NextResponse.json(
          { error: "Department name is required." },
          { status: 400 }
        );
      }

      updates.name = name;
    }

    if (body.description !== undefined) {
      const description = String(body.description ?? "").trim();
      updates.description = description || null;
    }

    if (body.icon !== undefined) {
      const icon = String(body.icon ?? "").trim();
      updates.icon = icon || null;
    }

    if (body.slug !== undefined || body.name !== undefined) {
      const requestedSlug =
        body.slug !== undefined
          ? String(body.slug ?? "").trim()
          : String(updates.name ?? existing.name).trim();

      const slug = slugify(requestedSlug);

      if (!slug) {
        return NextResponse.json(
          { error: "A valid department name is required." },
          { status: 400 }
        );
      }

      updates.slug = slug;
    }

    if (body.is_active !== undefined) {
      updates.is_active = Boolean(body.is_active);
    }

    if (body.sort_order !== undefined) {
      const sortOrder = Number(body.sort_order);

      if (!Number.isInteger(sortOrder)) {
        return NextResponse.json(
          { error: "sort_order must be an integer." },
          { status: 400 }
        );
      }

      updates.sort_order = sortOrder;
    }

    if (updates.slug) {
      const { data: duplicate, error: duplicateError } =
        await supabase
          .from("departments")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("slug", updates.slug)
          .neq("id", id)
          .maybeSingle();

      if (duplicateError) {
        return NextResponse.json(
          { error: duplicateError.message },
          { status: 500 }
        );
      }

      if (duplicate) {
        return NextResponse.json(
          {
            error:
              "A department with this name already exists.",
          },
          { status: 409 }
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        success: true,
        department: existing,
      });
    }

    const { data, error } = await supabase
      .from("departments")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", organizationId)
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

    return NextResponse.json({
      success: true,
      department: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update department.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Department ID is required." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { profile } = await getCurrentProfile(supabase);

    const organizationId = profile?.organization_id;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("departments")
      .select("id,name")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Department not found." },
        { status: 404 }
      );
    }

    const { count: serviceCount, error: serviceError } =
      await supabase
        .from("services")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("organization_id", organizationId)
        .eq("department_id", id);

    if (serviceError) {
      return NextResponse.json(
        { error: serviceError.message },
        { status: 500 }
      );
    }

    if ((serviceCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "This department cannot be deleted while services are assigned to it. Reassign or remove those services first.",
          service_count: serviceCount,
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await supabase
      .from("departments")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Department deleted successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete department.",
      },
      { status: 500 }
    );
  }
}
