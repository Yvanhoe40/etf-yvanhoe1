import type { MarketCandle } from "./marketEngine";

export type StochasticPoint = {
  stochK: number | null;
  stochD: number | null;
  stochSignal: "surachat" | "survente" | "haussier" | "baissier" | "neutre";
};

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateStochastic(
  candles: MarketCandle[],
  period = 14,
  smoothD = 3
): Record<string, StochasticPoint> {
  const result: Record<string, StochasticPoint> = {};
  const kValues: Array<number | null> = [];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    if (i < period - 1 || candle.close === null) {
      kValues.push(null);
      result[candle.trading_date] = {
        stochK: null,
        stochD: null,
        stochSignal: "neutre",
      };
      continue;
    }

    const window = candles.slice(i - period + 1, i + 1);

    const highs = window
      .map((c) => c.high)
      .filter((value): value is number => value !== null);

    const lows = window
      .map((c) => c.low)
      .filter((value): value is number => value !== null);

    if (highs.length === 0 || lows.length === 0) {
      kValues.push(null);
      result[candle.trading_date] = {
        stochK: null,
        stochD: null,
        stochSignal: "neutre",
      };
      continue;
    }

    const highestHigh = Math.max(...highs);
    const lowestLow = Math.min(...lows);

    const stochK =
      highestHigh === lowestLow
        ? null
        : ((candle.close - lowestLow) / (highestHigh - lowestLow)) * 100;

    kValues.push(stochK);

    const recentK = kValues
      .slice(Math.max(0, kValues.length - smoothD))
      .filter((value): value is number => value !== null);

    const stochD = average(recentK);

    let stochSignal: StochasticPoint["stochSignal"] = "neutre";

    if (stochK !== null && stochK >= 80) {
      stochSignal = "surachat";
    } else if (stochK !== null && stochK <= 20) {
      stochSignal = "survente";
    } else if (stochK !== null && stochD !== null && stochK > stochD) {
      stochSignal = "haussier";
    } else if (stochK !== null && stochD !== null && stochK < stochD) {
      stochSignal = "baissier";
    }

    result[candle.trading_date] = {
      stochK,
      stochD,
      stochSignal,
    };
  }

  return result;
}