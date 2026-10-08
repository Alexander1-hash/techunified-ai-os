"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, CircleAlert, Info, Sparkles } from "lucide-react"

type Message = {
  id: string
  source: "guidance" | "developer" | "system" | "ai" | "activity"
  priority: "low" | "normal" | "high" | "critical"
  title: string
  body: string
  action_label: string | null
  action_href: string | null
  status: "unread" | "read" | "dismissed"
  created_at: string
}

const labels = {
  guidance: "Guidance",
  developer: "TechUnified",
  system: "System",
  ai: "AI",
  activity: "Activity",
} as const

export function NotificationInbox({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<"all" | Message["source"]>("all")

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)

    fetch("/api/inbox", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load inbox")
        return response.json()
      })
      .then((payload) => {
        if (!cancelled) setMessages(payload.messages ?? [])
      })
      .catch(() => {
        if (!cancelled) setMessages([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const visible = useMemo(
    () => messages.filter((message) => message.status !== "dismissed" && (filter === "all" || message.source === filter)),
    [messages, filter],
  )

  const update = async (id: string, action: "read" | "dismiss") => {
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? { ...message, status: action === "read" ? "read" : "dismissed" }
          : message,
      ),
    )

    await fetch("/api/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    })
  }

  if (!open) return null

  return (
    <div className="absolute right-0 top-[calc(100%+8px)] z-[220] w-[min(420px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-[#303030] bg-[#171717] text-white shadow-2xl">
      <div className="border-b border-[#303030] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Workspace inbox</p>
            <p className="mt-1 text-xs leading-5 text-white/60">
              Guidance, TechUnified messages, AI signals, and your activity.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-white/50 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex gap-1 overflow-x-auto">
          {(["all", "guidance", "developer", "system", "ai", "activity"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={[
                "shrink-0 rounded-md px-2 py-1 text-[10px] font-medium",
                filter === item
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/60 hover:text-white",
              ].join(" ")}
            >
              {item === "all" ? "All" : labels[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[min(70vh,520px)] overflow-y-auto p-2">
        {loading ? (
          <div className="px-3 py-8 text-center text-xs text-white/50">
            Loading your workspace messages…
          </div>
        ) : visible.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <CheckCircle2 className="mx-auto size-5 text-white/40" />
            <p className="mt-2 text-sm font-medium">You’re all caught up.</p>
            <p className="mt-1 text-xs text-white/50">
              New guidance and workspace events will appear here.
            </p>
          </div>
        ) : (
          visible.map((message) => (
            <article
              key={message.id}
              className="mb-2 rounded-xl border border-white/10 bg-[#202020] p-3.5"
            >
              <div className="flex gap-3">
                <MessageIcon source={message.source} priority={message.priority} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">
                        {labels[message.source]}
                      </p>
                      <h3 className="mt-1 text-sm font-semibold">{message.title}</h3>
                    </div>
                    {message.status === "unread" && (
                      <span className="mt-1 size-2 rounded-full bg-teal-300" />
                    )}
                  </div>

                  <p className="mt-2 text-xs leading-5 text-white/65">
                    {message.body}
                  </p>

                  <div className="mt-3 flex items-center gap-2">
                    {message.action_href && message.action_label ? (
                      <Link
                        href={message.action_href}
                        onClick={() => {
                          void update(message.id, "read")
                          onClose()
                        }}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[11px] font-semibold text-black"
                      >
                        {message.action_label}
                        <ArrowRight size={13} />
                      </Link>
                    ) : null}

                    {message.status === "unread" && (
                      <button
                        onClick={() => void update(message.id, "read")}
                        className="text-[11px] text-white/50 hover:text-white"
                      >
                        Mark read
                      </button>
                    )}

                    <button
                      onClick={() => void update(message.id, "dismiss")}
                      className="ml-auto text-[11px] text-white/40 hover:text-white"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

function MessageIcon({
  source,
  priority,
}: Pick<Message, "source" | "priority">) {
  if (priority === "high" || priority === "critical") {
    return <CircleAlert className="mt-0.5 size-4 shrink-0" />
  }

  if (source === "ai") {
    return <Sparkles className="mt-0.5 size-4 shrink-0" />
  }

  if (source === "developer") {
    return <Info className="mt-0.5 size-4 shrink-0" />
  }

  return <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
}
