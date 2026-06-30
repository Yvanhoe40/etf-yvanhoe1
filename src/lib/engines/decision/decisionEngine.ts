import type { MarketSignal } from "../signal/signalEngine";

export type DecisionLevel =
  | "strong_buy"
  | "buy"
  | "buy_on_pullback"
  | "hold"
  | "reduce"
  | "sell"
  | "wait";

export type DecisionResult = {
  decisionLevel: DecisionLevel;
  decisionName: string;
  score: number;
  confidence: number;
  favorableScore: number;
  vigilanceScore: number;
  sellerScore: number;
  mainReasons: MarketSignal[];
};

export function runDecisionEngine(signals: MarketSignal[]): DecisionResult {
  const favorableSignals = signals.filter((s) => s.sentiment === "favorable");
  const vigilanceSignals = signals.filter((s) => s.sentiment === "vigilance");
  const sellerSignals = signals.filter((s) => s.sentiment === "vendeur");

  const favorableScore = favorableSignals.reduce((sum, s) => sum + s.importance, 0);
  const vigilanceScore = vigilanceSignals.reduce((sum, s) => sum + s.importance, 0);
  const sellerScore = sellerSignals.reduce((sum, s) => sum + s.importance, 0);

  const trendSignal = signals.find((s) => s.code === "TREND_BULLISH");
  const hasStrongBullishTrend = !!trendSignal && trendSignal.importance >= 80;
  const hasBullishTrend =
    !!trendSignal || signals.some((s) => s.code === "SMA50_ABOVE_SMA200");

  const hasOverbought =
    signals.some((s) => s.code === "RSI_OVERBOUGHT" || s.code === "STOCH_OVERBOUGHT");

  const hasMacdBearish = signals.some((s) => s.code === "MACD_BEARISH");
  const hasMomentumBearish = signals.some((s) => s.code === "MOMENTUM_BEARISH");

  const bearishWarningsCount = [
    hasMacdBearish,
    hasMomentumBearish,
    signals.some((s) => s.code === "STOCH_BEARISH"),
    signals.some((s) => s.code === "PRICE_BELOW_SMA20"),
  ].filter(Boolean).length;

  let score = 50;

  if (hasStrongBullishTrend) score += 25;
  else if (hasBullishTrend) score += 15;

  score += Math.min(20, favorableSignals.length * 5);

  if (hasOverbought) score -= 8;
  if (hasMacdBearish) score -= 8;
  if (hasMomentumBearish) score -= 10;
  if (bearishWarningsCount >= 2) score -= 8;
  if (sellerSignals.length >= 2) score -= 15;

  score = Math.max(0, Math.min(100, score));

  let decisionLevel: DecisionLevel = "hold";
  let decisionName = "Conserver";

  if (sellerSignals.length >= 3 && !hasBullishTrend) {
    decisionLevel = "sell";
    decisionName = "Vendre";
  } else if (sellerSignals.length >= 2 && bearishWarningsCount >= 2 && !hasStrongBullishTrend) {
    decisionLevel = "reduce";
    decisionName = "Réduire";
  } else if (hasStrongBullishTrend && hasOverbought) {
    decisionLevel = "buy_on_pullback";
    decisionName = "Acheter sur repli";
    score = Math.min(score, 75);
  } else if (hasStrongBullishTrend && bearishWarningsCount >= 1) {
    decisionLevel = "buy_on_pullback";
    decisionName = "Acheter sur repli";
    score = Math.min(score, 72);
  } else if (score >= 82 && hasStrongBullishTrend && bearishWarningsCount === 0 && !hasOverbought) {
    decisionLevel = "strong_buy";
    decisionName = "Acheter fortement";
  } else if (score >= 65 && hasBullishTrend) {
    decisionLevel = "buy";
    decisionName = "Acheter";
  } else if (score >= 45) {
    decisionLevel = "hold";
    decisionName = "Conserver";
  } else if (score >= 30) {
    decisionLevel = "reduce";
    decisionName = "Réduire";
  } else {
    decisionLevel = "sell";
    decisionName = "Vendre";
  }

  const confidence = Math.min(
    100,
    Math.round(
      Math.abs(favorableScore - vigilanceScore - sellerScore) /
        Math.max(1, signals.length)
    )
  );

  const mainReasons = [...signals]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5);

  return {
    decisionLevel,
    decisionName,
    score: Math.round(score),
    confidence,
    favorableScore,
    vigilanceScore,
    sellerScore,
    mainReasons,
  };
}