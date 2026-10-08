import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";
import { executeAutomation } from "@/lib/automation/engine";

type ActionRunInput = {
  decision?: {
    id?: string;
    type?: string;
    title?: string;
    evidence?: Record<string, unknown>;
  };
  workflowId?: string;
  input?: Record<string, unknown>;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { profile } = await getCurrentProfile(supabase);

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("business_action_runs")
      .select(
        "id,decision_id,decision_type,decision_title,workflow_id,execution_id,status,input,evidence,output,error_message,started_at,completed_at,created_at,updated_at"
      )
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ ok: true, actionRuns: data ?? [] });
  } catch (error) {
    console.error("[Business Action Runs] GET failed:", error);
    return NextResponse.json({ error: "Unable to load action runs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { profile } = await getCurrentProfile(supabase);
    const organizationId = profile?.organization_id;
    const userId = profile?.id;

    if (!organizationId || !userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as ActionRunInput | null;
    const workflowId = body?.workflowId?.trim();

    if (!workflowId) {
      return NextResponse.json({ error: "workflowId is required." }, { status: 400 });
    }

    const decision = body?.decision ?? {};
    const input =
      body?.input && typeof body.input === "object" && !Array.isArray(body.input)
        ? body.input
        : {};

    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("id,name,status")
      .eq("id", workflowId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (workflowError) throw workflowError;

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    }

    if (String(workflow.status).toLowerCase() !== "active") {
      return NextResponse.json(
        { error: "The selected workflow must be active before an action can run." },
        { status: 409 },
      );
    }

    const startedAt = new Date().toISOString();

    const { data: actionRun, error: insertError } = await supabase
      .from("business_action_runs")
      .insert({
        organization_id: organizationId,
        created_by: userId,
        decision_id: decision.id?.trim() || null,
        decision_type: decision.type?.trim() || null,
        decision_title: decision.title?.trim() || null,
        workflow_id: workflow.id,
        status: "running",
        input,
        evidence:
          decision.evidence &&
          typeof decision.evidence === "object" &&
          !Array.isArray(decision.evidence)
            ? decision.evidence
            : {},
        started_at: startedAt,
      })
      .select("id")
      .single();

    if (insertError || !actionRun) {
      throw insertError ?? new Error("Unable to create action run.");
    }

    const result = await executeAutomation(workflow.id, organizationId, {
      type: "decision",
      input: {
        ...input,
        decision: {
          id: decision.id ?? null,
          type: decision.type ?? null,
          title: decision.title ?? null,
          evidence: decision.evidence ?? {},
        },
        actionRunId: actionRun.id,
      },
    });

    if (!result.success) {
      await supabase
        .from("business_action_runs")
        .update({
          status: "failed",
          execution_id: result.executionId ?? null,
          error_message: result.error ?? "Automation execution failed.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", actionRun.id)
        .eq("organization_id", organizationId);

      return NextResponse.json(
        {
          ok: false,
          actionRunId: actionRun.id,
          executionId: result.executionId ?? null,
          error: result.error ?? "Automation execution failed.",
        },
        { status: 400 },
      );
    }

    const { data: completedRun, error: updateError } = await supabase
      .from("business_action_runs")
      .update({
        status: "completed",
        execution_id: result.executionId ?? null,
        output: result.output ?? {},
        completed_at: new Date().toISOString(),
      })
      .eq("id", actionRun.id)
      .eq("organization_id", organizationId)
      .select(
        "id,decision_id,decision_type,decision_title,workflow_id,execution_id,status,input,evidence,output,error_message,started_at,completed_at,created_at,updated_at"
      )
      .single();

    if (updateError) throw updateError;

    return NextResponse.json(
      {
        ok: true,
        actionRun: completedRun,
        message:
          "Decision action executed. Record a measured or attributed outcome against this action run when evidence becomes available.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Business Action Runs] POST failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to execute business action." },
      { status: 500 },
    );
  }
}
