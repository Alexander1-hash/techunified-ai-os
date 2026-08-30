# TechUnified AI OS

AI-powered business operating system with modular AI agents, company knowledge, automation, analytics, department management, and a provider-independent AI Studio.

## Build 5: AI Studio architecture

Vercel hosts the Next.js application and asynchronous generation API. Supabase stores generation metadata, private inputs, generated assets, credits, and ownership-scoped rows. When `AI_WORKER_URL` is absent, development mode uses a clearly labeled mock provider; when configured, the server sends jobs to the separate GPU worker using `AI_WORKER_SECRET`.

AI Studio supports video and image request contracts, polling, idempotency keys, server-side credit checks, generation history seams, and future model replacement without coupling the UI to an inference vendor. No Higgsfield integration, leaked credentials, or proprietary video-generation API is used.

### Environment

Copy `.env.example` into the deployment configuration. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser-safe. `SUPABASE_SERVICE_ROLE_KEY`, `AI_WORKER_URL`, and `AI_WORKER_SECRET` are server-only; the current routes use the authenticated Supabase session and never expose those values.

### Mock mode

Leave `AI_WORKER_URL` empty, sign in, open `/studio`, submit a prompt, and use the returned generation ID with `/api/ai/generations/[id]`. The mock provider transitions from processing to completed and returns demo media; the UI labels the engine as Development mode.

### Future GPU worker

Deploy the planned worker separately with Python, PyTorch, Diffusers, CUDA, and a license-compliant open-weight model such as Wan2.1 where permitted. See `worker/README.md` for the planned `/generate`, `/status/:id`, and `/cancel/:id` contract. The worker should upload outputs to private Supabase Storage and return generation status to the Vercel API.

### Supabase

The Build 5 SQL migration creates `generations`, `generation_assets`, `generation_usage`, and `user_credits` with UUIDs, indexes, ownership RLS, and a unique per-user idempotency key. Apply the approved schema in the connected Supabase project before using production generation history or credit balances; create private `ai-inputs` and `ai-generations` Storage buckets with authenticated ownership policies.

### Security

Credits are checked server-side, generation ownership is filtered by authenticated user, and worker secrets never enter client bundles. Production should move credit reservation/refund into a single transactional Postgres function or server-only RPC before enabling paid usage.

### Supabase Auth URL configuration

For email confirmation and password recovery, configure the Supabase Auth Site URL as `https://techunified-ai-os.vercel.app` and allow the redirect URL `https://techunified-ai-os.vercel.app/auth/callback`. The app uses `NEXT_PUBLIC_SITE_URL` for production confirmation links, set to `https://techunified-ai-os.vercel.app`, resulting in `https://techunified-ai-os.vercel.app/auth/callback`. If `NEXT_PUBLIC_SITE_URL` is unset in a preview, signup falls back to the current browser origin at `/auth/callback`. Sessions are stored in Supabase SSR cookies; passwords and service-role credentials are never handled by the browser.
