import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const workflowSelect =
  "id, name, description, status, created_at, updated_at";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication could not be verified.",
        },
        { status: 401 }
      );
    }

    if (!user) {
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

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify organization membership.",
        },
        { status: 500 }
      );
    }

    if (!profile?.organization_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Organization not found",
        },
        { status: 403 }
      );
    }

    const { data: workflows, error: workflowError } = await supabase
      .from("workflows")
      .select(workflowSelect)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    if (workflowError) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to load workflows.",
        },
        { status: 500 }
      );
    }

    const { data: intelligenceSnapshot, error: intelligenceError } = await supabase
      .from("company_intelligence_snapshots")
      .select("state,intelligence,captured_at")
      .eq("organization_id", profile.organization_id)
      .eq("snapshot_type", "company_state")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const intelligenceCore =
      !intelligenceError &&
      intelligenceSnapshot?.state &&
      typeof intelligenceSnapshot.state === "object" &&
      intelligenceSnapshot.state.intelligenceCore &&
      typeof intelligenceSnapshot.state.intelligenceCore === "object"
        ? intelligenceSnapshot.state.intelligenceCore
        : !intelligenceError &&
            intelligenceSnapshot?.intelligence &&
            typeof intelligenceSnapshot.intelligence === "object" &&
            intelligenceSnapshot.intelligence.intelligenceCore &&
            typeof intelligenceSnapshot.intelligence.intelligenceCore === "object"
          ? intelligenceSnapshot.intelligence.intelligenceCore
          : null;

    return NextResponse.json({
      success: true,
      workflows: workflows ?? [],
      intelligenceCore: intelligenceCore ?? { available: false },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load workflows.",
      },
      { status: 500 }
    );
  }
}
