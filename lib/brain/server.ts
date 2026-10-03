import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import type { BrainAnswer, KnowledgeChunk } from './types'

const MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6-luna'

const MAX_RESULTS = 5
const MAX_CONTEXT_CHARS = 18000
const MAX_WEB_RECORDS = 50
const MAX_OUTCOME_RECORDS = 50

function cleanSearchTerms(question: string): string[] {
  return question
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}_-]/gu, ''))
    .filter((term) => term.length >= 2)
    .slice(0, 10)
}

function buildCitations(
  chunks: KnowledgeChunk[],
  documents: Array<{
    id: string
    name: string
    metadata: Record<string, unknown> | null
  }>,
) {
  const documentMap = new Map(documents.map((document) => [document.id, document]))

  return chunks.map((chunk) => {
    const document = documentMap.get(chunk.document_id)

    const department =
      typeof document?.metadata?.department === 'string'
        ? document.metadata.department
        : null

    return {
      documentId: chunk.document_id,
      documentName: document?.name ?? 'Knowledge document',
      department,
      excerpt: chunk.content.slice(0, 220),
    }
  })
}

function buildContext(
  chunks: KnowledgeChunk[],
  documents: Array<{
    id: string
    name: string
    metadata: Record<string, unknown> | null
  }>,
) {
  const documentMap = new Map(documents.map((document) => [document.id, document]))

  let totalCharacters = 0

  const sections: string[] = []

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]
    const document = documentMap.get(chunk.document_id)

    const sourceName = document?.name ?? 'Knowledge document'

    const section =
      `[Source ${index + 1}] ${sourceName}\n` +
      chunk.content.trim()

    if (!section.trim()) continue

    if (totalCharacters + section.length > MAX_CONTEXT_CHARS) {
      const remaining = MAX_CONTEXT_CHARS - totalCharacters

      if (remaining > 200) {
        sections.push(section.slice(0, remaining))
      }

      break
    }

    sections.push(section)
    totalCharacters += section.length
  }

  return sections.join('\n\n')
}

