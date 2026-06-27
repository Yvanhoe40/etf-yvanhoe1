export type TrendAnalysis = {
  trendScore: number;
  direction: "haussier" | "neutre" | "baissier";
  strength: "faible" | "moyenne" | "forte";
  confidence: number;
};

type TrendInput = {
  sma20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;

  ema12: number | null;
  ema26: number | null;

  rsi14: number | null;

  macd: number | null;
  macdSignal: number | null;

  momentumLabel:
    | "accélération haussière"
    | "ralentissement"
    | "pression baissière"
    | "neutre";
};

export function calculateTrend(input: TrendInput): TrendAnalysis {

  let score = 50;

  //---------------------------------
  // SMA
  //---------------------------------

  if (
    input.sma20 &&
    input.sma50 &&
    input.sma20 > input.sma50
  ) score += 8;

  if (
    input.sma50 &&
    input.sma100 &&
    input.sma50 > input.sma100
  ) score += 8;

  if (
    input.sma100 &&
    input.sma200 &&
    input.sma100 > input.sma200
  ) score += 10;

  //---------------------------------
  // EMA
  //---------------------------------

  if (
    input.ema12 &&
    input.ema26 &&
    input.ema12 > input.ema26
  ) score += 10;

  //---------------------------------
  // RSI
  //---------------------------------

  if (
    input.rsi14 !== null &&
    input.rsi14 > 55 &&
    input.rsi14 < 70
  ) score += 10;

  if (
    input.rsi14 !== null &&
    input.rsi14 < 40
  ) score -= 10;

  //---------------------------------
  // MACD
  //---------------------------------

  if (
    input.macd !== null &&
    input.macdSignal !== null &&
    input.macd > input.macdSignal
  ) score += 12;

  else if (
    input.macd !== null &&
    input.macdSignal !== null
  ) score -= 12;

  //---------------------------------
  // Momentum
  //---------------------------------

  switch (input.momentumLabel) {

    case "accélération haussière":
      score += 12;
      break;

    case "pression baissière":
      score -= 15;
      break;

    case "ralentissement":
      score -= 5;
      break;
  }

  //---------------------------------

  score = Math.max(0, Math.min(100, score));

  let direction: TrendAnalysis["direction"];

  if (score >= 65)
    direction = "haussier";
  else if (score <= 35)
    direction = "baissier";
  else
    direction = "neutre";

  let strength: TrendAnalysis["strength"];

  if (score >= 80 || score <= 20)
    strength = "forte";
  else if (score >= 65 || score <= 35)
    strength = "moyenne";
  else
    strength = "faible";

  return {

    trendScore: score,

    direction,

    strength,

    confidence: Math.round(score)

  };

}