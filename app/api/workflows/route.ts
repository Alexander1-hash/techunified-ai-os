import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const workflowSelect =
  "id, name, description, status, created_at, updated_at";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        {
          success: false,
          error: authError.message,
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          error: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint,
        },
        { status: 500 }
      );
    }

    if (!profile?.organization_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Organization not found",
        },
        { status: 403 }
      );
    }

    const {
      data: workflows,
      error: workflowError,
    } = await supabase
      .from("workflows")
      .select(workflowSelect)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    if (workflowError) {
      return NextResponse.json(
        {
          success: false,
          error: workflowError.message,
          code: workflowError.code,
          details: workflowError.details,
          hint: workflowError.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      workflows: workflows ?? [],
    });
    } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load workflows",
      },
      { status: 500 }
    );
  }
}
