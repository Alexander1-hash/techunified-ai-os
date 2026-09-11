import 'server-only'

export const OPENAI_DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna'

export function getOpenAIConfiguration() {
  return { configured: Boolean(process.env.OPENAI_API_KEY), model: OPENAI_DEFAULT_MODEL }
}

export function getN8nConfiguration() {
  const webhookUrl = process.env.N8N_WEBHOOK_URL || process.env.N8N_BASE_URL || ''
  return { configured: Boolean(webhookUrl), webhookUrl }
}

export function safeIntegrationError(error: unknown, fallback: string) {
  const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : undefined
  if (status === 401 || status === 403) return 'The integration credentials were rejected.'
  if (status === 408 || status === 429) return 'The integration is temporarily unavailable. Please try again.'
  return fallback
}
