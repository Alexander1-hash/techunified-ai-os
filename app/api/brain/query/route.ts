import { NextResponse } from 'next/server'
import { askCompanyBrainServer } from '@/lib/brain/server'

const MAX_REQUEST_BYTES = 64 * 1024

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Company Brain request is too large.' }, { status: 413 })
  }

  const body = await request.json().catch(() => null)
  const question = body && typeof body.question === 'string' ? body.question.trim() : ''
  if (!question) return NextResponse.json({ error: 'Ask a question about your organization.' }, { status: 400 })
  if (question.length > 4000) return NextResponse.json({ error: 'Keep your question under 4,000 characters.' }, { status: 400 })
  try { return NextResponse.json(await askCompanyBrainServer(question)) } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (code === 'Please sign in to use Company Brain.') return NextResponse.json({ error: code }, { status: 401 })
    if (code === 'AI provider configuration is missing.') return NextResponse.json({ error: 'The AI provider is not configured yet.' }, { status: 503 })
    console.error('[v0] Company Brain request failed', error)
    return NextResponse.json({ error: 'Company Brain could not complete the request. Please try again.' }, { status: 500 })
  }
}
