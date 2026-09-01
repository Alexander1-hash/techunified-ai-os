export type FindingKind = 'fact' | 'inference' | 'recommendation'
export interface Evidence { source: string; metric: string; period: string; value: number | string; comparison?: string; calculation?: string }
export interface BusinessFinding { kind: FindingKind; title: string; description: string; evidence: Evidence[]; severity: 'critical' | 'watch' | 'strength' | 'opportunity' | 'risk'; confidence: 'high' | 'medium' | 'low'; recommendedAction?: string }

export interface AnalysisResult { findings: BusinessFinding[]; dataQuality: 'Good' | 'Warning' | 'Poor'; coverage: number; message: string }

export function analyzeBusiness(input: { kpis: Array<{ name: string; value?: number | null; previousValue?: number | null }> }): AnalysisResult {
  const available = input.kpis.filter((kpi) => typeof kpi.value === 'number')
  if (available.length === 0) return { findings: [], dataQuality: 'Poor', coverage: 0, message: 'Insufficient business data. Connect KPI or operational data before analysis.' }
  return { findings: [], dataQuality: available.length >= 3 ? 'Good' : 'Warning', coverage: Math.round((available.length / Math.max(input.kpis.length, 1)) * 100), message: 'Analysis is ready for evidence-backed findings.' }
}

export function percentChange(value: number, previousValue: number): number { return previousValue === 0 ? 0 : Math.round(((value - previousValue) / Math.abs(previousValue)) * 1000) / 10 }