async function searchWebIntelligence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  terms: string[],
) {
  const { data, error } = await supabase
    .from('business_source_records')
    .select('id,source_id,payload,recorded_at')
    .eq('organization_id', organizationId)
    .order('recorded_at', { ascending: false })
    .limit(MAX_WEB_RECORDS)

  if (error) return []

  const lowered = terms.map((term) => term.toLowerCase())
  return (data ?? [])
    .map((record) => {
      const payload =
        record.payload &&
        typeof record.payload === 'object' &&
        !Array.isArray(record.payload)
          ? (record.payload as Record<string, unknown>)
          : {}
      const text = [payload.title, payload.description, payload.content, payload.url]
        .filter((value) => typeof value === 'string')
        .join(' ')
        .toLowerCase()
      const score = lowered.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0)
      return { record, payload, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
}

async function searchBusinessOutcomes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  terms: string[],
) {
  const { data, error } = await supabase
    .from('business_outcomes')
    .select('id,title,outcome_type,baseline_value,current_value,unit,hours_saved,cost_avoided,revenue_impact,implementation_cost,currency,evidence_status,source,notes,period_start,period_end,created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(MAX_OUTCOME_RECORDS)

  if (error) return []

  const lowered = terms.map((term) => term.toLowerCase())
  return (data ?? [])
    .map((outcome) => {
      const text = [
        outcome.title,
        outcome.outcome_type,
        outcome.unit,
        outcome.source,
        outcome.notes,
        outcome.evidence_status,
      ]
        .filter((value) => typeof value === 'string')
        .join(' ')
        .toLowerCase()
      const score = lowered.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0)
      return { outcome, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
}

async function searchKnowledge(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  terms: string[],
) {
  const fullSearch = terms.join(' & ')

  const primary = await supabase
    .from('knowledge_chunks')
    .select(
      'id,document_id,organization_id,content,chunk_index,metadata',
    )
    .eq('organization_id', organizationId)
    .textSearch('content', fullSearch)
    .limit(MAX_RESULTS)

  if (primary.error) {
    throw new Error('Company Brain could not search indexed knowledge.')
  }

  if (primary.data?.length) {
    return primary.data as KnowledgeChunk[]
  }

  if (terms.length <= 1) {
    return []
  }

  const fallback = await supabase
    .from('knowledge_chunks')
    .select(
      'id,document_id,organization_id,content,chunk_index,metadata',
    )
    .eq('organization_id', organizationId)
    .textSearch('content', terms.join(' | '))
    .limit(MAX_RESULTS)

  if (fallback.error) {
    throw new Error('Company Brain could not search indexed knowledge.')
  }

  return (fallback.data ?? []) as KnowledgeChunk[]
}

export async function askCompanyBrainServer(
  question: string,
): Promise<BrainAnswer> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Please sign in to use Company Brain.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[Company Brain] Profile lookup failed:', profileError)
    throw new Error('Unable to resolve your organization.')
  }

  const organizationId = profile?.organization_id

  if (!organizationId) {
    return {
      answer:
        'Company Brain is not connected to an organization yet. Add organizational context before asking questions.',
      citations: [],
      demo: false,
    }
  }

  const normalizedQuestion = question.trim()

  if (!normalizedQuestion) {
    return {
      answer: 'Ask a specific question about your organization.',
      citations: [],
      demo: false,
    }
  }

  const terms = cleanSearchTerms(normalizedQuestion)

  if (!terms.length) {
    return {
      answer: 'Ask a specific question about your organization.',
      citations: [],
      demo: false,
    }
  }

  const chunks = await searchKnowledge(supabase, organizationId, terms)
  const webRecords = await searchWebIntelligence(supabase, organizationId, terms)
  const outcomeRecords = await searchBusinessOutcomes(supabase, organizationId, terms)

  if (!chunks.length && !webRecords.length && !outcomeRecords.length) {
    return {
      answer: 'Company Brain does not have enough relevant indexed knowledge to answer that question yet.',
      citations: [],
      demo: false,
    }
  }

  const documentIds = [...new Set(chunks.map((chunk) => chunk.document_id))]
  const { data: documents, error: documentsError } = documentIds.length
    ? await supabase
        .from('knowledge_documents')
        .select('id,name,metadata')
        .eq('organization_id', organizationId)
        .in('id', documentIds)
    : { data: [], error: null }

  if (documentsError) console.error('[Company Brain] Document lookup failed:', documentsError)

  const safeDocuments = (documents ?? []).map((document) => ({
    id: document.id,
    name: document.name,
    metadata:
      document.metadata && typeof document.metadata === 'object' && !Array.isArray(document.metadata)
        ? (document.metadata as Record<string, unknown>)
        : null,
  }))

  const knowledgeCitations = buildCitations(chunks, safeDocuments)
  const webCitations = webRecords.map(({ record, payload }) => ({
    documentId: record.id,
    documentName:
      typeof payload.title === 'string' && payload.title
        ? payload.title
        : typeof payload.url === 'string'
          ? payload.url
          : 'Web Intelligence source',
    department: null,
    excerpt:
      typeof payload.content === 'string'
        ? payload.content.slice(0, 220)
        : typeof payload.description === 'string'
          ? payload.description
          : '',
  }))
  const outcomeCitations = outcomeRecords.map(({ outcome }) => ({
    documentId: outcome.id,
    documentName: outcome.title,
    department: null,
    excerpt: `${outcome.evidence_status} outcome: ${outcome.cost_avoided} ${outcome.currency} cost avoided; ${outcome.revenue_impact} ${outcome.currency} revenue impact; ${outcome.hours_saved} hours saved.`,
  }))
  const citations = [...knowledgeCitations, ...webCitations, ...outcomeCitations]
  const knowledgeContext = buildContext(chunks, safeDocuments)
  const outcomeContext = outcomeRecords
    .map(({ outcome }, index) =>
      `[Business Outcome ${index + 1}] ${outcome.title}\n` +
      `Evidence status: ${outcome.evidence_status}\n` +
      `Outcome type: ${outcome.outcome_type}\n` +
      `Baseline: ${outcome.baseline_value ?? 'not recorded'} ${outcome.unit ?? ''}\n` +
      `Current: ${outcome.current_value ?? 'not recorded'} ${outcome.unit ?? ''}\n` +
      `Hours saved: ${outcome.hours_saved}\n` +
      `Cost avoided: ${outcome.cost_avoided} ${outcome.currency}\n` +
      `Revenue impact: ${outcome.revenue_impact} ${outcome.currency}\n` +
      `Implementation cost: ${outcome.implementation_cost} ${outcome.currency}\n` +
      `Evidence source: ${outcome.source ?? 'not specified'}\n` +
      `Period: ${outcome.period_start ?? 'not specified'} to ${outcome.period_end ?? 'not specified'}`,
    )
    .join('\\n\\n')
  const webContext = webRecords
    .map(({ payload }, index) => {
      const title = typeof payload.title === 'string' ? payload.title : 'Web page'
      const url = typeof payload.url === 'string' ? payload.url : ''
      const description = typeof payload.description === 'string' ? payload.description : ''
      const pageContent = typeof payload.content === 'string' ? payload.content : ''
      return `[Web Source ${index + 1}] ${title}\n${url}\n${description}\n${pageContent}`
    })
    .join('\n\n')
  const context = [knowledgeContext, outcomeContext, webContext].filter(Boolean).join('\n\n')

  if (!context.trim()) {
    return {
      answer:
        'Relevant knowledge was found, but there was no readable content available for this question.',
      citations,
      demo: false,
    }
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('AI provider configuration is missing.')
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  try {
    const response = await openai.responses.create({
      model: MODEL,
      input: [
        {
          role: 'developer',
          content:
            'You are Company Brain, an organizational intelligence assistant. ' +
            'Answer only from the organization knowledge and Web Intelligence supplied in the user message. ' +
            'Do not invent company facts, metrics, customers, policies, financial figures, ' +
            'or operational details. Treat public web information as external source material, ' +
            'not as confirmed internal company facts. If the supplied sources do not support an answer, ' +
            'say that the available company knowledge does not contain enough information. ' +
            'When using internal knowledge, cite it inline using [Source N]. When using business outcomes, cite them as [Business Outcome N]. When using web material, ' +
            'cite it as [Web Source N]. ' +
            'Business outcome evidence_status is authoritative: measured is directly observed, attributed is linked to an intervention with documented basis, and estimated is not verified. ' +
            'Never present estimated outcomes as measured results. Do not combine currencies. Do not claim ROI unless the supplied outcome data supports the calculation and its evidence status is stated. ' +
            'Keep the answer practical, clear, and concise.',
        },
        {
          role: 'user',
          content:
            `Question:\n${normalizedQuestion}\n\n` +
            `Organization knowledge:\n${context}`,
        },
      ],
    })

    const answer = response.output_text?.trim()

    if (!answer) {
      return {
        answer:
          'The AI provider returned an empty answer. Please try again.',
        citations,
        demo: false,
      }
    }

    return {
      answer,
      citations,
      demo: false,
    }
  } catch (error) {
    console.error('[Company Brain] AI generation failed:', error)

    throw new Error(
      'Company Brain could not generate an answer right now.',
    )
  }
}

export type { KnowledgeChunk }
