import type {GenerationJob,GenerationResult,InferenceProvider} from '../types'
const jobs=new Map<string,GenerationResult>()
export const mockProvider: InferenceProvider={
 async generate(job:GenerationJob){jobs.set(job.id,{generationId:job.id,status:'processing'}); setTimeout(()=>jobs.set(job.id,{generationId:job.id,status:'completed',error:'Development mock completed without a real video artifact.'}),3500); return {workerJobId:`mock-${job.id}`}},
 async status(id:string){return jobs.get(id)??{generationId:id,status:'queued'}},
 async cancel(id:string){jobs.set(id,{generationId:id,status:'cancelled'})}
}
