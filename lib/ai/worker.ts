import type { GenerationJob, GenerationResult, InferenceProvider } from './types'

export interface WorkerArtifact {
  type: 'video'
  url: string
  mimeType?: string
  duration?: number
  width?: number
  height?: number
}

export interface WorkerSubmission {
  workerJobId: string
}

export interface WorkerResponse {
  id?: string
  jobId?: string
  status?: string
  progress?: number
  artifact?: WorkerArtifact
  outputUrl?: string
  thumbnailUrl?: string
  error?: string
}

const DEFAULT_TIMEOUT_MS = 30_000

function config() {
  const url = process.env.AI_WORKER_URL?.trim().replace(/\/$/, '')
  const secret = process.env.AI_WORKER_SECRET?.trim()
  if (!url || !secret) throw new Error('worker_not_configured')
  return { url, secret, timeout: Number(process.env.AI_WORKER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS }
}

function normalizeStatus(status?: string): GenerationResult['status'] {
  switch (status?.toLowerCase()) {
    case 'running': case 'processing': return 'processing'
    case 'completed': case 'succeeded': case 'success': return 'completed'
    case 'failed': case 'error': return 'failed'
    case 'cancelled': case 'canceled': return 'cancelled'
    default: return 'queued'
  }
}

function normalizeResponse(generationId: string, body: WorkerResponse): GenerationResult {
  const artifact = body.artifact ?? (body.outputUrl ? { type: 'video' as const, url: body.outputUrl } : undefined)
  const status = normalizeStatus(body.status)
  if (status === 'completed' && (!artifact?.url || !artifact.url.startsWith('http'))) {
    return { generationId, status: 'failed', error: 'Worker completed without a valid video artifact.' }
  }
  return { generationId, status, outputUrl: artifact?.url, thumbnailUrl: body.thumbnailUrl, error: body.error }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, secret, timeout } = config()
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeout),
  })
  if (!response.ok) throw new Error('worker_unavailable')
  const body: unknown = await response.json().catch(() => null)
  if (!body || typeof body !== 'object') throw new Error('worker_malformed_response')
  return body as T
}

export const remoteVideoWorker: InferenceProvider = {
  async generate(job: GenerationJob) {
    const body = await request<WorkerResponse>('/generate', { method: 'POST', body: JSON.stringify({ generationId: job.id, ...job.request }) })
    const workerJobId = body.jobId ?? body.id
    if (!workerJobId) throw new Error('worker_malformed_response')
    return { workerJobId }
  },
  async status(generationId, workerJobId) {
    const body = await request<WorkerResponse>(`/status/${encodeURIComponent(workerJobId ?? generationId)}`, { method: 'GET' })
    return normalizeResponse(generationId, body)
  },
  async cancel(generationId, workerJobId) {
    await request(`/cancel/${encodeURIComponent(workerJobId ?? generationId)}`, { method: 'POST' })
  },
}

export function isWorkerConfigured() { return Boolean(process.env.AI_WORKER_URL?.trim() && process.env.AI_WORKER_SECRET?.trim()) }
