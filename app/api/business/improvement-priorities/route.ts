import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

type ActionRun = {
  id: string
  status: string | null
  decision_id: string | null
}

type Outcome = {
  id: string
  title: string
  evidence_status: string | null
  source: string | null
  period_start: string | null
  period_end: string | null
  baseline_value: number | null
  current_value: number | null
  action_run_id: string | null
}

type Priority = 'high' | 'medium' | 'review'

type ImprovementItem = {
  id: string
  title: string
  category: string
  priority: Priority
  reason: string
  nextStep: string
  href: string
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    const organizationId = profile?.organization_id

    if (!organizationId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const [runsResult, outcomesResult] = await Promise.all([
      supabase
        .from('business_action_runs')
        .select('id,status,decision_id')
        .eq('organization_id', organizationId)
        .limit(100),
      supabase
        .from('business_outcomes')
        .select('id,title,evidence_status,source,period_start,period_end,baseline_value,current_value,action_run_id')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    if (runsResult.error) throw runsResult.error
    if (outcomesResult.error) throw outcomesResult.error

    const runs = (runsResult.data ?? []) as ActionRun[]
    const outcomes = (outcomesResult.data ?? []) as Outcome[]
    const linkedRunIds = new Set(outcomes.map((item) => item.action_run_id).filter((id): id is string => Boolean(id)))
    const priorities: ImprovementItem[] = []

    for (const run of runs) {
      if (run.status !== 'completed' || linkedRunIds.has(run.id)) continue
      priorities.push({
        id: 'run:' + run.id,
        title: 'Record an outcome for a completed action',
        category: 'Outcome follow-up',
        priority: 'high',
        reason: 'This completed action run has no outcome explicitly linked in the records reviewed.',
        nextStep: 'Record the real result and link it to this action run. Do not assume completion means success.',
        href: '/business-outcomes',
      })
    }

    for (const outcome of outcomes) {
      const title = outcome.title?.trim() || 'Untitled outcome'
      if (!outcome.source?.trim()) {
        priorities.push({
          id: 'source:' + outcome.id,
          title: 'Add a traceable source',
          category: 'Evidence quality',
          priority: 'high',
          reason: '"' + title + '" has no source or reference recorded.',
          nextStep: 'Add the report, system, document, or other source used to establish this result.',
          href: '/business-outcomes',
        })
      }
      if (!outcome.period_start || !outcome.period_end) {
        priorities.push({
          id: 'period:' + outcome.id,
          title: 'Complete the measurement period',
          category: 'Measurement quality',
          priority: 'medium',
          reason: '"' + title + '" is missing a start date or end date for its measurement period.',
          nextStep: 'Record the actual period covered by the measurement; do not guess dates.',
          href: '/business-outcomes',
        })
      }
      if (outcome.baseline_value === null || outcome.baseline_value === undefined ||
          outcome.current_value === null || outcome.current_value === undefined) {
        priorities.push({
          id: 'comparison:' + outcome.id,
          title: 'Complete the before-and-after comparison',
          category: 'Comparison readiness',
          priority: 'medium',
          reason: '"' + title + '" is missing a baseline or current value.',
          nextStep: 'Add both values when a meaningful comparison exists; leave unavailable values unreported.',
          href: '/business-outcomes',
        })
      }
      if (!outcome.action_run_id) {
        priorities.push({
          id: 'link:' + outcome.id,
          title: 'Link the outcome to its action run',
          category: 'Traceability',
          priority: 'medium',
          reason: '"' + title + '" is not linked to a recorded action run.',
          nextStep: 'Choose the matching run only when the relationship is known; do not infer it from similar titles.',
          href: '/business-outcomes',
        })
      }
      if (outcome.evidence_status === 'estimated') {
        priorities.push({
          id: 'estimate:' + outcome.id,
          title: 'Review estimate against real evidence',
          category: 'Evidence verification',
          priority: 'review',
          reason: '"' + title + '" is explicitly labelled as an estimate, not a verified outcome.',
          nextStep: 'Look for an actual source measurement and update the record only if the evidence supports it.',
          href: '/business-outcomes',
        })
      } else if (!outcome.evidence_status || !['measured', 'attributed'].includes(outcome.evidence_status)) {
        priorities.push({
          id: 'evidence:' + outcome.id,
          title: 'Review the evidence classification',
          category: 'Evidence verification',
          priority: 'high',
          reason: '"' + title + '" has a missing or unrecognized evidence status.',
          nextStep: 'Inspect supporting evidence and correct the classification only when justified.',
          href: '/business-outcomes',
        })
      }
    }

    const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, review: 2 }
    priorities.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.title.localeCompare(b.title))

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      limits: { actionRunsReviewed: 100, outcomesReviewed: 500 },
      summary: {
        totalPriorities: priorities.length,
        high: priorities.filter((item) => item.priority === 'high').length,
        medium: priorities.filter((item) => item.priority === 'medium').length,
        review: priorities.filter((item) => item.priority === 'review').length,
        completedRunsReviewed: runs.filter((item) => item.status === 'completed').length,
        outcomesReviewed: outcomes.length,
      },
      priorities,
      guardrails: {
        organizationScoped: true,
        recommendationsAreDeterministic: true,
        noAutomaticWrites: true,
        noCausalClaims: true,
        estimatedOutcomesAreNotVerified: true,
        limitsMayExcludeOlderRecords: runs.length === 100 || outcomes.length === 500,
      },
    })
  } catch (error) {
    console.error('[Business Improvement] GET failed:', error)
    return NextResponse.json({ error: 'Unable to load business improvement priorities.' }, { status: 500 })
  }
}
