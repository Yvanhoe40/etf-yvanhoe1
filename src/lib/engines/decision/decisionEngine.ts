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

  const rawScore = favorableScore - vigilanceScore - sellerScore;
  const score = Math.max(0, Math.min(100, 50 + rawScore / 5));

  let decisionLevel: DecisionLevel = "hold";
  let decisionName = "Conserver";

  if (score >= 80) {
    decisionLevel = "strong_buy";
    decisionName = "Acheter fortement";
  } else if (score >= 65) {
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