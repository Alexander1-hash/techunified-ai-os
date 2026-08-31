import type { GenerationJob, GenerationResult, InferenceProvider } from './types'
import { mockProvider } from './providers/local'
import { isWorkerConfigured, remoteVideoWorker } from './worker'

export const inferenceProvider: InferenceProvider = isWorkerConfigured() ? remoteVideoWorker : mockProvider
export const workerConfigured = isWorkerConfigured()

export async function enqueueGeneration(job: GenerationJob) {
  return inferenceProvider.generate(job)
}

export async function getGenerationStatus(id: string, workerJobId?: string): Promise<GenerationResult> {
  return inferenceProvider.status(id, workerJobId)
}
