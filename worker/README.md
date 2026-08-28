# Future GPU worker

Vercel hosts the Next.js application and API. Supabase stores generation records and private assets. A separate GPU worker will run open-weight, license-compliant inference such as Wan2.1 where its license permits the intended use.

Planned layout:

```text
worker/
  app.py
  inference.py
  models/
  queue.py
  requirements.txt
  Dockerfile
```

The worker accepts `POST /generate`, reports `GET /status/:id`, and supports `POST /cancel/:id`. The Vercel server sends authenticated JSON using `AI_WORKER_SECRET`; this secret is never sent to the browser. Until `AI_WORKER_URL` is configured, development mode uses the local mock provider and clearly labels the result.
