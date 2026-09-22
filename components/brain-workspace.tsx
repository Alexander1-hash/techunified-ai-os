"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Brain,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  listKnowledgeDocuments,
  uploadKnowledgeDocument,
} from "@/lib/repositories/knowledge";

import type {
  BrainAnswer,
  ConversationMessage,
  KnowledgeDocument,
} from "@/lib/brain/types";

const suggestedQuestions = [
  "What are our current products?",
  "What is our pricing?",
  "Summarize our sales process.",
  "What are our brand guidelines?",
  "What are our current priorities?",
];

function statusIcon(status: KnowledgeDocument["status"]) {
  if (status === "Indexed") {
    return <CheckCircle2 size={14} />;
  }

  if (status === "Failed") {
    return <XCircle size={14} />;
  }

  return <Loader2 size={14} className="animate-spin" />;
}

function statusLabel(status: KnowledgeDocument["status"]) {
  if (status === "Indexed") return "Indexed";
  if (status === "Failed") return "Failed";
  return "Processing";
}

function formatFileType(fileType: string) {
  if (!fileType || fileType === "unknown") {
    return "Document";
  }

  if (fileType.includes("pdf")) return "PDF";
  if (fileType.includes("word") || fileType.includes("docx")) {
    return "DOCX";
  }
  if (fileType.includes("csv")) return "CSV";
  if (
    fileType.includes("sheet") ||
    fileType.includes("excel") ||
    fileType.includes("xlsx")
  ) {
    return "XLSX";
  }
  if (fileType.includes("text")) return "TXT";

  return fileType.split("/").pop()?.toUpperCase() || "FILE";
}

function formatFileSize(value: unknown) {
  if (typeof value !== "number" || value <= 0) {
    return "";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function CitationCard({
  citation,
}: {
  citation: NonNullable<BrainAnswer["citations"]>[number];
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText size={16} />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {citation.documentName}
          </p>

          {citation.department && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {citation.department}
            </p>
          )}
        </div>
      </div>

      {citation.excerpt && (
        <div className="mt-3 rounded-lg bg-muted/60 p-3">
          <p className="text-xs leading-5 text-muted-foreground">
            “{citation.excerpt}”
          </p>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
}: {
  message: ConversationMessage;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles size={15} />
        </div>
      )}

      <div
        className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border border-border/70 bg-card text-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>

      {isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-xs font-semibold text-foreground">
          You
        </div>
      )}
    </div>
  );
}

