import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/repositories/profile";

const MAX_PAGES = 5;
const MAX_TEXT = 12000;
const TIMEOUT_MS = 12000;

function normalizeUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Only HTTPS websites can be monitored.");
  if (url.username || url.password) throw new Error("URLs with embedded credentials are not allowed.");
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "169.254.169.254"
  ) {
    throw new Error("Private or local network targets are not allowed.");
  }
  url.hash = "";
  return url;
}

function cleanText(html: string) {
  return html
    .replace(/<script[\\s\\S]*?<\\/script>/gi, " ")
    .replace(/<style[\\s\\S]*?<\\/style>/gi, " ")
    .replace(/<noscript[\\s\\S]*?<\\/noscript>/gi, " ")
    .replace(/<svg[\\s\\S]*?<\\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT);
}

function titleFrom(html: string) {
  return (html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)?.[1] ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function descriptionFrom(html: string) {
  return (
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ??
    ""
  ).trim().slice(0, 500);
}

function linksFrom(html: string, base: URL) {
  const links = new Set<string>();
  const pattern = /<a[^>]+href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && links.size < 20) {
    try {
      const target = new URL(match[1], base);
      target.hash = "";
      if (target.protocol === "https:" && target.origin === base.origin) links.add(target.toString());
    } catch {}
  }
  return [...links];
}

async function fetchText(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: { "user-agent": "TechUnified-WebIntelligence/1.0", accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The website returned an invalid redirect.");
      const redirected = normalizeUrl(new URL(location, url).toString());
      if (redirected.origin !== url.origin) throw new Error("Cross-domain redirects are not allowed.");
      return fetchText(redirected);
    }
    if (!response.ok) throw new Error(`Website returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("The target is not an HTML page.");
    }
    return { url, html: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

async function robotsAllows(base: URL, target: URL) {
  try {
    const robots = await fetch(new URL("/robots.txt", base), {
      cache: "no-store",
      headers: { "user-agent": "TechUnified-WebIntelligence/1.0" },
    });
    if (!robots.ok) return true;
    const body = await robots.text();
    let applies = false;
    let blocked = false;
    for (const raw of body.split(/\\r?\\n/)) {
      const line = raw.split("#")[0].trim();
      if (!line) continue;
      const [key, ...rest] = line.split(":");
      const value = rest.join(":").trim();
      if (key.toLowerCase() === "user-agent") applies = value === "*" || value.toLowerCase() === "techunified-webintelligence";
      if (applies && key.toLowerCase() === "disallow" && value) {
        const path = target.pathname;
        if (path.startsWith(value)) blocked = true;
      }
    }
    return !blocked;
  } catch {
    return true;
  }
}

async function crawl(start: URL) {
  const queue = [start];
  const seen = new Set<string>();
  const pages: Array<{ url: string; title: string; description: string; content: string; links: string[]; crawled_at: string }> = [];
  while (queue.length && pages.length < MAX_PAGES) {
    const current = queue.shift()!;
    const key = current.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!(await robotsAllows(start, current))) continue;
    const result = await fetchText(current);
    const links = linksFrom(result.html, start);
    pages.push({
      url: result.url.toString(),
      title: titleFrom(result.html) || result.url.hostname,
      description: descriptionFrom(result.html),
      content: cleanText(result.html),
      links,
      crawled_at: new Date().toISOString(),
    });
    for (const link of links) {
      if (!seen.has(link) && queue.length < 20) queue.push(normalizeUrl(link));
    }
  }
  return pages;
}

export async function GET() {
  const supabase = await createClient();
  const { profile, error } = await getCurrentProfile(supabase);
  if (error || !profile?.organization_id) return NextResponse.json({ error: "Organization context is required." }, { status: 401 });
  const { data, error: sourceError } = await supabase
    .from("business_data_sources")
    .select("id,name,provider,category,status,configuration_metadata,last_synced_at")
    .eq("organization_id", profile.organization_id)
    .eq("provider", "web")
    .order("updated_at", { ascending: false });
  if (sourceError) return NextResponse.json({ error: "Unable to load Web Intelligence sources." }, { status: 500 });
  return NextResponse.json({ sources: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { profile, error } = await getCurrentProfile(supabase);
    if (error || !profile?.organization_id) return NextResponse.json({ error: "Organization context is required." }, { status: 401 });
    const body = await request.json().catch(() => null);
    const rawUrl = body && typeof body.url === "string" ? body.url.trim() : "";
    if (!rawUrl) return NextResponse.json({ error: "Enter a website URL." }, { status: 400 });
    const start = normalizeUrl(rawUrl);
    const pages = await crawl(start);
    if (!pages.length) return NextResponse.json({ error: "No crawlable pages were found." }, { status: 422 });

    const baseUrl = start.origin;
    const { data: existing } = await supabase
      .from("business_data_sources")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("provider", "web")
      .eq("category", "web_intelligence")
      .eq("configuration_metadata->>base_url", baseUrl)
      .maybeSingle();

    const payload = {
      organization_id: profile.organization_id,
      name: start.hostname,
      provider: "web",
      category: "web_intelligence",
      status: "connected",
      configuration_metadata: {
        base_url: baseUrl,
        pages_crawled: pages.length,
        crawler: "TechUnified Web Intelligence",
        last_crawl: new Date().toISOString(),
      },
      last_synced_at: new Date().toISOString(),
    };

    const query = existing?.id
      ? supabase.from("business_data_sources").update(payload).eq("id", existing.id)
      : supabase.from("business_data_sources").insert(payload);
    const { data: source, error: sourceError } = await query
      .select("id,name,provider,category,status,configuration_metadata,last_synced_at")
      .single();
    if (sourceError || !source) throw new Error("The website was crawled but could not be registered as a Brain source.");

    const records = pages.map((page) => ({
      organization_id: profile.organization_id,
      source_id: source.id,
      record_key: page.url,
      payload: { ...page, source_type: "web" },
      recorded_at: page.crawled_at,
    }));
    const { error: recordError } = await supabase
      .from("business_source_records")
      .upsert(records, { onConflict: "source_id,record_key" });
    if (recordError) throw new Error("The website was crawled but its intelligence records could not be saved.");

    return NextResponse.json({ source, pagesCrawled: pages.length, pages: pages.map(({ content, ...page }) => page) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Web Intelligence crawl failed." },
      { status: 500 },
    );
  }
}
