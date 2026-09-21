import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";

const CUSTOMER_STATUSES = [
  "lead",
  "prospect",
  "customer",
  "inactive",
] as const;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function clean(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function isValidStatus(value: string) {
  return CUSTOMER_STATUSES.includes(
    value as (typeof CUSTOMER_STATUSES)[number]
  );
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Customer ID is required." },
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

    const { data: existingCustomer, error: existingError } =
      await supabase
        .from("customers")
        .select(
          "id,organization_id,name,email,phone,company_name,status,source,notes,metadata,created_at,updated_at"
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

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      const name = String(body.name ?? "").trim();

      if (!name) {
        return NextResponse.json(
          { error: "Customer name is required." },
          { status: 400 }
        );
      }

      updateData.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(body, "email")) {
      updateData.email = clean(body.email);
    }

    if (Object.prototype.hasOwnProperty.call(body, "phone")) {
      updateData.phone = clean(body.phone);
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "company_name"
      )
    ) {
      updateData.company_name = clean(body.company_name);
    }

    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      const status = String(body.status ?? "")
        .trim()
        .toLowerCase();

      if (!isValidStatus(status)) {
        return NextResponse.json(
          { error: "Invalid customer status." },
          { status: 400 }
        );
      }

      updateData.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(body, "source")) {
      updateData.source = clean(body.source);
    }

    if (Object.prototype.hasOwnProperty.call(body, "notes")) {
      updateData.notes = clean(body.notes);
    }

    if (Object.prototype.hasOwnProperty.call(body, "metadata")) {
      if (
        body.metadata === null ||
        (typeof body.metadata === "object" &&
          !Array.isArray(body.metadata))
      ) {
        updateData.metadata = body.metadata ?? {};
      } else {
        return NextResponse.json(
          { error: "Metadata must be an object." },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("customers")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", organizationId)
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

    return NextResponse.json({
      success: true,
      customer: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update customer.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Customer ID is required." },
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

    const { data: existingCustomer, error: existingError } =
      await supabase
        .from("customers")
        .select("id")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer deleted successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete customer.",
      },
      { status: 500 }
    );
  }
}
