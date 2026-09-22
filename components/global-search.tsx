"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Search,
  UserRound,
  BriefcaseBusiness,
  ShoppingCart,
  Building2,
  Workflow,
  Bot,
  FileText,
  X,
  Loader2,
} from "lucide-react";

type SearchResult = {
  id: string;
  title: string;
  description?: string;
  type: string;
  href: string;
};

type SearchResponse = {
  results?: SearchResult[];
  error?: string;
};

const typeIcons: Record<
  string,
  typeof UserRound
> = {
  customer: UserRound,
  service: BriefcaseBusiness,
  sale: ShoppingCart,
  department: Building2,
  workflow: Workflow,
  agent: Bot,
  report: FileText,
};

function getResultIcon(type: string) {
  return typeIcons[type] ?? Search;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (
      event: PointerEvent,
    ) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
    };
  }, [open]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response = await fetch(
            `/api/search?q=${encodeURIComponent(
              trimmedQuery,
            )}`,
            {
              method: "GET",
              signal: controller.signal,
              cache: "no-store",
            },
          );

          const data =
            (await response.json()) as SearchResponse;

          if (!response.ok) {
            throw new Error(
              data.error ||
                "Unable to search right now.",
            );
          }

          setResults(
            Array.isArray(data.results)
              ? data.results
              : [],
          );
        } catch (searchError) {
          if (
            searchError instanceof DOMException &&
            searchError.name === "AbortError"
          ) {
            return;
          }

          setResults([]);
          setError(
            searchError instanceof Error
              ? searchError.message
              : "Unable to search right now.",
          );
        } finally {
          setLoading(false);
        }
      },
      250,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function openSearch() {
    setOpen(true);

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  function closeSearch() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setError("");
  }

  return (
    <div
      ref={searchRef}
      className="relative hidden sm:block"
    >
      {/* Search trigger */}
      {!open && (
        <button
          type="button"
          onClick={openSearch}
          className="flex h-10 w-[min(22rem,38vw)] items-center gap-3 rounded-lg border bg-muted/40 px-3 text-left text-sm text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Search anything"
        >
          <Search
            size={16}
            className="shrink-0"
          />

          <span className="flex-1 truncate">
            Search anything...
          </span>

          <kbd className="hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-block">
            Ctrl K
          </kbd>
        </button>
      )}

      {/* Search input */}
      {open && (
        <div className="relative">
          <div className="flex h-10 w-[min(28rem,50vw)] items-center gap-2 rounded-lg border bg-background px-3 shadow-sm ring-2 ring-primary/10">
            {loading ? (
              <Loader2
                size={16}
                className="shrink-0 animate-spin text-muted-foreground"
              />
            ) : (
              <Search
                size={16}
                className="shrink-0 text-muted-foreground"
              />
            )}

            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search customers, sales, services..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search TechUnified"
              autoComplete="off"
            />

            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Results */}
          {(query.trim() ||
            loading ||
            error) && (
            <div className="absolute right-0 top-12 z-50 w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl">
              {loading && (
                <div className="flex items-center gap-3 px-4 py-4 text-sm text-muted-foreground">
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Searching TechUnified...
                </div>
              )}

              {!loading &&
                error && (
                  <div className="px-4 py-4 text-sm text-destructive">
                    {error}
                  </div>
                )}

              {!loading &&
                !error &&
                query.trim() &&
                results.length === 0 && (
                  <div className="px-4 py-6 text-center">
                    <Search
                      size={22}
                      className="mx-auto text-muted-foreground"
                    />

                    <p className="mt-3 text-sm font-medium">
                      No results found
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Try another customer, service, sale,
                      department, or workflow.
                    </p>
                  </div>
                )}

              {!loading &&
                !error &&
                results.length > 0 && (
                  <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-2">
                    <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Search results
                    </div>

                    <div className="space-y-1">
                      {results.map((result) => {
                        const Icon =
                          getResultIcon(
                            result.type,
                          );

                        return (
                          <Link
                            key={`${result.type}-${result.id}`}
                            href={result.href}
                            onClick={closeSearch}
                            className="group flex items-center gap-3 rounded-lg px-3 py-3 transition hover:bg-muted"
                          >
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                              <Icon size={16} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium">
                                  {result.title}
                                </p>

                                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                                  {result.type}
                                </span>
                              </div>

                              {result.description && (
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {result.description}
                                </p>
                              )}
                            </div>

                            <ArrowRight
                              size={15}
                              className="shrink-0 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                            />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
