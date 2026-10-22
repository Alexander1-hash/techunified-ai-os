import type { IntelligenceAuditRecord, IntelligenceStage } from "./orchestration-audit";

export type StageAnalytics = {
  stage: IntelligenceStage;
  runs: number;
  passed: number;
  blocked: number;
  incomplete: number;
  researchOnly: number;
  coveragePercent: number;
};

export type IntelligenceAnalyticsReport = {
  schemaVersion: 1;
  generatedAt: string;
  runCount: number;
  completeAuditCount: number;
  auditCompletenessPercent: number;
  outcomeCounts: Record<IntelligenceAuditRecord["finalOutcome"], number>;
  stageAnalytics: StageAnalytics[];
  blockerCounts: { code: string; count: number }[];
  symbolCounts: { symbol: string; count: number }[];
  caveats: string[];
};

const STAGES: IntelligenceStage[] = [
  "market-data", "strategy", "opportunity", "validation", "risk", "governance",
];

/**
 * Descriptive analytics over locally retained audit snapshots.
 * These counts measure evidence coverage and policy outcomes, not trading
 * performance, probability of profit, or a validated strategy edge.
 */
export function summarizeIntelligenceRuns(
  records: IntelligenceAuditRecord[],
  generatedAt = new Date(),
): IntelligenceAnalyticsReport {
  const outcomeCounts: IntelligenceAnalyticsReport["outcomeCounts"] = {
    blocked: 0, "research-only": 0, "requires-human-review": 0,
  };
  const stageStats = new Map<IntelligenceStage, StageAnalytics>(
    STAGES.map(stage => [stage, { stage, runs: 0, passed: 0, blocked: 0, incomplete: 0, researchOnly: 0, coveragePercent: 0 }]),
  );
  const blockers = new Map<string, number>();
  const symbols = new Map<string, number>();
  let completeAuditCount = 0;

  for (const record of records) {
    if (record.schemaVersion !== 1 || record.policy?.eligibleForExecution !== false || record.policy?.approvedNotional !== 0) continue;
    outcomeCounts[record.finalOutcome] += 1;
    if (record.integrity.complete) completeAuditCount += 1;
    for (const stage of record.stages) {
      const stats = stageStats.get(stage.stage);
      if (!stats) continue;
      stats.runs += 1;
      if (stage.status === "passed") stats.passed += 1;
      else if (stage.status === "blocked") stats.blocked += 1;
      else if (stage.status === "incomplete") stats.incomplete += 1;
      else stats.researchOnly += 1;
    }
    for (const event of record.events) {
      if (event.eventType !== "policy-blocked") continue;
      blockers.set(event.code, (blockers.get(event.code) ?? 0) + 1);
    }
    const symbol = record.runId.split("-").slice(-1)[0] || "unknown";
    symbols.set(symbol, (symbols.get(symbol) ?? 0) + 1);
  }

  const stageAnalytics = Array.from(stageStats.values()).map(stats => ({
    ...stats,
    coveragePercent: records.length ? Number((stats.runs / records.length * 100).toFixed(1)) : 0,
  }));
  return {
    schemaVersion: 1,
    generatedAt: Number.isFinite(generatedAt.getTime()) ? generatedAt.toISOString() : new Date().toISOString(),
    runCount: records.length,
    completeAuditCount,
    auditCompletenessPercent: records.length ? Number((completeAuditCount / records.length * 100).toFixed(1)) : 0,
    outcomeCounts,
    stageAnalytics,
    blockerCounts: Array.from(blockers, ([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count).slice(0, 12),
    symbolCounts: Array.from(symbols, ([symbol, count]) => ({ symbol, count })).sort((a, b) => b.count - a.count),
    caveats: [
      "Counts reflect only the records currently available in this browser; they are not a global or server-side history.",
      "Browser-local records can be edited or deleted and are not cryptographically verified.",
      "Audit completeness means the expected stage snapshot is present; it does not prove that evidence is correct or independently verified.",
      "These metrics describe evidence coverage and governance blockers, not returns, win probability, strategy profitability, or investment performance.",
      "Underlying quote feed and bundled validation bars are scripted/synthetic demonstration data; live market integrations are not configured.",
    ],
  };
}
