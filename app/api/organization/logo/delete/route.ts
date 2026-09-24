import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";

const BUCKET = "organization-logos";

export async function DELETE() {
  const supabase = await createClient();
  const result = await getCurrentProfile(supabase);

  if (!result.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (result.error || !result.profile) {
    return NextResponse.json(
      { error: result.error?.message ?? "Profile not found" },
      { status: 500 },
    );
  }

  const organizationId =
    typeof result.profile.organization_id === "string"
      ? result.profile.organization_id
      : null;

  if (!organizationId) {
    return NextResponse.json(
      { error: "Your account is not connected to an organization." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("organizations")
    .update({ logo_url: null })
    .eq("id", organizationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
