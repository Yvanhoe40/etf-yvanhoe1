import { calculateSMA, type PricePoint } from "./calculateSMA";
import { calculateEMA } from "./calculateEMA";
import { calculateRSI, getRSIZone } from "./calculateRSI";
import { calculateMACD } from "./calculateMACD";
import { calculateMomentum } from "./calculateMomentum";
import { calculateTrend } from "./calculateTrend";
import { calculateStochastic } from "./calculateStochastic";
import { calculateMarketEvents } from "./calculateMarketEvents";

export type MarketCandle = PricePoint & {
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
};

export type MarketAnalysisPoint = {
  trading_date: string;
  close: number | null;
  volume: number | null;

  sma20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;

  ema12: number | null;
  ema26: number | null;

  rsi14: number | null;
  rsiZone: "surachat" | "survente" | "neutre" | null;

  stochK: number | null;
  stochD: number | null;
  stochSignal: "surachat" | "survente" | "haussier" | "baissier" | "neutre";

  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;

  macdCross: "bullish_cross" | "bearish_cross" | "none";
  stochCross: "bullish_cross" | "bearish_cross" | "none";
  maCross: "golden_cross" | "death_cross" | "none";

  candlePattern:
    | "doji"
    | "hammer"
    | "shooting_star"
    | "bullish_engulfing"
    | "bearish_engulfing"
    | "none";

  supportLevel: number | null;
  resistanceLevel: number | null;
  distanceToSupportPercent: number | null;
  distanceToResistancePercent: number | null;

  change1d: number | null;
  change5d: number | null;
  change20d: number | null;
  change50d: number | null;

  momentumLabel:
    | "accélération haussière"
    | "ralentissement"
    | "pression baissière"
    | "neutre";

  trendScore: number;
  trendDirection: "haussier" | "neutre" | "baissier";
  trendStrength: "faible" | "moyenne" | "forte";
  trendConfidence: number;
};

export function runMarketEngine(candles: MarketCandle[]): MarketAnalysisPoint[] {
  const sorted = [...candles].sort((a, b) =>
    a.trading_date.localeCompare(b.trading_date)
  );

  const sma20 = calculateSMA(sorted, 20);
  const sma50 = calculateSMA(sorted, 50);
  const sma100 = calculateSMA(sorted, 100);
  const sma200 = calculateSMA(sorted, 200);

  const ema12 = calculateEMA(sorted, 12);
  const ema26 = calculateEMA(sorted, 26);

  const rsi14 = calculateRSI(sorted, 14);
  const stochastic = calculateStochastic(sorted);
  const macd = calculateMACD(sorted);
  const momentum = calculateMomentum(sorted);

  const events = calculateMarketEvents({
    candles: sorted,
    sma50,
    sma200,
    macd,
    stochastic,
  });

  return sorted.map((candle) => {
    const event = events[candle.trading_date];

    const trend = calculateTrend({
      sma20: sma20[candle.trading_date] ?? null,
      sma50: sma50[candle.trading_date] ?? null,
      sma100: sma100[candle.trading_date] ?? null,
      sma200: sma200[candle.trading_date] ?? null,
      ema12: ema12[candle.trading_date] ?? null,
      ema26: ema26[candle.trading_date] ?? null,
      rsi14: rsi14[candle.trading_date] ?? null,
      macd: macd[candle.trading_date]?.macd ?? null,
      macdSignal: macd[candle.trading_date]?.signal ?? null,
      momentumLabel: momentum[candle.trading_date]?.momentumLabel ?? "neutre",
    });

    return {
      trading_date: candle.trading_date,
      close: candle.close,
      volume: candle.volume,

      sma20: sma20[candle.trading_date] ?? null,
      sma50: sma50[candle.trading_date] ?? null,
      sma100: sma100[candle.trading_date] ?? null,
      sma200: sma200[candle.trading_date] ?? null,

      ema12: ema12[candle.trading_date] ?? null,
      ema26: ema26[candle.trading_date] ?? null,

      rsi14: rsi14[candle.trading_date] ?? null,
      rsiZone: getRSIZone(rsi14[candle.trading_date] ?? null),

      stochK: stochastic[candle.trading_date]?.stochK ?? null,
      stochD: stochastic[candle.trading_date]?.stochD ?? null,
      stochSignal: stochastic[candle.trading_date]?.stochSignal ?? "neutre",

      macd: macd[candle.trading_date]?.macd ?? null,
      macdSignal: macd[candle.trading_date]?.signal ?? null,
      macdHistogram: macd[candle.trading_date]?.histogram ?? null,

      macdCross: event?.macdCross ?? "none",
      stochCross: event?.stochCross ?? "none",
      maCross: event?.maCross ?? "none",

      candlePattern: event?.candlePattern ?? "none",

      supportLevel: event?.supportLevel ?? null,
      resistanceLevel: event?.resistanceLevel ?? null,
      distanceToSupportPercent: event?.distanceToSupportPercent ?? null,
      distanceToResistancePercent: event?.distanceToResistancePercent ?? null,

      change1d: momentum[candle.trading_date]?.change1d ?? null,
      change5d: momentum[candle.trading_date]?.change5d ?? null,
      change20d: momentum[candle.trading_date]?.change20d ?? null,
      change50d: momentum[candle.trading_date]?.change50d ?? null,
      momentumLabel: momentum[candle.trading_date]?.momentumLabel ?? "neutre",

      trendScore: trend.trendScore,
      trendDirection: trend.direction,
      trendStrength: trend.strength,
      trendConfidence: trend.confidence,
    };
  });
}