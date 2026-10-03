-- Phase 2 governed agent tool registry and permissions
CREATE TABLE IF NOT EXISTS public.agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  risk_level text NOT NULL DEFAULT 'read',
  enabled boolean NOT NULL DEFAULT true,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_tools_risk_check CHECK (risk_level IN ('read','propose','action'))
);

CREATE TABLE IF NOT EXISTS public.agent_tool_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.agent_tools(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, agent_id, tool_id)
);

CREATE INDEX IF NOT EXISTS agent_tool_permissions_org_agent_idx
  ON public.agent_tool_permissions (organization_id, agent_id);

ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tool_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_tools_authenticated_select ON public.agent_tools;
CREATE POLICY agent_tools_authenticated_select ON public.agent_tools
FOR SELECT TO authenticated USING (enabled = true);

DROP POLICY IF EXISTS agent_tool_permissions_org_select ON public.agent_tool_permissions;
CREATE POLICY agent_tool_permissions_org_select ON public.agent_tool_permissions
FOR SELECT TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS agent_tool_permissions_org_insert ON public.agent_tool_permissions;
CREATE POLICY agent_tool_permissions_org_insert ON public.agent_tool_permissions
FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS agent_tool_permissions_org_update ON public.agent_tool_permissions;
CREATE POLICY agent_tool_permissions_org_update ON public.agent_tool_permissions
FOR UPDATE TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP TRIGGER IF EXISTS agent_tool_permissions_set_updated_at ON public.agent_tool_permissions;
CREATE TRIGGER agent_tool_permissions_set_updated_at BEFORE UPDATE ON public.agent_tool_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.agent_tools (tool_key, name, description, risk_level, input_schema)
VALUES
('company_brain.search', 'Company Brain Search', 'Search organization knowledge and return grounded excerpts.', 'read',
 '{"type":"object","properties":{"query":{"type":"string","description":"Specific organization knowledge question or search query."}},"required":["query"],"additionalProperties":false}'),
('business_analyst.snapshot', 'Business Analyst Snapshot', 'Read current organization KPIs, data quality, recommendations, and verified outcomes.', 'read',
 '{"type":"object","properties":{},"additionalProperties":false}'),
('business_outcomes.recent', 'Business Outcomes', 'Read recent measured, attributed, and estimated business outcomes with evidence status.', 'read',
 '{"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":20}},"additionalProperties":false}'),
('workflow.propose_action', 'Workflow Action Proposal', 'Inspect active workflows and prepare a proposed action. This tool never executes a workflow.', 'propose',
 '{"type":"object","properties":{"workflow_id":{"type":"string","description":"Optional active workflow ID."},"reason":{"type":"string","description":"Business reason for the proposed action."},"input":{"type":"object","additionalProperties":true}},"required":["reason"],"additionalProperties":false}')
ON CONFLICT (tool_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level,
  input_schema = EXCLUDED.input_schema,
  enabled = true;

INSERT INTO public.agent_tool_permissions (organization_id, agent_id, tool_id, enabled)
SELECT a.organization_id, a.id, t.id, true
FROM public.agents a
JOIN public.agent_tools t ON t.tool_key IN (
  'company_brain.search',
  'business_analyst.snapshot',
  'business_outcomes.recent',
  'workflow.propose_action'
)
ON CONFLICT (organization_id, agent_id, tool_id) DO NOTHING;
