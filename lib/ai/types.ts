export type GenerationType = 'video' | 'image'
export type GenerationMode = 'text-to-video' | 'image-to-video' | 'text-to-image' | 'reference-image'
export type GenerationStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type AspectRatio = '16:9' | '9:16' | '1:1'
export type Quality = 'standard' | 'high'
export interface GenerationRequest { type: GenerationType; mode: GenerationMode; prompt: string; model: string; aspectRatio: AspectRatio; duration?: number; quality: Quality; inputAssetUrl?: string; idempotencyKey: string }
export interface GenerationJob { id: string; userId: string; request: GenerationRequest }
export interface GenerationResult { generationId: string; status: GenerationStatus; outputUrl?: string; thumbnailUrl?: string; error?: string }
export interface InferenceProvider { generate(job: GenerationJob): Promise<{workerJobId?: string}>; status(generationId: string, workerJobId?: string): Promise<GenerationResult>; cancel(generationId: string, workerJobId?: string): Promise<void> }
export const models = [{id:'our-video-model',name:'Our Video Model',type:'video',supportedModes:['text-to-video','image-to-video'],supportedAspectRatios:['16:9','9:16','1:1'],supportedDurations:[5,10],creditCost:{standard:10,high:20}},{id:'our-image-model',name:'Our Image Model',type:'image',supportedModes:['text-to-image','reference-image'],supportedAspectRatios:['16:9','9:16','1:1'],supportedDurations:[],creditCost:{standard:2,high:4}}] as const
export function creditCost(request: GenerationRequest){const model=models.find(m=>m.id===request.model); return model?.creditCost[request.quality] ?? (request.type==='video' ? request.quality==='high'?20:10 : request.quality==='high'?4:2)}
