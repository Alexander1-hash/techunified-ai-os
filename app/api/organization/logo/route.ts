import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";

const BUCKET = "organization-logos";
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(request: Request) {
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

  const formData = await request.formData();
  const file = formData.get("logo");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Please choose a logo file." },
      { status: 400 },
    );
  }

  if (!MIME_TO_EXTENSION[file.type]) {
    return NextResponse.json(
      { error: "Logo must be a PNG, JPG, or WebP image." },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Logo must be smaller than 2 MB." },
      { status: 400 },
    );
  }

  const extension = MIME_TO_EXTENSION[file.type];
  const path = `${organizationId}/logo-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .update({ logo_url: publicUrl })
    .eq("id", organizationId)
    .select(
      "id, name, description, industry, website, timezone, plan, logo_url, created_at, updated_at",
    )
    .single();

  if (organizationError) {
    await supabase.storage.from(BUCKET).remove([path]);

    return NextResponse.json(
      { error: organizationError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ organization });
}
