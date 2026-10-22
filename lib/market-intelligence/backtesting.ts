export type HistoricalBar = {
  timestamp: string;
  close: number;
};

export type BacktestConfig = {
  startingBalance: number;
  positionNotional: number;
  feeBpsPerSide: number;
  lookbackBars: number;
};

export type BacktestTrade = {
  direction: "long" | "short";
  entryAt: string;
  exitAt: string;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  fees: number;
  netPnl: number;
  returnPercent: number;
};

export type BacktestResult = {
  schemaVersion: 1;
  mode: "research-only";
  dataLabel: "synthetic-demo";
  barsProcessed: number;
  trades: BacktestTrade[];
  startingBalance: number;
  endingBalance: number;
  grossPnl: number;
  totalFees: number;
  netPnl: number;
  returnPercent: number;
  winRatePercent: number;
  maxDrawdownPercent: number;
  profitFactor: number | null;
  equityCurve: { timestamp: string; equity: number }[];
  assumptions: string[];
  warnings: string[];
};

function validIsoTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function runBacktest(
  bars: HistoricalBar[],
  config: BacktestConfig,
): BacktestResult {
  if (!Array.isArray(bars) || bars.length < 3) {
    throw new Error("At least three historical bars are required.");
  }
  if (!Number.isFinite(config.startingBalance) || config.startingBalance <= 0) {
    throw new Error("Starting balance must be a positive finite number.");
  }
  if (!Number.isFinite(config.positionNotional) || config.positionNotional <= 0 || config.positionNotional > config.startingBalance) {
    throw new Error("Position notional must be positive and no larger than starting balance.");
  }
  if (!Number.isFinite(config.feeBpsPerSide) || config.feeBpsPerSide < 0 || config.feeBpsPerSide > 1000) {
    throw new Error("Fee assumption must be between 0 and 1000 basis points per side.");
  }
  if (!Number.isInteger(config.lookbackBars) || config.lookbackBars < 1 || config.lookbackBars >= bars.length - 1) {
    throw new Error("Lookback must be a positive whole number smaller than the available history.");
  }

  const ordered = bars.map((bar) => ({ ...bar }));
  for (let i = 0; i < ordered.length; i++) {
    if (!validIsoTimestamp(ordered[i].timestamp) || !Number.isFinite(ordered[i].close) || ordered[i].close <= 0) {
      throw new Error(`Bar ${i + 1} has an invalid timestamp or close price.`);
    }
    if (i > 0 && Date.parse(ordered[i].timestamp) <= Date.parse(ordered[i - 1].timestamp)) {
      throw new Error("Bars must be strictly ordered by increasing timestamp with no duplicate timestamps.");
    }
  }

  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestResult["equityCurve"] = [{ timestamp: ordered[0].timestamp, equity: config.startingBalance }];
  let balance = config.startingBalance;
  let peak = balance;
  let maxDrawdownPercent = 0;
  let position: { direction: "long" | "short"; entryIndex: number; entryPrice: number } | null = null;
  const feeRate = config.feeBpsPerSide / 10_000;

  function closePosition(exitIndex: number) {
    if (!position) return;
    const bar = ordered[exitIndex];
    const sign = position.direction === "long" ? 1 : -1;
    const grossPnl = sign * ((bar.close - position.entryPrice) / position.entryPrice) * config.positionNotional;
    const fees = config.positionNotional * feeRate * 2;
    const netPnl = grossPnl - fees;
    trades.push({
      direction: position.direction,
      entryAt: ordered[position.entryIndex].timestamp,
      exitAt: bar.timestamp,
      entryPrice: position.entryPrice,
      exitPrice: bar.close,
      grossPnl,
      fees,
      netPnl,
      returnPercent: (netPnl / config.positionNotional) * 100,
    });
    balance += netPnl;
    position = null;
  }

  for (let i = 1; i < ordered.length; i++) {
    // Signal uses only bars available before the current bar; execution is at current close.
    const prior = ordered[i - 1].close;
    const reference = ordered[i - 1 - config.lookbackBars]?.close;
    if (reference !== undefined) {
      const direction = prior > reference ? "long" : prior < reference ? "short" : null;
      if (position && direction !== position.direction) closePosition(i);
      if (!position && direction) position = { direction, entryIndex: i, entryPrice: ordered[i].close };
    }
    if (position) {
      const sign = position.direction === "long" ? 1 : -1;
      const unrealized = sign * ((ordered[i].close - position.entryPrice) / position.entryPrice) * config.positionNotional;
      const equity = balance + unrealized;
      peak = Math.max(peak, equity);
      if (peak > 0) maxDrawdownPercent = Math.max(maxDrawdownPercent, ((peak - equity) / peak) * 100);
      equityCurve.push({ timestamp: ordered[i].timestamp, equity });
    } else {
      peak = Math.max(peak, balance);
      if (peak > 0) maxDrawdownPercent = Math.max(maxDrawdownPercent, ((peak - balance) / peak) * 100);
      equityCurve.push({ timestamp: ordered[i].timestamp, equity: balance });
    }
  }
  if (position) closePosition(ordered.length - 1);
  const last = equityCurve[equityCurve.length - 1];
  if (last) last.equity = balance;

  const grossPnl = trades.reduce((sum, trade) => sum + trade.grossPnl, 0);
  const totalFees = trades.reduce((sum, trade) => sum + trade.fees, 0);
  const netPnl = trades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const wins = trades.filter((trade) => trade.netPnl > 0).length;
  const grossWins = trades.filter((trade) => trade.netPnl > 0).reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossLosses = Math.abs(trades.filter((trade) => trade.netPnl < 0).reduce((sum, trade) => sum + trade.netPnl, 0));

  return {
    schemaVersion: 1,
    mode: "research-only",
    dataLabel: "synthetic-demo",
    barsProcessed: ordered.length,
    trades,
    startingBalance: config.startingBalance,
    endingBalance: balance,
    grossPnl,
    totalFees,
    netPnl,
    returnPercent: ((balance - config.startingBalance) / config.startingBalance) * 100,
    winRatePercent: trades.length ? (wins / trades.length) * 100 : 0,
    maxDrawdownPercent,
    profitFactor: grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? null : 0,
    equityCurve,
    assumptions: [
      "Synthetic sample bars only; no real historical market data is connected.",
      "Signal uses the prior close and prior lookback close; simulated entry/exit uses the current bar close.",
      "Fixed notional exposure; no compounding or leverage.",
      "Fees are charged on both entry and exit; slippage, spread, funding, taxes, latency, liquidity, and gaps are not modeled.",
      "This is a deterministic educational replay, not evidence of a profitable strategy.",
    ],
    warnings: [
      "Small synthetic samples are not statistically meaningful.",
      "No out-of-sample validation, walk-forward analysis, or parameter search correction is included.",
      "No output can authorize or trigger live orders.",
    ],
  };
}

export const SYNTHETIC_SAMPLE_BARS: HistoricalBar[] = [
  { timestamp: "2026-01-01T00:00:00.000Z", close: 100 },
  { timestamp: "2026-01-01T01:00:00.000Z", close: 101 },
  { timestamp: "2026-01-01T02:00:00.000Z", close: 103 },
  { timestamp: "2026-01-01T03:00:00.000Z", close: 102 },
  { timestamp: "2026-01-01T04:00:00.000Z", close: 104 },
  { timestamp: "2026-01-01T05:00:00.000Z", close: 106 },
  { timestamp: "2026-01-01T06:00:00.000Z", close: 103 },
  { timestamp: "2026-01-01T07:00:00.000Z", close: 101 },
  { timestamp: "2026-01-01T08:00:00.000Z", close: 102 },
  { timestamp: "2026-01-01T09:00:00.000Z", close: 105 },
  { timestamp: "2026-01-01T10:00:00.000Z", close: 107 },
  { timestamp: "2026-01-01T11:00:00.000Z", close: 106 },
];
