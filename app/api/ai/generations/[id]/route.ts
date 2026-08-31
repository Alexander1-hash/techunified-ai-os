import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGenerationStatus } from '@/lib/ai/inference'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to view this generation.' }, { status: 401 })

  const { data: job, error } = await supabase.from('generations').select('id,type,mode,prompt,model,status,provider,result_url,thumbnail_url,aspect_ratio,duration,quality,credits_used,credits_reserved,created_at,completed_at,worker_job_id,error_message').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (error || !job) return NextResponse.json({ error: 'Generation not found.' }, { status: 404 })
  if (!['queued', 'processing'].includes(job.status)) return NextResponse.json(job)

  try {
    const result = await getGenerationStatus(job.id, job.worker_job_id ?? undefined)
    if (result.status === job.status) return NextResponse.json(job)
    const now = new Date().toISOString()
    if (result.status === 'failed' || result.status === 'cancelled') {
      await supabase.rpc('refund_generation_credits', { p_user_id: user.id, p_generation_id: job.id, p_amount: job.credits_reserved, p_description: 'Generation failed; reserved credits refunded' })
    } else if (result.status === 'completed') {
      await supabase.rpc('finalize_generation_credits', { p_user_id: user.id, p_generation_id: job.id, p_amount: job.credits_reserved, p_description: 'Completed generation usage' })
    }
    const update = { status: result.status, result_url: result.outputUrl ?? null, thumbnail_url: result.thumbnailUrl ?? null, completed_at: result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled' ? now : null, error_message: result.error ?? (result.status === 'failed' ? 'Video generation failed. Your credits have been refunded.' : null), credits_used: result.status === 'completed' ? job.credits_reserved : 0 }
    const { data: updated } = await supabase.from('generations').update(update).eq('id', job.id).eq('user_id', user.id).select('id,type,mode,prompt,model,status,provider,result_url,thumbnail_url,aspect_ratio,duration,quality,credits_used,credits_reserved,created_at,completed_at,worker_job_id,error_message').single()
    return NextResponse.json(updated ?? { ...job, ...update })
  } catch {
    return NextResponse.json({ error: 'Generation status is temporarily unavailable.' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
