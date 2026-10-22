import type { NormalizedQuote, QuoteEnvelope } from "./market-data";

export type StrategyDirection = "bullish" | "bearish" | "neutral";
export type StrategyGate = "blocked-demo-data" | "research-only";

export type StrategySignal = {
  strategyId: string;
  strategyVersion: string;
  symbol: string;
  direction: StrategyDirection;
  confidence: number;
  rationale: string[];
  observedPrice: number;
  observedAt: string;
  dataStatus: NormalizedQuote["status"];
  source: NormalizedQuote["source"];
  gate: StrategyGate;
  eligibleForExecution: false;
};

export type StrategyEvaluation = {
  schemaVersion: 1;
  evaluatedAt: string;
  mode: "research-only";
  signals: StrategySignal[];
  summary: string;
};

const STRATEGY_ID = "momentum-observation";
const STRATEGY_VERSION = "1.0.0";

/**
 * Deterministic, explainable research baseline. It only interprets the supplied
 * normalized quote; it does not forecast returns or generate order instructions.
 */
export function evaluateQuote(quote: NormalizedQuote): StrategySignal {
  const change = quote.changePercent24h;
  const direction: StrategyDirection =
    change == null || change === 0 ? "neutral" : change > 0 ? "bullish" : "bearish";
  const rationale = [
    change == null
      ? "24-hour change is unavailable; no directional observation can be made."
      : `Reported 24-hour change is ${change > 0 ? "+" : ""}${change.toFixed(2)}%.`,
    quote.status === "simulated"
      ? "Input is scripted demonstration data, not a live market observation."
      : quote.status === "delayed"
        ? "Input is delayed and must not be treated as current."
        : quote.status === "unavailable"
          ? "Input is unavailable."
          : "Provider-origin status is not proof of feed quality or execution readiness.",
    "This is a descriptive rule, not a validated predictive strategy.",
  ];
  return {
    strategyId: STRATEGY_ID,
    strategyVersion: STRATEGY_VERSION,
    symbol: quote.symbol,
    direction,
    confidence: change == null ? 0 : Math.min(Math.abs(change) / 5, 1),
    rationale,
    observedPrice: quote.price,
    observedAt: quote.observedAt,
    dataStatus: quote.status,
    source: quote.source,
    gate: quote.source === "scripted-demo" || quote.status !== "live" ? "blocked-demo-data" : "research-only",
    eligibleForExecution: false,
  };
}

export function evaluateQuoteEnvelope(envelope: QuoteEnvelope, evaluatedAt = new Date()): StrategyEvaluation {
  const signals = envelope.quotes.map(evaluateQuote);
  return {
    schemaVersion: 1,
    evaluatedAt: evaluatedAt.toISOString(),
    mode: "research-only",
    signals,
    summary: signals.length
      ? `${signals.length} descriptive signal(s) evaluated; all remain non-executable.`
      : "No quotes available to evaluate.",
  };
}
