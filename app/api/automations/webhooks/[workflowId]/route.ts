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

    if (workflowId.length > 200) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow ID is too long",
        },
        { status: 400 }
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    const MAX_REQUEST_BYTES = 64 * 1024;

    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "Request body is too large",
        },
        { status: 413 }
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
    const rawBody = await request.text();

    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { success: false, error: "Request body is too large" },
        { status: 413 }
      );
    }

    if (contentType.toLowerCase().includes("application/json")) {
      let body: unknown;

      try {
        body = JSON.parse(rawBody);
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid JSON request body" },
          { status: 400 }
        );
      }

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
      input = {
        body: rawBody,
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
          error: "Webhook-triggered automation failed. Check execution history for details.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      executionId: result.executionId,
      output: result.output,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Webhook execution failed. Check the execution history for details.",
      },
      { status: 500 }
    );
  }
}
