import { NextResponse } from 'next/server'
import { askCompanyBrainServer } from '@/lib/brain/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const question = body && typeof body.question === 'string' ? body.question.trim() : ''
  if (!question) return NextResponse.json({ error: 'Ask a question about your organization.' }, { status: 400 })
  if (question.length > 4000) return NextResponse.json({ error: 'Keep your question under 4,000 characters.' }, { status: 400 })
  try { return NextResponse.json(await askCompanyBrainServer(question)) } catch (error) {
    const message = error instanceof Error ? error.message : 'Company Brain could not complete the request.'
    return NextResponse.json({ error: message }, { status: message.startsWith('Please sign in') ? 401 : 500 })
  }
}
