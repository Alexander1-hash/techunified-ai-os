import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";
import { assessWorkforceTask, type WorkforceTaskInput } from "@/lib/workforce/task-triage";

const ROLES = ["owner", "admin", "organization_admin", "manager", "recruiter", "hiring_manager"];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { profile } = await getCurrentProfile(supabase);
    if (!profile?.id || !profile.organization_id) {
      return NextResponse.json({ error: "Sign in with an organization account to assess a task." }, { status: 401 });
    }
    if (!ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Your account role cannot run workforce assessments." }, { status: 403 });
    }
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Provide a task description." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    if (typeof input.task !== "string" || input.task.trim().length < 10 || input.task.length > 3000) {
      return NextResponse.json({ error: "Task description must be between 10 and 3,000 characters." }, { status: 400 });
    }
    const assessment = assessWorkforceTask({
      task: input.task,
      industry: typeof input.industry === "string" ? input.industry : undefined,
      frequency: input.frequency as WorkforceTaskInput["frequency"],
      dataSensitivity: input.dataSensitivity as WorkforceTaskInput["dataSensitivity"],
      errorImpact: input.errorImpact as WorkforceTaskInput["errorImpact"],
      requiresPhysicalPresence: input.requiresPhysicalPresence === true,
      requiresLicensedJudgment: input.requiresLicensedJudgment === true,
      requiresEmpathyOrNegotiation: input.requiresEmpathyOrNegotiation === true,
    });
    return NextResponse.json(
      { success: true, assessment, mode: "rule_based_planning_only", organizationScoped: true },
      { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } }
    );
  } catch {
    return NextResponse.json({ error: "Unable to assess this task right now." }, { status: 500, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}
