import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeAutomation } from "@/lib/automation/engine";

type RouteContext = {
  params: Promise<{
    workflowId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { workflowId } = await context.params;

    if (!workflowId) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow ID is required",
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

    let input: Record<string, unknown> = {};

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await request.json();

      if (
        body &&
        typeof body === "object" &&
        !Array.isArray(body)
      ) {
        input = body as Record<string, unknown>;
      } else {
        input = {
          data: body,
        };
      }
    } else {
      const text = await request.text();

      input = {
        body: text,
      };
    }

    const result = await executeAutomation(
      workflowId,
      profile.organization_id,
      {
        type: "webhook_received",
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
        : "Webhook execution failed";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
