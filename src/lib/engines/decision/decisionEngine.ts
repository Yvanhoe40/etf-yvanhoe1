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
  const favorableScore = signals
    .filter((s) => s.sentiment === "favorable")
    .reduce((sum, s) => sum + s.importance, 0);

  const vigilanceScore = signals
    .filter((s) => s.sentiment === "vigilance")
    .reduce((sum, s) => sum + s.importance, 0);

  const sellerScore = signals
    .filter((s) => s.sentiment === "vendeur")
    .reduce((sum, s) => sum + s.importance, 0);

  const hasStrongBullishTrend = signals.some(
    (s) => s.code === "TREND_BULLISH" && s.importance >= 80
  );

  const hasBullishTrend = signals.some(
    (s) => s.code === "TREND_BULLISH" || s.code === "SMA50_ABOVE_SMA200"
  );

  const hasOverboughtSignal = signals.some(
    (s) => s.code === "RSI_OVERBOUGHT" || s.code === "STOCH_OVERBOUGHT"
  );

  const hasMacdBearish = signals.some((s) => s.code === "MACD_BEARISH");

  const hasBearishMomentum = signals.some(
    (s) =>
      s.code === "MOMENTUM_BEARISH" ||
      s.code === "MACD_BEARISH" ||
      s.code === "STOCH_BEARISH"
  );

  const hasMultipleBearishWarnings =
    signals.filter(
      (s) =>
        s.code === "MOMENTUM_BEARISH" ||
        s.code === "MACD_BEARISH" ||
        s.code === "STOCH_BEARISH" ||
        s.code === "PRICE_BELOW_SMA20"
    ).length >= 2;

  const rawScore = favorableScore - vigilanceScore - sellerScore;
  let score = Math.max(0, Math.min(100, 50 + rawScore / 5));

  let decisionLevel: DecisionLevel = "hold";
  let decisionName = "Conserver";

  if (sellerScore >= 120 || score < 25) {
    decisionLevel = "sell";
    decisionName = "Vendre";
  } else if (sellerScore >= 70 || score < 40) {
    decisionLevel = "reduce";
    decisionName = "Réduire";
  } else if (hasStrongBullishTrend && hasOverboughtSignal) {
    decisionLevel = "buy_on_pullback";
    decisionName = "Acheter sur repli";
    score = Math.min(score, 75);
  } else if (hasStrongBullishTrend && hasMacdBearish) {
    decisionLevel = "buy_on_pullback";
    decisionName = "Acheter sur repli";
    score = Math.min(score, 72);
  } else if (hasBullishTrend && hasMultipleBearishWarnings) {
    decisionLevel = "hold";
    decisionName = "Conserver";
    score = Math.min(score, 60);
  } else if (score >= 80 && hasStrongBullishTrend && !hasBearishMomentum && !hasOverboughtSignal) {
    decisionLevel = "strong_buy";
    decisionName = "Acheter fortement";
  } else if (score >= 65 && hasBullishTrend) {
    decisionLevel = "buy";
    decisionName = "Acheter";
  } else if (score >= 45) {
    decisionLevel = "hold";
    decisionName = "Conserver";
  } else {
    decisionLevel = "reduce";
    decisionName = "Réduire";
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