import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const { error: guidanceError } = await supabase.rpc(
    "ensure_workspace_guidance_for_current_user",
  );

  if (guidanceError && !guidanceError.message.toLowerCase().includes("does not exist")) {
    console.error("[inbox] guidance preparation failed:", guidanceError);
  }

  const { data: messages, error } = await supabase
    .from("workspace_messages")
    .select("id, organization_id, user_id, source, priority, title, body, action_label, action_href, status, metadata, created_at, read_at, dismissed_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[inbox] message fetch failed:", error);
    return NextResponse.json({ error: "We could not load your messages." }, { status: 500 });
  }

  const active = (messages ?? []).filter((message) =>
    !message.expires_at || new Date(message.expires_at).getTime() > Date.now()
  );

  return NextResponse.json({
    messages: active,
    unreadCount: active.filter((message) => message.status === "unread").length,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const messageBody = typeof body?.body === "string" ? body.body.trim() : "";

  if (!title || title.length > 160 || !messageBody || messageBody.length > 2000) {
    return NextResponse.json({ error: "Activity title or body is invalid." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ error: "Your workspace is not ready yet." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("workspace_messages")
    .insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      source: "activity",
      priority: "normal",
      title,
      body: messageBody,
      action_label: typeof body?.actionLabel === "string" ? body.actionLabel.trim().slice(0, 80) : null,
      action_href: typeof body?.actionHref === "string" ? body.actionHref.trim().slice(0, 300) : null,
      metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : {},
      dedupe_key: typeof body?.dedupeKey === "string" ? body.dedupeKey.trim().slice(0, 160) : null,
    })
    .select("id, organization_id, user_id, source, priority, title, body, action_label, action_href, status, metadata, created_at, read_at, dismissed_at, expires_at")
    .single();

  if (error) {
    console.error("[inbox] activity creation failed:", error);
    return NextResponse.json({ error: "We could not record the activity." }, { status: 500 });
  }

  return NextResponse.json({ message: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const action = body?.action;

  if (!id || !["read", "unread", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "Invalid message action." }, { status: 400 });
  }

  const patch =
    action === "read"
      ? { status: "read", read_at: new Date().toISOString() }
      : action === "unread"
        ? { status: "unread", read_at: null, dismissed_at: null }
        : { status: "dismissed", dismissed_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from("workspace_messages")
    .update(patch)
    .eq("id", id)
    .select("id, status, read_at, dismissed_at")
    .single();

  if (error) {
    console.error("[inbox] message update failed:", error);
    return NextResponse.json({ error: "We could not update the message." }, { status: 500 });
  }

  return NextResponse.json({ message: data });
}
