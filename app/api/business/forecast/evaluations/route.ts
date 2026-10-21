import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/repositories/profile'

export async function GET() {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentProfile(supabase)
    const organizationId = profile?.organization_id

    if (!organizationId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const { data: evaluations, error } = await supabase
      .from('company_intelligence_forecast_evaluations')
      .select('id,snapshot_id,objective_id,predicted_progress,observed_progress,absolute_error,accuracy_score,prediction_confidence,evaluated_at')
      .eq('organization_id', organizationId)
      .order('evaluated_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('[Forecast evaluations] Query failed:', error)
      return NextResponse.json({ error: 'Unable to load forecast evaluation records.' }, { status: 500 })
    }

    const rows = evaluations ?? []
    const objectiveIds = [...new Set(rows.map((row) => String(row.objective_id)).filter(Boolean))]
    let objectiveTitles = new Map<string, string>()

    if (objectiveIds.length > 0) {
      const { data: objectives, error: objectivesError } = await supabase
        .from('company_objectives')
        .select('id,title')
        .eq('organization_id', organizationId)
        .in('id', objectiveIds)

      if (objectivesError) {
        console.error('[Forecast evaluations] Objective lookup failed:', objectivesError)
        return NextResponse.json({ error: 'Unable to resolve forecast evaluation objectives.' }, { status: 500 })
      }

      objectiveTitles = new Map((objectives ?? []).map((objective) => [String(objective.id), String(objective.title ?? 'Company objective')]))
    }

    const accuracyValues = rows.map((row) => Number(row.accuracy_score)).filter(Number.isFinite)
    const errorValues = rows.map((row) => Number(row.absolute_error)).filter(Number.isFinite)
    const average = (values: number[]) => values.length
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
      : null

    const history = rows.map((row) => ({
      ...row,
      objective_title: objectiveTitles.get(String(row.objective_id)) ?? 'Objective no longer available',
    }))

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        evaluationCount: rows.length,
        objectivesEvaluated: new Set(rows.map((row) => String(row.objective_id))).size,
        averageAccuracyScore: average(accuracyValues),
        averageAbsoluteError: average(errorValues),
        latestEvaluationAt: rows[0]?.evaluated_at ?? null,
        recordLimit: 500,
      },
      evaluations: history.slice(0, 100),
      methodology: {
        accuracyScore: '100 minus absolute percentage-point error, bounded between 0 and 100.',
        absoluteError: 'Absolute difference between predicted and observed objective progress, in percentage points.',
        limitations: 'These scores evaluate progress estimates against subsequently observed objective values. They are not proof of causation, financial return, or forecast quality for metrics outside the evaluated objective records.',
      },
    })
  } catch (error) {
    console.error('[Forecast evaluations] GET failed:', error)
    return NextResponse.json({ error: 'Unable to load forecast evaluation history.' }, { status: 500 })
  }
}
