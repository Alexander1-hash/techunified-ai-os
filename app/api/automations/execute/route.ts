import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeAutomation } from "@/lib/automation/engine";

export async function POST(request: NextRequest) {
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

    const body = await request.json();

    const workflowId =
      typeof body?.workflowId === "string"
        ? body.workflowId
        : "";

    if (!workflowId) {
      return NextResponse.json(
        {
          success: false,
          error: "workflowId is required",
        },
        { status: 400 }
      );
    }

    const input =
      body?.input &&
      typeof body.input === "object" &&
      !Array.isArray(body.input)
        ? body.input
        : {};

    const result = await executeAutomation(
      workflowId,
      profile.organization_id,
      {
        type: "manual",
        input,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          executionId: result.executionId,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      executionId: result.executionId,
      output: result.output,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Automation execution failed";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
