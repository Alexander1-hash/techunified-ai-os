import { runBacktest, type BacktestConfig, type BacktestResult, type HistoricalBar } from "./backtesting";

export type ValidationFold = {
  fold: number;
  trainingStart: string;
  trainingEnd: string;
  validationStart: string;
  validationEnd: string;
  selectedLookback: number;
  trainingReturnPercent: number;
  validationReturnPercent: number;
  validationNetPnl: number;
  validationTrades: number;
  validationWinRatePercent: number;
  validationMaxDrawdownPercent: number;
};

export type ValidationReport = {
  schemaVersion: 1;
  mode: "research-only";
  dataLabel: "synthetic-demo";
  status: "insufficient-data" | "completed";
  folds: ValidationFold[];
  averageValidationReturnPercent: number;
  positiveValidationFolds: number;
  stabilityPercent: number;
  interpretation: string;
  caveats: string[];
};

export type WalkForwardConfig = Omit<BacktestConfig, "lookbackBars"> & {
  candidateLookbacks: number[];
  trainingBars: number;
  validationBars: number;
  stepBars: number;
};

function validateBars(bars: HistoricalBar[]) {
  if (!Array.isArray(bars)) throw new Error("Bars must be an array.");
  for (let i = 0; i < bars.length; i++) {
    if (!bars[i] || !Number.isFinite(Date.parse(bars[i].timestamp)) || !Number.isFinite(bars[i].close) || bars[i].close <= 0) {
      throw new Error(`Bar ${i + 1} has an invalid timestamp or close price.`);
    }
    if (i > 0 && Date.parse(bars[i].timestamp) <= Date.parse(bars[i - 1].timestamp)) {
      throw new Error("Bars must be strictly ordered by increasing timestamp with no duplicate timestamps.");
    }
  }
}

export function runWalkForwardValidation(
  bars: HistoricalBar[],
  config: WalkForwardConfig,
): ValidationReport {
  validateBars(bars);
  if (!Number.isFinite(config.startingBalance) || config.startingBalance <= 0) throw new Error("Starting balance must be positive.");
  if (!Number.isFinite(config.positionNotional) || config.positionNotional <= 0 || config.positionNotional > config.startingBalance) throw new Error("Position notional must be positive and no larger than starting balance.");
  if (!Number.isFinite(config.feeBpsPerSide) || config.feeBpsPerSide < 0 || config.feeBpsPerSide > 1000) throw new Error("Fee assumption must be between 0 and 1000 basis points.");
  if (!Number.isInteger(config.trainingBars) || config.trainingBars < 4) throw new Error("Training window must contain at least four bars.");
  if (!Number.isInteger(config.validationBars) || config.validationBars < 3) throw new Error("Validation window must contain at least three bars.");
  if (!Number.isInteger(config.stepBars) || config.stepBars < 1) throw new Error("Step size must be a positive whole number.");
  if (!Array.isArray(config.candidateLookbacks) || !config.candidateLookbacks.length || config.candidateLookbacks.some(n => !Number.isInteger(n) || n < 1 || n >= config.trainingBars - 1 || n >= config.validationBars - 1)) {
    throw new Error("Each candidate lookback must be a positive whole number smaller than both windows minus one.");
  }

  const folds: ValidationFold[] = [];
  let foldNumber = 0;
  for (let trainStart = 0; trainStart + config.trainingBars + config.validationBars <= bars.length; trainStart += config.stepBars) {
    const train = bars.slice(trainStart, trainStart + config.trainingBars);
    const validation = bars.slice(trainStart + config.trainingBars, trainStart + config.trainingBars + config.validationBars);
    let selectedLookback = config.candidateLookbacks[0];
    let selectedTrainingResult: BacktestResult | null = null;
    for (const candidate of config.candidateLookbacks) {
      const result = runBacktest(train, {
        startingBalance: config.startingBalance,
        positionNotional: config.positionNotional,
        feeBpsPerSide: config.feeBpsPerSide,
        lookbackBars: candidate,
      });
      if (!selectedTrainingResult || result.returnPercent > selectedTrainingResult.returnPercent) {
        selectedTrainingResult = result;
        selectedLookback = candidate;
      }
    }
    const validationResult = runBacktest(validation, {
      startingBalance: config.startingBalance,
      positionNotional: config.positionNotional,
      feeBpsPerSide: config.feeBpsPerSide,
      lookbackBars: selectedLookback,
    });
    foldNumber++;
    folds.push({
      fold: foldNumber,
      trainingStart: train[0].timestamp,
      trainingEnd: train[train.length - 1].timestamp,
      validationStart: validation[0].timestamp,
      validationEnd: validation[validation.length - 1].timestamp,
      selectedLookback,
      trainingReturnPercent: selectedTrainingResult?.returnPercent ?? 0,
      validationReturnPercent: validationResult.returnPercent,
      validationNetPnl: validationResult.netPnl,
      validationTrades: validationResult.trades.length,
      validationWinRatePercent: validationResult.winRatePercent,
      validationMaxDrawdownPercent: validationResult.maxDrawdownPercent,
    });
  }

  const averageValidationReturnPercent = folds.length ? folds.reduce((sum, fold) => sum + fold.validationReturnPercent, 0) / folds.length : 0;
  const positiveValidationFolds = folds.filter(fold => fold.validationReturnPercent > 0).length;
  return {
    schemaVersion: 1,
    mode: "research-only",
    dataLabel: "synthetic-demo",
    status: folds.length ? "completed" : "insufficient-data",
    folds,
    averageValidationReturnPercent,
    positiveValidationFolds,
    stabilityPercent: folds.length ? (positiveValidationFolds / folds.length) * 100 : 0,
    interpretation: folds.length
      ? "Each fold selects a lookback using only its training window, then reports the selected rule on a later holdout window. Positive folds are descriptive, not proof of a durable edge."
      : "There are not enough bars for one complete training and validation window. Reduce window sizes only when that choice is methodologically justified.",
    caveats: [
      "The bundled sample is synthetic and not real market history; its metrics have no predictive or investment meaning.",
      "Parameter selection on small samples is highly unstable and can overfit; this framework does not correct for multiple testing.",
      "The current replay model omits slippage, spread, funding, liquidity, taxes, latency, gaps, and market impact.",
      "Validation folds can overlap when stepBars is smaller than validationBars; treat folds as dependent in that case.",
      "No live data, broker, exchange, wallet, or order execution is connected. This report cannot authorize trades.",
    ],
  };
}
