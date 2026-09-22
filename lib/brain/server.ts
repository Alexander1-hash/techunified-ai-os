import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import type { BrainAnswer, KnowledgeChunk } from './types'

const MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6-luna'

const MAX_RESULTS = 5
const MAX_CONTEXT_CHARS = 18000

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

  const chunks = await searchKnowledge(
    supabase,
    organizationId,
    terms,
  )

  if (!chunks.length) {
    return {
      answer:
        'Company Brain does not have enough relevant indexed knowledge to answer that question yet.',
      citations: [],
      demo: false,
    }
  }

  const documentIds = [
    ...new Set(chunks.map((chunk) => chunk.document_id)),
  ]

  const { data: documents, error: documentsError } = await supabase
    .from('knowledge_documents')
    .select('id,name,metadata')
    .eq('organization_id', organizationId)
    .in('id', documentIds)

  if (documentsError) {
    console.error(
      '[Company Brain] Document lookup failed:',
      documentsError,
    )
  }

  const safeDocuments = (documents ?? []).map((document) => ({
    id: document.id,
    name: document.name,
    metadata:
      document.metadata &&
      typeof document.metadata === 'object' &&
      !Array.isArray(document.metadata)
        ? (document.metadata as Record<string, unknown>)
        : null,
  }))

  const citations = buildCitations(chunks, safeDocuments)
  const context = buildContext(chunks, safeDocuments)

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
            'Answer only from the organization knowledge supplied in the user message. ' +
            'Do not invent company facts, metrics, customers, policies, financial figures, ' +
            'or operational details. If the supplied sources do not support an answer, ' +
            'say that the available company knowledge does not contain enough information. ' +
            'When using information from a source, cite it inline using [Source N]. ' +
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
