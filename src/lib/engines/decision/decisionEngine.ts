import type { MarketSignal } from "../signal/signalEngine";

export type DecisionLevel =
  | "strong_buy"
  | "buy"
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

  const hasOverboughtSignal = signals.some(
    (s) => s.code === "RSI_OVERBOUGHT" || s.code === "STOCH_OVERBOUGHT"
  );

  const hasStrongBullishTrend = signals.some(
    (s) => s.code === "TREND_BULLISH" && s.importance >= 80
  );

  const hasBearishPressure = signals.some(
    (s) =>
      s.code === "MOMENTUM_BEARISH" ||
      s.code === "MACD_BEARISH" ||
      s.code === "STOCH_BEARISH"
  );

  const rawScore = favorableScore - vigilanceScore - sellerScore;
  let score = Math.max(0, Math.min(100, 50 + rawScore / 5));

  if (hasOverboughtSignal && hasStrongBullishTrend) {
    score = Math.min(score, 79);
  }

  if (hasOverboughtSignal && hasBearishPressure) {
    score = Math.min(score, 65);
  }

  let decisionLevel: DecisionLevel = "hold";
  let decisionName = "Conserver";

  if (score >= 80) {
    decisionLevel = "strong_buy";
    decisionName = "Acheter fortement";
  } else if (score >= 65) {
    decisionLevel = "buy";
    decisionName = hasOverboughtSignal ? "Acheter sur repli" : "Acheter";
  } else if (score >= 45) {
    decisionLevel = "hold";
    decisionName = hasOverboughtSignal ? "Conserver / attendre repli" : "Conserver";
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