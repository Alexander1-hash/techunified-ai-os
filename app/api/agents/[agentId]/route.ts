import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { agents } from '@/lib/data'

const MAX_MESSAGE_LENGTH = 10_000
const DEFAULT_MODEL = 'gpt-5.6-luna'

export async function POST(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Please sign in to use this agent.' }, { status: 401 })

  const { agentId } = await params
  if (!agentId || typeof agentId !== 'string') return NextResponse.json({ error: 'This agent could not be found.' }, { status: 404 })

  const agent = agents.find((item) => item.id === agentId)
  if (!agent) return NextResponse.json({ error: 'This agent could not be found.' }, { status: 404 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Enter a task for the agent.' }, { status: 400 }) }
  const message = typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ error: 'Enter a task for the agent.' }, { status: 400 })
  if (message.length > MAX_MESSAGE_LENGTH) return NextResponse.json({ error: 'Keep the task under 10,000 characters.' }, { status: 400 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI provider configuration is missing.' }, { status: 500 })

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
  const instructions = `You are the TechUnified AI OS ${agent.name}. ${agent.purpose}. Help the authenticated user with tasks related to ${agent.department}. Be practical, accurate, and transparent about limitations. Do not claim to have performed actions or accessed systems unless the user provided the information in this conversation.`

  try {
    const openai = new OpenAI({ apiKey })
    const response = await openai.responses.create({ model, input: [{ role: 'developer', content: instructions }, { role: 'user', content: message }] })
    return NextResponse.json({ success: true, agentId, response: response.output_text, model })
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 500
    if (status === 429) return NextResponse.json({ error: 'The AI service is temporarily busy. Please try again.' }, { status: 429 })
    return NextResponse.json({ error: 'The agent could not complete that task. Please try again.' }, { status: 500 })
  }
}
