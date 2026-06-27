import type { PricePoint } from "./calculateSMA";

export function calculateEMA(
  candles: PricePoint[],
  period: number
): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  const multiplier = 2 / (period + 1);

  let ema: number | null = null;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const close = candle.close;

    if (close === null) {
      result[candle.trading_date] = null;
      continue;
    }

    if (i < period - 1) {
      result[candle.trading_date] = null;
      continue;
    }

    if (i === period - 1) {
      const window = candles.slice(0, period);
      const closes = window
        .map((item) => item.close)
        .filter((value): value is number => value !== null);

      if (closes.length < period) {
        result[candle.trading_date] = null;
        continue;
      }

      ema = closes.reduce((sum, value) => sum + value, 0) / period;
      result[candle.trading_date] = ema;
      continue;
    }

    ema = close * multiplier + (ema as number) * (1 - multiplier);
    result[candle.trading_date] = ema;
  }

  return result;
}