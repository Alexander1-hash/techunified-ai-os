import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";

type SearchResult = {
  id: string;
  title: string;
  description?: string;
  type: string;
  href: string;
};

function cleanQuery(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function escapeIlike(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, "\\,");
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { profile, error: profileError } =
      await getCurrentProfile(supabase);

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          error: profileError.message,
        },
        { status: 401 },
      );
    }

    const organizationId = profile?.organization_id;

    if (!organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: "Organization not found.",
        },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const query = cleanQuery(searchParams.get("q"));

    if (!query) {
      return NextResponse.json({
        success: true,
        results: [],
      });
    }

    const escapedQuery = escapeIlike(query);
    const pattern = `%${escapedQuery}%`;

    const [
      customersResponse,
      servicesResponse,
      salesResponse,
      departmentsResponse,
      workflowsResponse,
    ] = await Promise.all([
      supabase
        .from("customers")
        .select(
          "id,name,email,phone,company_name,status,source,notes",
        )
        .eq("organization_id", organizationId)
        .or(
          `name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},company_name.ilike.${pattern},status.ilike.${pattern},source.ilike.${pattern}`,
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(8),

      supabase
        .from("services")
        .select(
          "id,name,slug,description,category,status",
        )
        .eq("organization_id", organizationId)
        .or(
          `name.ilike.${pattern},slug.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},status.ilike.${pattern}`,
        )
        .order("sort_order", {
          ascending: true,
        })
        .limit(8),

      supabase
        .from("sales")
        .select(
          "id,status,payment_status,notes",
        )
        .eq("organization_id", organizationId)
        .or(
          `status.ilike.${pattern},payment_status.ilike.${pattern},notes.ilike.${pattern}`,
        )
        .order("sale_date", {
          ascending: false,
        })
        .limit(8),

      supabase
        .from("departments")
        .select(
          "id,name,slug,description",
        )
        .eq("organization_id", organizationId)
        .or(
          `name.ilike.${pattern},slug.ilike.${pattern},description.ilike.${pattern}`,
        )
        .order("sort_order", {
          ascending: true,
        })
        .limit(8),

      supabase
        .from("workflows")
        .select(
          "id,name,description,status",
        )
        .eq("organization_id", organizationId)
        .or(
          `name.ilike.${pattern},description.ilike.${pattern},status.ilike.${pattern}`,
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(8),
    ]);

    const firstError =
      customersResponse.error ??
      servicesResponse.error ??
      salesResponse.error ??
      departmentsResponse.error ??
      workflowsResponse.error;

    if (firstError) {
      return NextResponse.json(
        {
          success: false,
          error: firstError.message,
        },
        { status: 500 },
      );
    }

    const results: SearchResult[] = [];

    for (const customer of customersResponse.data ?? []) {
      results.push({
        id: customer.id,
        title: customer.name,
        description:
          customer.company_name ||
          customer.email ||
          customer.phone ||
          customer.status ||
          undefined,
        type: "customer",
        href: "/customers",
      });
    }

    for (const service of servicesResponse.data ?? []) {
      results.push({
        id: service.id,
        title: service.name,
        description:
          service.description ||
          service.category ||
          service.status ||
          undefined,
        type: "service",
        href: "/services",
      });
    }

    for (const sale of salesResponse.data ?? []) {
      results.push({
        id: sale.id,
        title: `Sale ${sale.id.slice(0, 8)}`,
        description:
          sale.notes ||
          `${sale.status} · ${sale.payment_status}`,
        type: "sale",
        href: "/sales",
      });
    }

    for (const department of departmentsResponse.data ?? []) {
      results.push({
        id: department.id,
        title: department.name,
        description:
          department.description ||
          department.slug ||
          undefined,
        type: "department",
        href: "/departments",
      });
    }

    for (const workflow of workflowsResponse.data ?? []) {
      results.push({
        id: workflow.id,
        title: workflow.name,
        description:
          workflow.description ||
          workflow.status ||
          undefined,
        type: "workflow",
        href: "/workflows",
      });
    }

    return NextResponse.json({
      success: true,
      query,
      results: results.slice(0, 30),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Search failed.",
      },
      { status: 500 },
    );
  }
}
