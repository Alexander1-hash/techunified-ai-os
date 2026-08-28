import { createClient } from '@/lib/supabase/client'
import type { BrainAnswer, ConversationMessage } from './types'

export async function askCompanyBrain(question: string, organizationId?: string | null): Promise<BrainAnswer> {
  const supabase = createClient()
  let query = supabase.from('knowledge_chunks').select('id,document_id,content,metadata').textSearch('content', question.split(/\s+/).slice(0, 4).join(' & ')).limit(5)
  if (organizationId) query = query.eq('organization_id', organizationId)
  const { data, error } = await query
  if (error || !data?.length) return { answer: 'No indexed knowledge matched this question yet. Upload and index company documents to ground Company Brain responses.', citations: [], demo: true }
  return { answer: `I found ${data.length} relevant knowledge ${data.length === 1 ? 'chunk' : 'chunks'}. A generation provider can now use this retrieved context to answer: “${question}”`, citations: data.map((row) => ({ documentId: row.document_id, documentName: String(row.metadata?.document_name ?? 'Knowledge document'), department: row.metadata?.department ? String(row.metadata.department) : null, excerpt: row.content.slice(0, 180) })), demo: true }
}

export async function saveConversationMessage(conversationId: string, message: ConversationMessage) {
  const { error } = await createClient().from('messages').insert({ conversation_id: conversationId, role: message.role, content: message.content, citations: message.citations ?? [] })
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw new Error(error.message)
}
