import { createClient } from '@/lib/supabase/client'
import type { KnowledgeDocument } from '@/lib/brain/types'

const tableMissing = (error: { code?: string } | null) => error?.code === '42P01' || error?.code === 'PGRST205'

export async function listKnowledgeDocuments(): Promise<{ data: KnowledgeDocument[]; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.from('knowledge_documents').select('id,name,file_type,storage_path,department_id,status,metadata,uploaded_by,created_at').order('created_at', { ascending: false })
  if (error && !tableMissing(error)) return { data: [], error: new Error(error.message) }
  return { data: (data ?? []) as KnowledgeDocument[], error: null }
}

export async function uploadKnowledgeDocument(file: File, userId: string, organizationId: string | null) {
  const supabase = createClient()
  const path = `${organizationId ?? 'unassigned'}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
  const upload = await supabase.storage.from('company-knowledge').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (upload.error) throw new Error(upload.error.message)
  const record = await supabase.from('knowledge_documents').insert({ name: file.name, file_type: file.type || 'unknown', storage_path: path, status: 'Processing', metadata: { size: file.size }, uploaded_by: userId, organization_id: organizationId }).select('id,name,file_type,storage_path,department_id,status,metadata,uploaded_by,created_at').single()
  if (record.error && !tableMissing(record.error)) throw new Error(record.error.message)
  return record.data as KnowledgeDocument | null
}
