import { calculateSMA, type PricePoint } from "./calculateSMA";
import { calculateEMA } from "./calculateEMA";
import { calculateRSI, getRSIZone } from "./calculateRSI";
import { calculateMACD } from "./calculateMACD";
import { calculateMomentum } from "./calculateMomentum";
import { calculateTrend } from "./calculateTrend";
import { calculateStochastic } from "./calculateStochastic";

export type IndicatorSlope =
  | "strong_up"
  | "up"
  | "flat"
  | "down"
  | "strong_down"
  | "unknown";

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

  slopes: {
    sma20: IndicatorSlope;
    sma50: IndicatorSlope;
    sma200: IndicatorSlope;
    ema12: IndicatorSlope;
    ema26: IndicatorSlope;
    rsi14: IndicatorSlope;
    stochK: IndicatorSlope;
    macd: IndicatorSlope;
    macdHistogram: IndicatorSlope;
  };
};

function getSlopeFromSeries(
  series: Record<string, number | null | undefined>,
  sorted: MarketCandle[],
  currentIndex: number
): IndicatorSlope {
  if (currentIndex < 2) return "unknown";

  const currentDate = sorted[currentIndex].trading_date;
  const previousDate = sorted[currentIndex - 1].trading_date;
  const beforePreviousDate = sorted[currentIndex - 2].trading_date;

  const current = series[currentDate];
  const previous = series[previousDate];
  const beforePrevious = series[beforePreviousDate];

  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    beforePrevious === null ||
    beforePrevious === undefined ||
    previous === 0 ||
    beforePrevious === 0
  ) {
    return "unknown";
  }

  const recentMove = ((current - previous) / Math.abs(previous)) * 100;
  const previousMove =
    ((previous - beforePrevious) / Math.abs(beforePrevious)) * 100;

  const slope = (recentMove + previousMove) / 2;

  if (slope >= 0.4) return "strong_up";
  if (slope >= 0.1) return "up";
  if (slope <= -0.4) return "strong_down";
  if (slope <= -0.1) return "down";
  return "flat";
}

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

  const stochKSeries: Record<string, number | null | undefined> = {};
  const macdSeries: Record<string, number | null | undefined> = {};
  const macdHistogramSeries: Record<string, number | null | undefined> = {};

  sorted.forEach((candle) => {
    const date = candle.trading_date;

    stochKSeries[date] = stochastic[date]?.stochK;
    macdSeries[date] = macd[date]?.macd;
    macdHistogramSeries[date] = macd[date]?.histogram;
  });

  return sorted.map((candle, index) => {
    const date = candle.trading_date;

    const trend = calculateTrend({
      sma20: sma20[date] ?? null,
      sma50: sma50[date] ?? null,
      sma100: sma100[date] ?? null,
      sma200: sma200[date] ?? null,
      ema12: ema12[date] ?? null,
      ema26: ema26[date] ?? null,
      rsi14: rsi14[date] ?? null,
      macd: macd[date]?.macd ?? null,
      macdSignal: macd[date]?.signal ?? null,
      momentumLabel: momentum[date]?.momentumLabel ?? "neutre",
    });

    return {
      trading_date: date,
      close: candle.close,
      volume: candle.volume,

      sma20: sma20[date] ?? null,
      sma50: sma50[date] ?? null,
      sma100: sma100[date] ?? null,
      sma200: sma200[date] ?? null,

      ema12: ema12[date] ?? null,
      ema26: ema26[date] ?? null,

      rsi14: rsi14[date] ?? null,
      rsiZone: getRSIZone(rsi14[date] ?? null),

      stochK: stochastic[date]?.stochK ?? null,
      stochD: stochastic[date]?.stochD ?? null,
      stochSignal: stochastic[date]?.stochSignal ?? "neutre",

      macd: macd[date]?.macd ?? null,
      macdSignal: macd[date]?.signal ?? null,
      macdHistogram: macd[date]?.histogram ?? null,

      change1d: momentum[date]?.change1d ?? null,
      change5d: momentum[date]?.change5d ?? null,
      change20d: momentum[date]?.change20d ?? null,
      change50d: momentum[date]?.change50d ?? null,
      momentumLabel: momentum[date]?.momentumLabel ?? "neutre",

      trendScore: trend.trendScore,
      trendDirection: trend.direction,
      trendStrength: trend.strength,
      trendConfidence: trend.confidence,

      slopes: {
        sma20: getSlopeFromSeries(sma20, sorted, index),
        sma50: getSlopeFromSeries(sma50, sorted, index),
        sma200: getSlopeFromSeries(sma200, sorted, index),
        ema12: getSlopeFromSeries(ema12, sorted, index),
        ema26: getSlopeFromSeries(ema26, sorted, index),
        rsi14: getSlopeFromSeries(rsi14, sorted, index),
        stochK: getSlopeFromSeries(stochKSeries, sorted, index),
        macd: getSlopeFromSeries(macdSeries, sorted, index),
        macdHistogram: getSlopeFromSeries(macdHistogramSeries, sorted, index),
      },
    };
  });
}