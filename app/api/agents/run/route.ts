import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runGovernedAgent } from "@/lib/agents/runtime";

const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_AGENT_ID_LENGTH = 200;
const MAX_TASK_LENGTH = 8000;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: "Organization required." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId")?.trim();

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required." },
        { status: 400 }
      );
    }

    if (agentId.length > MAX_AGENT_ID_LENGTH) {
      return NextResponse.json(
        { error: "agentId is too long." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("agent_runs")
      .select("id,agent_id,task,status,autonomy_mode,requires_approval,approval_status,tool_calls,result,error_message,started_at,completed_at,created_at,updated_at")
      .eq("organization_id", profile.organization_id)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: "Unable to load agent runs." },
        { status: 500 }
      );
    }

    return NextResponse.json({ runs: data ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Unable to load agent runs." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(
      request.headers.get("content-length") ?? "0"
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_REQUEST_BYTES
    ) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const rawBody = await request.text();

    if (
      new TextEncoder().encode(rawBody).byteLength >
      MAX_REQUEST_BYTES
    ) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 }
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;
    const agentId =
      typeof payload.agentId === "string"
        ? payload.agentId.trim()
        : "";
    const task =
      typeof payload.task === "string"
        ? payload.task.trim()
        : "";

    if (!agentId || !task) {
      return NextResponse.json(
        { error: "agentId and task are required." },
        { status: 400 }
      );
    }

    if (agentId.length > MAX_AGENT_ID_LENGTH) {
      return NextResponse.json(
        { error: "agentId is too long." },
        { status: 400 }
      );
    }

    if (task.length > MAX_TASK_LENGTH) {
      return NextResponse.json(
        { error: "Task is too long." },
        { status: 400 }
      );
    }

    const result = await runGovernedAgent(
      agentId,
      task,
      user.id
    );

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to run agent. Check the agent run history for details." },
      { status: 500 }
    );
  }
}
