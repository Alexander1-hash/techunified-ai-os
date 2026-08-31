import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { creditCost, models, type GenerationRequest, type GenerationType, type Quality } from '@/lib/ai/types'
import { enqueueGeneration, workerConfigured } from '@/lib/ai/inference'

const MAX_PROMPT_LENGTH = 4000

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to generate.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body.prompt !== 'string' || body.prompt.trim().length < 3) {
    return NextResponse.json({ error: 'Describe your generation in at least 3 characters.' }, { status: 400 })
  }
  if (body.prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer.` }, { status: 400 })
  }

  if (!workerConfigured && body.type !== 'image') {
    return NextResponse.json({ success: false, error: 'Real video generation is not configured yet.' }, { status: 503 })
  }

  const type: GenerationType = body.type === 'image' ? 'image' : 'video'
  const model = models.find((item) => item.type === type)
  const quality: Quality = body.quality === 'high' ? 'high' : 'standard'
  const duration = type === 'video' && body.duration === 10 ? 10 : type === 'video' ? 5 : undefined
  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.length <= 120 ? body.idempotencyKey : crypto.randomUUID()
  const requestData: GenerationRequest = {
    type,
    mode: body.mode ?? (type === 'video' ? 'text-to-video' : 'text-to-image'),
    prompt: body.prompt.trim(),
    model: model?.id ?? (type === 'video' ? 'our-video-model' : 'our-image-model'),
    aspectRatio: body.aspectRatio === '9:16' || body.aspectRatio === '1:1' ? body.aspectRatio : '16:9',
    duration,
    quality,
    idempotencyKey,
  }
  const cost = creditCost(requestData)

  const { data: existing } = await supabase.from('generations').select('id,status,credits_reserved').eq('user_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle()
  if (existing) return NextResponse.json({ success: true, generationId: existing.id, jobId: existing.id, status: existing.status, cost: existing.credits_reserved ?? cost, duplicate: true })

  const { data: created, error: createError } = await supabase.from('generations').insert({ user_id: user.id, ...requestData, credits_reserved: cost, status: 'queued', provider: 'remote-worker' }).select('id').single()
  if (createError || !created) return NextResponse.json({ error: 'Unable to create the generation job.' }, { status: 500 })

  const { data: remaining, error: reserveError } = await supabase.rpc('reserve_generation_credits', { p_user_id: user.id, p_generation_id: created.id, p_amount: cost, p_description: `Reserved credits for ${type} generation` })
  if (reserveError) {
    await supabase.from('generations').delete().eq('id', created.id).eq('user_id', user.id)
    if (reserveError.message.includes('insufficient_credits')) return NextResponse.json({ success: false, error: 'INSUFFICIENT_CREDITS', message: "You don't have enough credits to generate this video.", requiredCredits: cost }, { status: 402 })
    return NextResponse.json({ error: 'Unable to reserve credits.' }, { status: 500 })
  }

  try {
    const result = await enqueueGeneration({ id: created.id, userId: user.id, request: requestData })
    await supabase.from('generations').update({ status: 'processing', worker_job_id: result.workerJobId, started_at: new Date().toISOString() }).eq('id', created.id).eq('user_id', user.id)
    return NextResponse.json({ success: true, generationId: created.id, jobId: created.id, status: 'processing', cost, remainingCredits: remaining, developmentMode: false, provider: 'remote-worker' })
  } catch {
    await supabase.rpc('refund_generation_credits', { p_user_id: user.id, p_generation_id: created.id, p_amount: cost, p_description: 'Generation provider failed; credits refunded' })
    await supabase.from('generations').update({ status: 'failed', error: 'Video generation failed. Your credits have been refunded.', completed_at: new Date().toISOString() }).eq('id', created.id).eq('user_id', user.id)
    return NextResponse.json({ error: 'Video generation failed. Your credits have been refunded.' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
