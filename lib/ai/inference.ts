import type {GenerationJob,GenerationResult,InferenceProvider} from './types'
import {mockProvider} from './providers/local'
const workerUrl=process.env.AI_WORKER_URL
const workerSecret=process.env.AI_WORKER_SECRET
const remote:InferenceProvider={async generate(job){const r=await fetch(`${workerUrl}/generate`,{method:'POST',headers:{'content-type':'application/json',...(workerSecret?{'x-worker-secret':workerSecret}:{})},body:JSON.stringify(job),signal:AbortSignal.timeout(15000)}); if(!r.ok) throw new Error('worker_unavailable'); return r.json()},async status(id,wid){const r=await fetch(`${workerUrl}/status/${wid??id}`,{headers:workerSecret?{'x-worker-secret':workerSecret}:undefined,signal:AbortSignal.timeout(10000)}); if(!r.ok) throw new Error('worker_unavailable'); return r.json()},async cancel(id,wid){await fetch(`${workerUrl}/cancel/${wid??id}`,{method:'POST',headers:workerSecret?{'x-worker-secret':workerSecret}:undefined,signal:AbortSignal.timeout(10000)})}}
export const inferenceProvider=workerUrl?remote:mockProvider
export async function enqueueGeneration(job:GenerationJob){return inferenceProvider.generate(job)}
export async function getGenerationStatus(id:string,workerJobId?:string):Promise<GenerationResult>{return inferenceProvider.status(id,workerJobId)}
