export type RiskPolicy = {
  maxRiskPerTradePercent: number;
  maxExposurePercent: number;
  maxDrawdownPercent: number;
  maxOpenPositions: number;
};

export type RiskAssessmentInput = {
  accountEquity: number;
  currentEquity: number;
  peakEquity: number;
  existingExposure: number;
  openPositions: number;
  entryPrice: number;
  stopPrice: number;
  proposedNotional: number;
  policy: RiskPolicy;
};

export type RiskAssessment = {
  schemaVersion: 1;
  assessedAt: string;
  status: "blocked" | "review-required";
  approvedNotional: 0;
  requestedNotional: number;
  riskBudget: number;
  estimatedLossAtStop: number | null;
  projectedExposurePercent: number | null;
  currentDrawdownPercent: number | null;
  checks: { id: string; label: string; passed: boolean; detail: string }[];
  disclaimer: string;
};

const finiteNonNegative = (value: number) => Number.isFinite(value) && value >= 0;

/**
 * Conservative research-only risk check. It deliberately approves no capital:
 * an assessment is not an order authorization or broker-side risk control.
 */
export function assessRisk(input: RiskAssessmentInput, assessedAt = new Date()): RiskAssessment {
  const { policy } = input;
  const valid =
    finiteNonNegative(input.accountEquity) &&
    finiteNonNegative(input.currentEquity) &&
    finiteNonNegative(input.peakEquity) &&
    finiteNonNegative(input.existingExposure) &&
    Number.isInteger(input.openPositions) && input.openPositions >= 0 &&
    Number.isFinite(input.entryPrice) && input.entryPrice > 0 &&
    Number.isFinite(input.stopPrice) && input.stopPrice > 0 &&
    finiteNonNegative(input.proposedNotional) &&
    Number.isFinite(policy.maxRiskPerTradePercent) && policy.maxRiskPerTradePercent > 0 && policy.maxRiskPerTradePercent <= 100 &&
    Number.isFinite(policy.maxExposurePercent) && policy.maxExposurePercent > 0 && policy.maxExposurePercent <= 100 &&
    Number.isFinite(policy.maxDrawdownPercent) && policy.maxDrawdownPercent > 0 && policy.maxDrawdownPercent <= 100 &&
    Number.isInteger(policy.maxOpenPositions) && policy.maxOpenPositions > 0;

  const riskBudget = valid ? input.currentEquity * policy.maxRiskPerTradePercent / 100 : 0;
  const stopDistancePercent = input.entryPrice > 0 ? Math.abs(input.entryPrice - input.stopPrice) / input.entryPrice : NaN;
  const estimatedLossAtStop = valid && Number.isFinite(stopDistancePercent)
    ? input.proposedNotional * stopDistancePercent
    : null;
  const projectedExposurePercent = valid && input.currentEquity > 0
    ? (input.existingExposure + input.proposedNotional) / input.currentEquity * 100
    : null;
  const currentDrawdownPercent = valid && input.peakEquity > 0
    ? Math.max(0, (input.peakEquity - input.currentEquity) / input.peakEquity * 100)
    : null;

  const checks = [
    { id: "inputs", label: "Input validation", passed: valid, detail: valid ? "Numeric inputs and policy limits are valid." : "One or more inputs are invalid or outside permitted bounds." },
    { id: "equity", label: "Positive account equity", passed: valid && input.currentEquity > 0 && input.accountEquity > 0, detail: "Account and current equity must be greater than zero." },
    { id: "stop", label: "Stop-loss risk budget", passed: valid && estimatedLossAtStop !== null && estimatedLossAtStop <= riskBudget, detail: valid ? `Estimated stop loss ${estimatedLossAtStop === null ? "unavailable" : estimatedLossAtStop.toFixed(2)}; risk budget ${riskBudget.toFixed(2)}.` : "Cannot calculate risk until inputs are valid." },
    { id: "exposure", label: "Portfolio exposure limit", passed: valid && projectedExposurePercent !== null && projectedExposurePercent <= policy.maxExposurePercent, detail: projectedExposurePercent === null ? "Exposure percentage unavailable." : `Projected exposure ${projectedExposurePercent.toFixed(2)}%; limit ${policy.maxExposurePercent.toFixed(2)}%.` },
    { id: "drawdown", label: "Drawdown limit", passed: valid && currentDrawdownPercent !== null && currentDrawdownPercent <= policy.maxDrawdownPercent, detail: currentDrawdownPercent === null ? "Drawdown unavailable." : `Current drawdown ${currentDrawdownPercent.toFixed(2)}%; limit ${policy.maxDrawdownPercent.toFixed(2)}%.` },
    { id: "positions", label: "Open-position count", passed: valid && input.openPositions < policy.maxOpenPositions, detail: `${input.openPositions} open position(s); maximum ${policy.maxOpenPositions}.` },
  ];
  return {
    schemaVersion: 1,
    assessedAt: assessedAt.toISOString(),
    status: checks.every((check) => check.passed) ? "review-required" : "blocked",
    approvedNotional: 0,
    requestedNotional: Number.isFinite(input.proposedNotional) ? input.proposedNotional : 0,
    riskBudget,
    estimatedLossAtStop,
    projectedExposurePercent,
    currentDrawdownPercent,
    checks,
    disclaimer: "Research-only calculation. Passing checks never authorizes a trade; no notional is approved and no order is sent. Validate assumptions, fees, slippage, gaps, liquidity, and broker constraints separately.",
  };
}
