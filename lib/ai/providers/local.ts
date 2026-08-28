import type {GenerationJob,GenerationResult,InferenceProvider} from '../types'
const jobs=new Map<string,GenerationResult>()
export const mockProvider: InferenceProvider={
 async generate(job:GenerationJob){jobs.set(job.id,{generationId:job.id,status:'processing'}); setTimeout(()=>jobs.set(job.id,{generationId:job.id,status:'completed',outputUrl:'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4',thumbnailUrl:'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=1200&q=80'}),3500); return {workerJobId:`mock-${job.id}`}},
 async status(id:string){return jobs.get(id)??{generationId:id,status:'queued'}},
 async cancel(id:string){jobs.set(id,{generationId:id,status:'cancelled'})}
}
