-- Prevent duplicate pending approval requests for the same governed agent run.
CREATE UNIQUE INDEX IF NOT EXISTS agent_approvals_one_pending_per_run
  ON public.agent_approvals (organization_id, agent_run_id)
  WHERE status = 'pending';
