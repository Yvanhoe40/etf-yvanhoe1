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

function getSignal(signals: MarketSignal[], code: string) {
  return signals.find((signal) => signal.code === code);
}

export function runDecisionEngine(signals: MarketSignal[]): DecisionResult {
  const favorableSignals = signals.filter((s) => s.sentiment === "favorable");
  const vigilanceSignals = signals.filter((s) => s.sentiment === "vigilance");
  const sellerSignals = signals.filter((s) => s.sentiment === "vendeur");

  const favorableScore = favorableSignals.reduce((sum, s) => sum + s.importance, 0);
  const vigilanceScore = vigilanceSignals.reduce((sum, s) => sum + s.importance, 0);
  const sellerScore = sellerSignals.reduce((sum, s) => sum + s.importance, 0);

  const trend = getSignal(signals, "TREND_BULLISH");
  const trendScore = trend?.importance ?? 0;

  const isStrongBullMarket = trendScore >= 80 && hasSignal(signals, "SMA50_ABOVE_SMA200");
  const isBullMarket = trendScore >= 60 || hasSignal(signals, "SMA50_ABOVE_SMA200");
  const isBearMarket = hasSignal(signals, "TREND_BEARISH");

  const hasOverbought =
    hasSignal(signals, "RSI_OVERBOUGHT") || hasSignal(signals, "STOCH_OVERBOUGHT");

  const hasOversold =
    hasSignal(signals, "RSI_OVERSOLD") || hasSignal(signals, "STOCH_OVERSOLD");

  const hasMacdBullish = hasSignal(signals, "MACD_BULLISH");
  const hasMacdBearish = hasSignal(signals, "MACD_BEARISH");

  const hasMomentumBullish = hasSignal(signals, "MOMENTUM_ACCELERATING");
  const hasMomentumBearish = hasSignal(signals, "MOMENTUM_BEARISH");

  const hasPriceBelowSma20 = hasSignal(signals, "PRICE_BELOW_SMA20");

  const bullishConfirmations = [
    isBullMarket,
    hasSignal(signals, "SMA50_ABOVE_SMA200"),
    hasSignal(signals, "SMA20_ABOVE_SMA50"),
    hasMacdBullish,
    hasMomentumBullish,
    hasOversold,
  ].filter(Boolean).length;

  const bearishWarnings = [
    hasMacdBearish,
    hasMomentumBearish,
    hasPriceBelowSma20,
    hasOverbought,
  ].filter(Boolean).length;

  let decisionLevel: DecisionLevel = "hold";
  let decisionName = "Conserver";
  let score = 50;

  if (isBearMarket && sellerSignals.length >= 2) {
    decisionLevel = "sell";
    decisionName = "Vendre";
    score = 15;
  } else if (!isBullMarket && sellerSignals.length >= 2) {
    decisionLevel = "reduce";
    decisionName = "Réduire";
    score = 35;
  } else if (isStrongBullMarket && hasOverbought) {
    decisionLevel = "buy_on_pullback";
    decisionName = "Acheter sur repli";
    score = 75;
  } else if (isStrongBullMarket && hasMacdBearish) {
    decisionLevel = "buy_on_pullback";
    decisionName = "Acheter sur repli";
    score = 72;
  } else if (isStrongBullMarket && bullishConfirmations >= 4 && bearishWarnings === 0) {
    decisionLevel = "strong_buy";
    decisionName = "Acheter fortement";
    score = 88;
  } else if (isStrongBullMarket) {
    decisionLevel = "buy";
    decisionName = "Acheter";
    score = 72;
  } else if (isBullMarket && bearishWarnings <= 1) {
    decisionLevel = "buy";
    decisionName = "Acheter";
    score = 68;
  } else if (isBullMarket && bearishWarnings >= 2) {
    decisionLevel = "hold";
    decisionName = "Conserver";
    score = 56;
  } else if (hasOversold && !isBearMarket) {
    decisionLevel = "hold";
    decisionName = "Conserver / surveiller rebond";
    score = 52;
  } else if (bearishWarnings >= 3) {
    decisionLevel = "reduce";
    decisionName = "Réduire";
    score = 38;
  } else {
    decisionLevel = "hold";
    decisionName = "Conserver";
    score = 50;
  }

  const confidence = Math.min(
    100,
    Math.round(
      (Math.abs(favorableScore - vigilanceScore - sellerScore) +
        bullishConfirmations * 10 +
        bearishWarnings * 8) /
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