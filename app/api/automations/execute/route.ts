import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeAutomation } from "@/lib/automation/engine";

const MAX_REQUEST_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { success: false, error: "Automation request is too large" },
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
        { success: false, error: "Authentication required" },
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
        { success: false, error: "Organization not found" },
        { status: 403 }
      );
    }

    const rawBody = await request.text();

    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { success: false, error: "Automation request is too large" },
        { status: 413 }
      );
    }

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
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { success: false, error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;
    const workflowId =
      typeof payload.workflowId === "string"
        ? payload.workflowId.trim()
        : "";

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: "workflowId is required" },
        { status: 400 }
      );
    }

    if (workflowId.length > 200) {
      return NextResponse.json(
        { success: false, error: "Invalid workflowId" },
        { status: 400 }
      );
    }

    if (
      payload.input !== undefined &&
      (
        !payload.input ||
        typeof payload.input !== "object" ||
        Array.isArray(payload.input)
      )
    ) {
      return NextResponse.json(
        { success: false, error: "input must be a JSON object" },
        { status: 400 }
      );
    }

    const input = (payload.input ?? {}) as Record<string, unknown>;

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
          error: "Automation execution failed. Check execution history for details.",
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
        error: "Automation execution failed. Check execution history for details.",
      },
      { status: 500 }
    );
  }
}
