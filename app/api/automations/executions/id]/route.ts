import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Execution ID is required",
        },
        { status: 400 }
      );
    }

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

    const { data: execution, error: executionError } = await supabase
      .from("automation_executions")
      .select(
        `
          id,
          organization_id,
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
            name,
            description,
            status
          )
        `
      )
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (executionError) {
      return NextResponse.json(
        {
          success: false,
          error: executionError.message,
        },
        { status: 500 }
      );
    }

    if (!execution) {
      return NextResponse.json(
        {
          success: false,
          error: "Execution not found",
        },
        { status: 404 }
      );
    }

    const { data: steps, error: stepsError } = await supabase
      .from("automation_execution_steps")
      .select(
        `
          id,
          execution_id,
          step_id,
          step_type,
          status,
          input,
          output,
          error_message,
          started_at,
          completed_at,
          created_at
        `
      )
      .eq("execution_id", id)
      .order("created_at", { ascending: true });

    if (stepsError) {
      return NextResponse.json(
        {
          success: false,
          error: stepsError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      execution,
      steps: steps ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load automation execution";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
        }
