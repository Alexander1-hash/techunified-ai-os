import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import type { BrainAnswer, KnowledgeChunk } from './types'

const MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6-luna'

export async function askCompanyBrainServer(question: string): Promise<BrainAnswer> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Please sign in to use Company Brain.')
  const { data: profile, error: profileError } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
  if (profileError) throw new Error('Unable to resolve your organization.')
  if (!profile?.organization_id) return { answer: 'Company Brain is not connected to an organization yet. Add organizational context before asking questions.', citations: [], demo: false }

  const terms = question.trim().split(/\s+/).filter(Boolean).slice(0, 8).map((term) => term.replace(/[^\p{L}\p{N}_-]/gu, '')).filter(Boolean)
  if (!terms.length) return { answer: 'Ask a specific question about your organization.', citations: [], demo: false }
  const { data: chunks, error } = await supabase.from('knowledge_chunks').select('id,document_id,organization_id,content,chunk_index,metadata').eq('organization_id', profile.organization_id).textSearch('content', terms.join(' & ')).limit(5)
  if (error) throw new Error('Company Brain could not search indexed knowledge.')
  if (!chunks?.length) return { answer: 'Company Brain does not have enough relevant indexed knowledge to answer that question yet.', citations: [], demo: false }

  const documentIds = [...new Set(chunks.map((chunk) => chunk.document_id))]
  const { data: documents } = await supabase.from('knowledge_documents').select('id,name,metadata').eq('organization_id', profile.organization_id).in('id', documentIds)
  const names = new Map((documents ?? []).map((document) => [document.id, document]))
  const citations = chunks.map((chunk) => { const document = names.get(chunk.document_id); return { documentId: chunk.document_id, documentName: document?.name ?? 'Knowledge document', department: typeof document?.metadata?.department === 'string' ? document.metadata.department : null, excerpt: chunk.content.slice(0, 220) } })
  const context = chunks.map((chunk, index) => `[Source ${index + 1}] ${names.get(chunk.document_id)?.name ?? 'Knowledge document'}\n${chunk.content}`).join('\n\n')
  if (!process.env.OPENAI_API_KEY) return { answer: 'Relevant indexed knowledge was found, but the AI provider is not configured to generate an answer yet.', citations, demo: false }
  try {
    const response = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses.create({ model: MODEL, input: [{ role: 'developer', content: 'Answer only from the provided organization knowledge. If the sources do not support a claim, say so. Do not invent company facts. Cite sources inline as [Source N].' }, { role: 'user', content: `Question: ${question}\n\nOrganization knowledge:\n${context}` }] })
    return { answer: response.output_text || 'The AI provider returned an empty answer. Please try again.', citations, demo: false }
  } catch { throw new Error('Company Brain could not generate an answer right now.') }
}

export type { KnowledgeChunk }
