import { NextResponse } from 'next/server'
import { askCompanyBrainServer } from '@/lib/brain/server'

export async function POST(request: Request) {
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
