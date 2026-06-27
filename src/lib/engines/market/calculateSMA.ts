export type PricePoint = {
  trading_date: string;
  close: number | null;
};

export function calculateSMA(
  candles: PricePoint[],
  period: number
): Record<string, number | null> {
  const result: Record<string, number | null> = {};

  for (let i = 0; i < candles.length; i++) {
    const current = candles[i];

    if (i < period - 1) {
      result[current.trading_date] = null;
      continue;
    }

    const window = candles.slice(i - period + 1, i + 1);
    const closes = window
      .map((candle) => candle.close)
      .filter((value): value is number => value !== null);

    if (closes.length < period) {
      result[current.trading_date] = null;
      continue;
    }

    const sum = closes.reduce((total, value) => total + value, 0);
    result[current.trading_date] = sum / period;
  }

  return result;
}