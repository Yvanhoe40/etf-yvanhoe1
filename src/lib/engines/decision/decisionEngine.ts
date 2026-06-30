import type { TechnicalSnapshot } from "../market/buildTechnicalSnapshot";
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

function hasSignal(signals: MarketSignal[], code: string) {
  return signals.some((signal) => signal.code === code);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function runDecisionEngine(
  snapshot: TechnicalSnapshot,
  signals: MarketSignal[]
): DecisionResult {
  const favorableSignals = signals.filter((s) => s.sentiment === "favorable");
  const vigilanceSignals = signals.filter((s) => s.sentiment === "vigilance");
  const sellerSignals = signals.filter((s) => s.sentiment === "vendeur");

  const favorableScore = favorableSignals.reduce((sum, s) => sum + s.importance, 0);
  const vigilanceScore = vigilanceSignals.reduce((sum, s) => sum + s.importance, 0);
  const sellerScore = sellerSignals.reduce((sum, s) => sum + s.importance, 0);

  const close = snapshot.close;
  const sma20 = snapshot.movingAverages.sma20;
  const sma50 = snapshot.movingAverages.sma50;
  const sma200 = snapshot.movingAverages.sma200;

  const rsi = snapshot.momentum.rsi14;
  const stochK = snapshot.momentum.stochK;
  const macdStatus = snapshot.momentum.macdStatus;

  const trendScore = snapshot.trend.trendScore;
  const trendDirection = snapshot.trend.direction;
  const trendStrength = snapshot.trend.strength;

  const priceAboveSma20 =
    close !== null && sma20 !== null ? close >= sma20 : false;

  const sma50AboveSma200 =
    sma50 !== null && sma200 !== null ? sma50 > sma200 : false;

  const sma20AboveSma50 =
    sma20 !== null && sma50 !== null ? sma20 > sma50 : false;

  const rsiOverbought = rsi !== null && rsi >= 70;
  const rsiExtreme = rsi !== null && rsi >= 80;
  const rsiOversold = rsi !== null && rsi <= 30;

  const stochOverbought = stochK !== null && stochK >= 80;
  const stochOversold = stochK !== null && stochK <= 20;

  const bullishTrend =
    trendDirection === "haussier" &&
    trendScore >= 60 &&
    sma50AboveSma200;

  const strongBullishTrend =
    trendDirection === "haussier" &&
    trendScore >= 80 &&
    trendStrength === "forte" &&
    sma50AboveSma200;

  const bearishTrend =
    trendDirection === "baissier" ||
    (trendScore <= 35 && !sma50AboveSma200);

  const shortTermWeakness =
    !priceAboveSma20 ||
    macdStatus === "baissier" ||
    hasSignal(signals, "MOMENTUM_BEARISH");

  const overheating =
    rsiOverbought || stochOverbought || rsiExtreme;

  const goodEntryTiming =
    bullishTrend &&
    priceAboveSma20 &&
    !overheating &&
    macdStatus === "haussier";

  let score = 50;

  if (strongBullishTrend) score += 25;
  else if (bullishTrend) score += 15;
  else if (bearishTrend) score -= 25;

  if (sma20AboveSma50) score += 8;
  if (priceAboveSma20) score += 6;
  if (macdStatus === "haussier") score += 8;
  if (macdStatus === "baissier") score -= 8;

  if (rsiOversold || stochOversold) score += 6;
  if (rsiOverbought || stochOverbought) score -= 6;
  if (rsiExtreme) score -= 10;

  if (hasSignal(signals, "MOMENTUM_ACCELERATING")) score += 8;
  if (hasSignal(signals, "MOMENTUM_BEARISH")) score -= 10;

  score = clamp(score);

  let decisionLevel: DecisionLevel = "hold";
  let decisionName = "Conserver";

  if (bearishTrend && sellerSignals.length >= 2) {
    decisionLevel = "sell";
    decisionName = "Vendre";
    score = Math.min(score, 20);
  } else if (bearishTrend || sellerSignals.length >= 3) {
    decisionLevel = "reduce";
    decisionName = "Réduire";
    score = Math.min(score, 40);
  } else if (strongBullishTrend && overheating) {
    decisionLevel = "buy_on_pullback";
    decisionName = "Acheter sur repli";
    score = Math.min(Math.max(score, 65), 75);
  } else if (strongBullishTrend && shortTermWeakness) {
    decisionLevel = "buy_on_pullback";
    decisionName = "Acheter sur repli";
    score = Math.min(Math.max(score, 65), 72);
  } else if (strongBullishTrend && goodEntryTiming) {
    decisionLevel = "strong_buy";
    decisionName = "Acheter fortement";
    score = Math.max(score, 85);
  } else if (bullishTrend && goodEntryTiming) {
    decisionLevel = "buy";
    decisionName = "Acheter";
    score = Math.max(score, 68);
  } else if (bullishTrend) {
    decisionLevel = "hold";
    decisionName = "Conserver";
    score = clamp(score, 50, 64);
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

  const confirmationCount = [
    bullishTrend,
    strongBullishTrend,
    priceAboveSma20,
    sma20AboveSma50,
    sma50AboveSma200,
    macdStatus === "haussier",
    !overheating,
  ].filter(Boolean).length;

  const contradictionCount = [
    bullishTrend && macdStatus === "baissier",
    bullishTrend && !priceAboveSma20,
    bullishTrend && overheating,
    bullishTrend && hasSignal(signals, "MOMENTUM_BEARISH"),
  ].filter(Boolean).length;

  const confidence = clamp(
    Math.round(confirmationCount * 12 - contradictionCount * 10 + 20)
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