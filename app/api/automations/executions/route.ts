import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Organization not found",
        },
        { status: 403 }
      );
    }

    const { data: executions, error: executionsError } = await supabase
      .from("automation_executions")
      .select(
        `
          id,
          workflow_id,
          trigger_type,
          status,
          input,
          output,
          error_message,
          started_at,
          completed_at,
          created_at,
          workflows (
            id,
            name
          )
        `
      )
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (executionsError) {
      return NextResponse.json(
        {
          success: false,
          error: executionsError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      executions: executions ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load automation executions";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
