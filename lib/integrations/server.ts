import 'server-only'

export const OPENAI_DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna'

export function getOpenAIConfiguration() {
  return { configured: Boolean(process.env.OPENAI_API_KEY), model: OPENAI_DEFAULT_MODEL }
}

export function getN8nConfiguration() {
  const baseUrl = process.env.N8N_BASE_URL?.trim().replace(/\/$/, '') || ''
  const webhookUrl = process.env.N8N_WEBHOOK_URL?.trim() || ''
  const secret = process.env.N8N_WEBHOOK_SECRET?.trim() || ''
  let valid = true
  try {
    if (webhookUrl) { const url = new URL(webhookUrl); valid = ['http:', 'https:'].includes(url.protocol) }
    if (baseUrl) { const url = new URL(baseUrl); valid = valid && ['http:', 'https:'].includes(url.protocol) }
  } catch { valid = false }
  return { configured: Boolean(webhookUrl && secret && valid), hasBaseUrl: Boolean(baseUrl), hasWebhookUrl: Boolean(webhookUrl), hasSecret: Boolean(secret), valid, baseUrl, webhookUrl, secret }
}

export function safeIntegrationError(error: unknown, fallback: string) {
  const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : undefined
  if (status === 401 || status === 403) return 'The integration credentials were rejected.'
  if (status === 408 || status === 429) return 'The integration is temporarily unavailable. Please try again.'
  return fallback
}
