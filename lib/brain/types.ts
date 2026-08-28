export type KnowledgeStatus = 'Processing' | 'Indexed' | 'Failed'

export interface KnowledgeDocument {
  id: string
  name: string
  file_type: string
  storage_path: string
  department_id: string | null
  status: KnowledgeStatus
  metadata: Record<string, unknown>
  uploaded_by: string
  created_at: string
}

export interface KnowledgeChunk { id: string; document_id: string; organization_id: string; content: string; chunk_index: number; metadata: Record<string, unknown> }
export interface BrainCitation { documentId: string; documentName: string; department: string | null; excerpt: string }
export interface BrainAnswer { answer: string; citations: BrainCitation[]; demo: boolean }
export interface ConversationMessage { id?: string; role: 'user' | 'assistant'; content: string; citations?: BrainCitation[]; created_at?: string }
