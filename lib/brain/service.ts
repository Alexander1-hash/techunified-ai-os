import { createClient } from '@/lib/supabase/client'
import type { BrainAnswer, ConversationMessage } from './types'

/**
 * Company Brain has one authoritative answer path: the authenticated server
 * endpoint. Never query knowledge_chunks from the browser or return a
 * placeholder answer that can be mistaken for generated intelligence.
 *
 * organizationId remains an optional compatibility argument for older callers.
 * The server resolves organization membership from the signed-in user instead.
 */
export async function askCompanyBrain(
  question: string,
  organizationId?: string | null,
): Promise<BrainAnswer> {
  void organizationId

  const normalizedQuestion = question.trim()
  if (!normalizedQuestion) {
    return {
      answer: 'Ask a specific question about your organization.',
      citations: [],
      demo: false,
    }
  }

  try {
    const response = await fetch('/api/brain/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: normalizedQuestion }),
      cache: 'no-store',
    })

    const payload = (await response.json().catch(() => null)) as
      | { answer?: unknown; citations?: unknown; demo?: unknown; error?: unknown }
      | null

    if (!response.ok) {
      const message =
        payload && typeof payload.error === 'string'
          ? payload.error
          : 'Company Brain could not complete the request. Please try again.'

      return { answer: message, citations: [], demo: false }
    }

    if (!payload || typeof payload.answer !== 'string' || !Array.isArray(payload.citations)) {
      return {
        answer: 'Company Brain returned an invalid response. Please try again.',
        citations: [],
        demo: false,
      }
    }

    return {
      answer: payload.answer,
      citations: payload.citations as BrainAnswer['citations'],
      demo: payload.demo === true,
    }
  } catch {
    return {
      answer: 'Company Brain is temporarily unavailable. Check your connection and try again.',
      citations: [],
      demo: false,
    }
  }
}

export async function saveConversationMessage(conversationId: string, message: ConversationMessage) {
  const { error } = await createClient().from('messages').insert({ conversation_id: conversationId, role: message.role, content: message.content, citations: message.citations ?? [] })
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw new Error(error.message)
}
