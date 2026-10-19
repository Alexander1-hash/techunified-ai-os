import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";
import { assessWorkforceTask, type WorkforceTaskInput } from "@/lib/workforce/task-triage";

const ROLES = ["owner", "admin", "organization_admin", "manager", "recruiter", "hiring_manager"];
const FREQUENCIES = ["once", "daily", "weekly", "monthly"] as const;
const SENSITIVITIES = ["public", "internal", "confidential", "regulated"] as const;
const IMPACTS = ["low", "medium", "high"] as const;
const MAX_BODY_BYTES = 12_288;

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function badRequest(error: string) {
  return NextResponse.json({ error }, {
    status: 400,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

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

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return badRequest("Request body is too large.");
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return badRequest("Request body could not be read.");
    }
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return badRequest("Request body is too large.");
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return badRequest("Request body must be valid JSON.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest("Provide a task description.");
    }

    const input = body as Record<string, unknown>;
    if (typeof input.task !== "string" || input.task.trim().length < 10 || input.task.length > 3000) {
      return badRequest("Task description must be between 10 and 3,000 characters.");
    }
    if (input.industry !== undefined && (typeof input.industry !== "string" || input.industry.length > 120)) {
      return badRequest("Industry must be text no longer than 120 characters.");
    }
    if (input.frequency !== undefined && !isOneOf(input.frequency, FREQUENCIES)) {
      return badRequest("Frequency must be once, daily, weekly, or monthly.");
    }
    if (input.dataSensitivity !== undefined && !isOneOf(input.dataSensitivity, SENSITIVITIES)) {
      return badRequest("Data sensitivity must be public, internal, confidential, or regulated.");
    }
    if (input.errorImpact !== undefined && !isOneOf(input.errorImpact, IMPACTS)) {
      return badRequest("Error impact must be low, medium, or high.");
    }
    if (
      !isOptionalBoolean(input.requiresPhysicalPresence) ||
      !isOptionalBoolean(input.requiresLicensedJudgment) ||
      !isOptionalBoolean(input.requiresEmpathyOrNegotiation)
    ) {
      return badRequest("Task risk flags must be boolean values.");
    }

    const assessmentInput: WorkforceTaskInput = {
      task: input.task,
      industry: typeof input.industry === "string" ? input.industry.trim() : undefined,
      frequency: input.frequency as WorkforceTaskInput["frequency"],
      dataSensitivity: input.dataSensitivity as WorkforceTaskInput["dataSensitivity"],
      errorImpact: input.errorImpact as WorkforceTaskInput["errorImpact"],
      requiresPhysicalPresence: input.requiresPhysicalPresence === true,
      requiresLicensedJudgment: input.requiresLicensedJudgment === true,
      requiresEmpathyOrNegotiation: input.requiresEmpathyOrNegotiation === true,
    };
    const assessment = assessWorkforceTask(assessmentInput);

    return NextResponse.json(
      { success: true, assessment, mode: "rule_based_planning_only", organizationScoped: true },
      { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to assess this task right now." },
      { status: 500, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }
}
