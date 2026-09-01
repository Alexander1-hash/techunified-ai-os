# Company Brain and Business Analyst

Build 6 introduces the tenant-aware foundation for company context and evidence-based analysis. The server-side `getCompanyContext()` service resolves the authenticated user's organization through `profiles.organization_id`; future objectives, KPI, source, insight, and report repositories must retain that scope and use RLS.

`lib/business/analyst.ts` contains deterministic calculations and typed findings. Arithmetic belongs on the server; AI interpretation must label facts, inferences, and recommendations and include evidence, assumptions, confidence, and data quality. Empty states are intentional until trusted business sources are connected.

External connectors, live forecasts, and AI-generated reports are not configured in this build. The UI must never represent unavailable data as company performance.
