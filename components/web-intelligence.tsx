"use client";

import { useEffect, useState } from "react";
import { Globe2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

type Source = {
  id: string;
  name: string;
  provider: string;
  category: string;
  status: string;
  configuration_metadata: Record<string, unknown>;
  last_synced_at: string | null;
};

export function WebIntelligence() {
  const [url, setUrl] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/brain/web-intelligence", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load Web Intelligence.");
      setSources(result.sources ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load Web Intelligence.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function crawl() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/brain/web-intelligence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Crawl failed.");
      setMessage(`Web Intelligence indexed ${result.pagesCrawled} page(s) into Company Brain.`);
      setUrl("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Crawl failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Globe2 size={19} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Web Intelligence</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Bring permitted public web information into Company Brain. TechUnified follows same-origin links, respects robots.txt when directives match the crawler, limits each crawl to five pages, and keeps source provenance.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={15} className="text-primary" />
          Organization-scoped source records
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void crawl(); }}
          placeholder="https://example.com"
          className="min-h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50"
          inputMode="url"
        />
        <button
          type="button"
          onClick={() => void crawl()}
          disabled={busy || !url.trim()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Globe2 size={16} />}
          {busy ? "Crawling…" : "Crawl website"}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border px-3 text-muted-foreground hover:bg-muted"
          aria-label="Refresh Web Intelligence"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {sources.map((source) => (
          <div key={source.id} className="rounded-xl border border-border/60 bg-background p-3">
            <p className="truncate text-sm font-medium text-foreground">{source.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {String(source.configuration_metadata.pages_crawled ?? 0)} pages indexed · {source.last_synced_at ? new Date(source.last_synced_at).toLocaleString() : "Not synced"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
