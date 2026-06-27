import type { PricePoint } from "./calculateSMA";

export function calculateRSI(
  candles: PricePoint[],
  period: number = 14
): Record<string, number | null> {
  const result: Record<string, number | null> = {};

  for (let i = 0; i < candles.length; i++) {
    const current = candles[i];

    if (i < period) {
      result[current.trading_date] = null;
      continue;
    }

    let gains = 0;
    let losses = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const currentClose = candles[j].close;
      const previousClose = candles[j - 1].close;

      if (currentClose === null || previousClose === null) {
        result[current.trading_date] = null;
        continue;
      }

      const change = currentClose - previousClose;

      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const averageGain = gains / period;
    const averageLoss = losses / period;

    if (averageLoss === 0) {
      result[current.trading_date] = 100;
      continue;
    }

    const rs = averageGain / averageLoss;
    result[current.trading_date] = 100 - 100 / (1 + rs);
  }

  return result;
}

export function getRSIZone(rsi: number | null): "surachat" | "survente" | "neutre" | null {
  if (rsi === null) return null;
  if (rsi >= 70) return "surachat";
  if (rsi <= 30) return "survente";
  return "neutre";
}