import type { PricePoint } from "./calculateSMA";
import { calculateEMA } from "./calculateEMA";

export type MACDPoint = {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
};

export function calculateMACD(
  candles: PricePoint[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): Record<string, MACDPoint> {
  const emaFast = calculateEMA(candles, fastPeriod);
  const emaSlow = calculateEMA(candles, slowPeriod);

  const macdSeries: PricePoint[] = candles.map((candle) => {
    const fast = emaFast[candle.trading_date];
    const slow = emaSlow[candle.trading_date];

    return {
      trading_date: candle.trading_date,
      close:
        fast !== null &&
        fast !== undefined &&
        slow !== null &&
        slow !== undefined
          ? fast - slow
          : null,
    };
  });

  const signalSeries = calculateEMA(macdSeries, signalPeriod);

  const result: Record<string, MACDPoint> = {};

  candles.forEach((candle) => {
    const macd = macdSeries.find(
      (point) => point.trading_date === candle.trading_date
    )?.close ?? null;

    const signal = signalSeries[candle.trading_date] ?? null;

    result[candle.trading_date] = {
      macd,
      signal,
      histogram:
        macd !== null && signal !== null ? macd - signal : null,
    };
  });

  return result;
}