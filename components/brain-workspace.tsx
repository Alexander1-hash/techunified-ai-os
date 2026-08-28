'use client'

import { useEffect, useState } from 'react'
import { Brain, Send, Upload, FileText, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { askCompanyBrain } from '@/lib/brain/service'
import { listKnowledgeDocuments, uploadKnowledgeDocument } from '@/lib/repositories/knowledge'
import type { BrainAnswer, ConversationMessage, KnowledgeDocument } from '@/lib/brain/types'

const suggested = ['What are our current products?', 'What is our pricing?', 'Summarize our sales process.', 'What are our brand guidelines?', 'What are our current priorities?']

export function BrainWorkspace() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [answer, setAnswer] = useState<BrainAnswer | null>(null)
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { listKnowledgeDocuments().then(({ data, error }) => { if (error) setError(error.message); setDocuments(data) }) }, [])

  async function ask(question = input) {
    if (!question.trim() || busy) return
    setBusy(true); setError(''); setMessages((current) => [...current, { role: 'user', content: question }]); setInput('')
    try { const result = await askCompanyBrain(question); setAnswer(result); setMessages((current) => [...current, { role: 'assistant', content: result.answer, citations: result.citations }]) } catch { setError('Company Brain could not complete the request. Please try again.') } finally { setBusy(false) }
  }

  async function upload(file: File) {
    setUploading(true); setError('')
    try { const { data: { user } } = await createClient().auth.getUser(); if (!user) throw new Error('Your session has expired. Please sign in again.'); const record = await uploadKnowledgeDocument(file, user.id, null); if (record) setDocuments((current) => [record, ...current]) } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.') } finally { setUploading(false) }
  }

  return <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
    <section className="flex min-h-[560px] flex-col rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b p-5"><div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Brain size={18} /></div><div><h2 className="font-medium">Ask the Company Brain</h2><p className="text-xs text-muted-foreground">Grounded in your organization&apos;s indexed knowledge</p></div></div>
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-5">{messages.length === 0 && <div className="rounded-xl bg-muted p-4 text-sm leading-6">Your Company Brain is ready. Ask a question or upload a document to begin building organizational context.</div>}{messages.map((message, index) => <div key={index} className={`max-w-[85%] rounded-xl p-4 text-sm leading-6 ${message.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted'}`}>{message.content}</div>)}{busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={16} />Retrieving relevant knowledge...</div>}{answer?.citations.length ? <div className="rounded-lg border bg-muted/30 p-3 text-xs"><p className="mb-2 font-medium">Sources</p>{answer.citations.map((citation) => <p key={citation.documentId} className="mb-1 text-muted-foreground">{citation.documentName}{citation.department ? ` · ${citation.department}` : ''}</p>)}</div> : answer?.demo && <p className="text-xs text-muted-foreground">Demo response: no indexed source was available.</p>}</div>
      <div className="flex flex-wrap gap-2 px-5 pb-3">{suggested.map((question) => <button key={question} onClick={() => ask(question)} className="rounded-full border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary">{question}</button>)}</div>
      {error && <p role="alert" className="px-5 pb-3 text-sm text-destructive">{error}</p>}
      <div className="m-5 mt-0 flex items-end gap-2 rounded-xl border bg-muted/40 p-2"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); ask() } }} placeholder="Ask anything about your company..." className="min-h-10 flex-1 resize-none bg-transparent p-2 text-sm outline-none" /><button onClick={() => ask()} disabled={busy} className="rounded-lg bg-primary p-2.5 text-primary-foreground disabled:opacity-50" aria-label="Send"><Send size={16} /></button></div>
    </section>
    <aside className="rounded-xl border bg-card p-5"><div className="flex items-center justify-between"><div><h2 className="font-medium">Knowledge sources</h2><p className="text-xs text-muted-foreground">Private to your organization</p></div><label className="cursor-pointer rounded-lg border p-2 text-primary hover:bg-primary/10" aria-label="Upload document"><input className="sr-only" type="file" accept=".pdf,.docx,.txt,.csv,.xlsx" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file) }} /><Upload size={16} /></label></div>{uploading && <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="animate-spin" size={14} />Uploading and preparing document...</p>}<div className="mt-5 flex flex-col gap-3">{documents.length ? documents.map((document) => <div key={document.id} className="flex items-center gap-3 rounded-lg border p-3"><FileText size={16} className="text-primary" /><div className="min-w-0"><p className="truncate text-sm">{document.name}</p><p className="text-xs text-muted-foreground">{document.status}</p></div></div>) : <p className="text-sm text-muted-foreground">No knowledge documents yet. Upload PDF, DOCX, TXT, CSV, or XLSX files.</p>}</div></aside>
  </div>
}
