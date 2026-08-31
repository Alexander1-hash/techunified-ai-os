# TechUnified AI OS video worker contract

The application talks to a provider-agnostic trusted worker through server-side requests. The browser never supplies the worker URL or credentials.

## Configuration

- `AI_WORKER_URL`: trusted worker base URL.
- `AI_WORKER_SECRET`: server-only bearer credential.
- `AI_WORKER_TIMEOUT_MS`: optional request timeout; defaults to 30 seconds.

Both URL and secret are required before video submissions are accepted. Do not use `NEXT_PUBLIC_AI_WORKER_SECRET`.

## Submit

`POST /generate` with `Authorization: Bearer <AI_WORKER_SECRET>` and JSON:

```json
{
  "generationId": "internal-generation-id",
  "type": "video",
  "mode": "text-to-video",
  "prompt": "...",
  "model": "our-video-model",
  "aspectRatio": "16:9",
  "duration": 5,
  "quality": "standard"
}
```

The worker returns `{ "id": "worker-job-id", "status": "queued" }` or `{ "jobId": "worker-job-id" }`.

## Status

`GET /status/{worker-job-id}` returns a status of `queued`, `running`, `completed`, `failed`, or `cancelled`. Completed responses must include an artifact URL either as `{ "artifact": { "type": "video", "url": "https://...", "mimeType": "video/mp4" } }` or `{ "outputUrl": "https://..." }`. A completed response without a valid HTTP artifact is treated as failed.

## Cancellation

`POST /cancel/{worker-job-id}` uses the same bearer authentication. Cancellation is optional for the worker, but the adapter exposes it for future UI/API support.

## Webhooks

Webhook support is intentionally not enabled until the worker's signing contract is defined. When added, it must use an independent server-to-server signature, validate the payload, locate jobs by worker ID, and never trust user IDs, costs, or final prices from the payload.

## Failure behavior

Worker/network/malformed-response failures are converted to safe application errors. The generation route refunds the reserved credits exactly once through the existing Supabase refund RPC. Successful jobs finalize usage through the existing finalization RPC; no second billing mechanism is introduced.