export function BrainWorkspace() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [answer, setAnswer] = useState<BrainAnswer | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [showSources, setShowSources] = useState(true);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  async function loadDocuments() {
    try {
      setLoadingDocuments(true);
      setError("");

      const result = await listKnowledgeDocuments();

      if (result.error) {
        throw result.error;
      }

      setDocuments(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load knowledge sources.",
      );
    } finally {
      setLoadingDocuments(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function ask(question = input) {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || busy) {
      return;
    }

    setBusy(true);
    setError("");
    setInput("");

    const userMessage: ConversationMessage = {
      role: "user",
      content: trimmedQuestion,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    try {
      const response = await fetch("/api/brain/query", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Company Brain could not complete the request.",
        );
      }

      const brainAnswer = result as BrainAnswer;

      setAnswer(brainAnswer);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: brainAnswer.answer,
          citations: brainAnswer.citations,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Company Brain could not complete the request.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await createClient().auth.getUser();

      if (!user) {
        throw new Error(
          "Your session has expired. Please sign in again.",
        );
      }

      const record = await uploadKnowledgeDocument(
        file,
        user.id,
        null,
      );

      if (record) {
        setDocuments((current) => [
          record,
          ...current.filter(
            (document) => document.id !== record.id,
          ),
        ]);
      } else {
        await loadDocuments();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Document upload failed.",
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const indexedDocuments = documents.filter(
    (document) => document.status === "Indexed",
  ).length;

  const processingDocuments = documents.filter(
    (document) => document.status === "Processing",
  ).length;

  return (
    <div className="min-h-[calc(100vh-2rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Brain size={18} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Company Intelligence
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Organizational knowledge layer
                  </p>
                </div>
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                Company Brain
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Ask questions about your company and get
                answers grounded in the organization&apos;s
                indexed knowledge.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Knowledge
                </p>

                <p className="mt-1 text-lg font-semibold text-foreground">
                  {indexedDocuments}
                </p>

                <p className="text-xs text-muted-foreground">
                  indexed sources
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Processing
                </p>

                <p className="mt-1 text-lg font-semibold text-foreground">
                  {processingDocuments}
                </p>

                <p className="text-xs text-muted-foreground">
                  documents
                </p>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p
              role="alert"
              className="text-sm leading-6 text-destructive"
            >
              {error}
            </p>

            <button
              type="button"
              onClick={() => setError("")}
              className="shrink-0 rounded-md p-1 text-destructive hover:bg-destructive/10"
              aria-label="Dismiss error"
            >
              <XCircle size={16} />
            </button>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="flex min-h-[650px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles size={17} />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Ask the Company Brain
                  </h2>

                  <p className="text-xs text-muted-foreground">
                    Grounded organizational answers
                  </p>
                </div>
              </div>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setAnswer(null);
                    setError("");
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  New conversation
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              {messages.length === 0 ? (
                <div className="flex min-h-[430px] items-center justify-center">
                  <div className="max-w-xl text-center">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border bg-muted/50 text-primary">
                      <Brain size={25} />
                    </div>

                    <h3 className="mt-5 text-xl font-semibold text-foreground">
                      Your company knowledge, in one place.
                    </h3>

                    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                      Ask about products, pricing, processes,
                      priorities, policies, or other information
                      contained in your indexed company knowledge.
                    </p>

                    <div className="mt-7 flex flex-wrap justify-center gap-2">
                      {suggestedQuestions.slice(0, 4).map(
                        (question) => (
                          <button
                            key={question}
                            type="button"
                            onClick={() => void ask(question)}
                            className="rounded-full border border-border/80 bg-background px-3.5 py-2 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                          >
                            {question}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={`${message.role}-${index}`}
                      message={message}
                    />
                  ))}

                  {busy && (
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Sparkles size={15} />
                      </div>

                      <div className="rounded-2xl rounded-bl-md border border-border/70 bg-card px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2
                            size={15}
                            className="animate-spin"
                          />
                          Retrieving relevant company knowledge…
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {answer?.citations?.length > 0 && (
              <div className="border-t border-border/70">
                <button
                  type="button"
                  onClick={() =>
                    setShowSources((current) => !current)
                  }
                  className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-muted/40"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Sources · {answer.citations.length}
                  </span>

                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform ${
                      showSources ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showSources && (
                  <div className="grid gap-3 px-5 pb-5 md:grid-cols-2">
                    {answer.citations.map(
                      (citation, index) => (
                        <CitationCard
                          key={`${citation.documentId}-${index}`}
                          citation={citation}
                        />
                      ),
                    )}
                  </div>
                )}
              </div>
            )}

            {answer?.demo && (
              <div className="border-t border-border/70 px-5 py-3">
                <p className="text-xs text-muted-foreground">
                  No indexed source was available for this
                  response.
                </p>
              </div>
            )}

            <div className="border-t border-border/70 p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-border/80 bg-muted/30 p-2 transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                <textarea
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      event.keyCode !== 229
                    ) {
                      event.preventDefault();
                      void ask();
                    }
                  }}
                  placeholder="Ask anything about your company…"
                  rows={1}
                  className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  disabled={busy}
                />

                <button
                  type="button"
                  onClick={() => void ask()}
                  disabled={busy || !input.trim()}
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send question"
                >
                  {busy ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <ArrowUp size={18} />
                  )}
                </button>
              </div>

              <p className="mt-2 px-2 text-[11px] text-muted-foreground">
                Press Enter to send · Shift + Enter for a new line
              </p>
            </div>
          </section>

          <aside className="h-fit overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Knowledge sources
                </h2>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Private to your organization
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadDocuments()}
                disabled={loadingDocuments}
                className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Refresh knowledge sources"
              >
                <RefreshCw
                  size={15}
                  className={
                    loadingDocuments
                      ? "animate-spin"
                      : ""
                  }
                />
              </button>
            </div>

            <div className="p-5">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-sm font-medium text-foreground transition hover:border-primary/50 hover:bg-primary/5">
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  accept=".pdf,.docx,.txt,.csv,.xlsx"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file) {
                      void upload(file);
                    }
                  }}
                />

                {uploading ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Preparing document…
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload knowledge
                  </>
                )}
              </label>

              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                PDF · DOCX · TXT · CSV · XLSX
              </p>

              <div className="mt-6">
                {loadingDocuments ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    <Loader2
                      size={16}
                      className="mr-2 animate-spin"
                    />
                    Loading sources…
                  </div>
                ) : documents.length ? (
                  <div className="space-y-2">
                    {documents.map((document) => {
                      const metadata =
                        document.metadata ?? {};

                      return (
                        <div
                          key={document.id}
                          className="rounded-xl border border-border/60 p-3.5 transition hover:bg-muted/30"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <FileText size={16} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p
                                className="truncate text-sm font-medium text-foreground"
                                title={document.name}
                              >
                                {document.name}
                              </p>

                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                                <span>
                                  {formatFileType(
                                    document.file_type,
                                  )}
                                </span>

                                {formatFileSize(
                                  metadata.size,
                                ) && (
                                  <>
                                    <span>·</span>
                                    <span>
                                      {formatFileSize(
                                        metadata.size,
                                      )}
                                    </span>
                                  </>
                                )}
                              </div>

                              <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                                {statusIcon(
                                  document.status,
                                )}

                                <span>
                                  {statusLabel(
                                    document.status,
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-5 text-center">
                    <FileText
                      size={22}
                      className="mx-auto text-muted-foreground"
                    />

                    <p className="mt-3 text-sm font-medium text-foreground">
                      No knowledge documents
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Upload company documents to start
                      building organizational context.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
