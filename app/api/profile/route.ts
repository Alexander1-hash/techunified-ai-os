import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";

export async function GET() {
  const supabase = await createClient();

  const result = await getCurrentProfile(supabase);

  if (!result.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    profile: result.profile,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const result = await getCurrentProfile(supabase);

  if (!result.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 500 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;

  if (
    "id" in payload ||
    "organization_id" in payload ||
    "role" in payload
  ) {
    return NextResponse.json(
      {
        error:
          "id, organization_id, and role cannot be changed here",
      },
      { status: 400 },
    );
  }

  const hasFullName = Object.prototype.hasOwnProperty.call(
    payload,
    "full_name",
  );

  const hasAvatarUrl = Object.prototype.hasOwnProperty.call(
    payload,
    "avatar_url",
  );

  if (!hasFullName && !hasAvatarUrl) {
    return NextResponse.json(
      {
        error:
          "Provide full_name or avatar_url to update the profile",
      },
      { status: 400 },
    );
  }

  let fullName: string | null | undefined;
  let avatarUrl: string | null | undefined;

  if (hasFullName) {
    if (
      payload.full_name !== null &&
      typeof payload.full_name !== "string"
    ) {
      return NextResponse.json(
        { error: "full_name must be a string or null" },
        { status: 400 },
      );
    }

    fullName =
      typeof payload.full_name === "string"
        ? payload.full_name.trim()
        : null;

    if (fullName && fullName.length > 120) {
      return NextResponse.json(
        {
          error:
            "full_name must be 120 characters or fewer",
        },
        { status: 400 },
      );
    }
  }

  if (hasAvatarUrl) {
    if (
      payload.avatar_url !== null &&
      typeof payload.avatar_url !== "string"
    ) {
      return NextResponse.json(
        { error: "avatar_url must be a string or null" },
        { status: 400 },
      );
    }

    avatarUrl =
      typeof payload.avatar_url === "string"
        ? payload.avatar_url.trim()
        : null;

    if (avatarUrl && avatarUrl.length > 1000) {
      return NextResponse.json(
        {
          error:
            "avatar_url must be 1000 characters or fewer",
        },
        { status: 400 },
      );
    }
  }

  const updates: {
    full_name?: string | null;
    avatar_url?: string | null;
  } = {};

  if (hasFullName) {
    updates.full_name = fullName ?? null;
  }

  if (hasAvatarUrl) {
    updates.avatar_url = avatarUrl ?? null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", result.user.id)
    .select(
      "id, organization_id, full_name, avatar_url, role, created_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    profile: data,
  });
}
