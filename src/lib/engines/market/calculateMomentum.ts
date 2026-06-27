import type { PricePoint } from "./calculateSMA";

export type MomentumPoint = {
  change1d: number | null;
  change5d: number | null;
  change20d: number | null;
  change50d: number | null;
  momentumLabel: "accélération haussière" | "ralentissement" | "pression baissière" | "neutre";
};

function percentChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function calculateMomentum(
  candles: PricePoint[]
): Record<string, MomentumPoint> {
  const result: Record<string, MomentumPoint> = {};

  for (let i = 0; i < candles.length; i++) {
    const current = candles[i];

    const change1d = i >= 1 ? percentChange(current.close, candles[i - 1].close) : null;
    const change5d = i >= 5 ? percentChange(current.close, candles[i - 5].close) : null;
    const change20d = i >= 20 ? percentChange(current.close, candles[i - 20].close) : null;
    const change50d = i >= 50 ? percentChange(current.close, candles[i - 50].close) : null;

    let momentumLabel: MomentumPoint["momentumLabel"] = "neutre";

    if (
      change5d !== null &&
      change20d !== null &&
      change5d > 0 &&
      change20d > 0 &&
      change5d > change20d / 4
    ) {
      momentumLabel = "accélération haussière";
    } else if (
      change5d !== null &&
      change20d !== null &&
      change5d < 0 &&
      change20d < 0
    ) {
      momentumLabel = "pression baissière";
    } else if (
      change5d !== null &&
      change20d !== null &&
      Math.abs(change5d) < Math.abs(change20d) / 4
    ) {
      momentumLabel = "ralentissement";
    }

    result[current.trading_date] = {
      change1d,
      change5d,
      change20d,
      change50d,
      momentumLabel,
    };
  }

  return result;
}