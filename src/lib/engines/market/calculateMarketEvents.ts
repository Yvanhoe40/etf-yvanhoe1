import type { MarketCandle } from "./marketEngine";

export type MarketEventsPoint = {
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
};

type Inputs = {
  candles: MarketCandle[];
  sma50: Record<string, number | null>;
  sma200: Record<string, number | null>;
  macd: Record<string, { macd: number | null; signal: number | null; histogram: number | null }>;
  stochastic: Record<string, { stochK: number | null; stochD: number | null }>;
};

function round(value: number | null, decimals = 2) {
  if (value === null || Number.isNaN(value)) return null;
  return Number(value.toFixed(decimals));
}

function detectCandlePattern(
  current: MarketCandle,
  previous?: MarketCandle
): MarketEventsPoint["candlePattern"] {
  if (
    current.open === null ||
    current.high === null ||
    current.low === null ||
    current.close === null
  ) {
    return "none";
  }

  const body = Math.abs(current.close - current.open);
  const range = current.high - current.low;

  if (range <= 0) return "none";

  const upperShadow = current.high - Math.max(current.open, current.close);
  const lowerShadow = Math.min(current.open, current.close) - current.low;

  const bodyRatio = body / range;

  if (bodyRatio <= 0.1) {
    return "doji";
  }

  if (lowerShadow >= body * 2 && upperShadow <= body * 0.5) {
    return "hammer";
  }

  if (upperShadow >= body * 2 && lowerShadow <= body * 0.5) {
    return "shooting_star";
  }

  if (
    previous &&
    previous.open !== null &&
    previous.close !== null
  ) {
    const currentBullish = current.close > current.open;
    const currentBearish = current.close < current.open;
    const previousBullish = previous.close > previous.open;
    const previousBearish = previous.close < previous.open;

    if (
      currentBullish &&
      previousBearish &&
      current.close > previous.open &&
      current.open < previous.close
    ) {
      return "bullish_engulfing";
    }

    if (
      currentBearish &&
      previousBullish &&
      current.open > previous.close &&
      current.close < previous.open
    ) {
      return "bearish_engulfing";
    }
  }

  return "none";
}

function calculateSupportResistance(
  candles: MarketCandle[],
  index: number,
  lookback = 60
) {
  const current = candles[index];

  if (!current || current.close === null) {
    return {
      supportLevel: null,
      resistanceLevel: null,
      distanceToSupportPercent: null,
      distanceToResistancePercent: null,
    };
  }

  const window = candles
    .slice(Math.max(0, index - lookback), index + 1)
    .filter(
      (candle) =>
        candle.low !== null &&
        candle.high !== null &&
        candle.close !== null
    );

  if (window.length < 20) {
    return {
      supportLevel: null,
      resistanceLevel: null,
      distanceToSupportPercent: null,
      distanceToResistancePercent: null,
    };
  }

  const lows = window.map((candle) => candle.low as number);
  const highs = window.map((candle) => candle.high as number);

  const supportLevel = Math.min(...lows);
  const resistanceLevel = Math.max(...highs);

  return {
    supportLevel: round(supportLevel),
    resistanceLevel: round(resistanceLevel),
    distanceToSupportPercent: round(
      ((current.close - supportLevel) / current.close) * 100
    ),
    distanceToResistancePercent: round(
      ((resistanceLevel - current.close) / current.close) * 100
    ),
  };
}

export function calculateMarketEvents({
  candles,
  sma50,
  sma200,
  macd,
  stochastic,
}: Inputs): Record<string, MarketEventsPoint> {
  const result: Record<string, MarketEventsPoint> = {};

  for (let i = 0; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    const currentDate = current.trading_date;
    const previousDate = previous?.trading_date;

    let macdCross: MarketEventsPoint["macdCross"] = "none";
    let stochCross: MarketEventsPoint["stochCross"] = "none";
    let maCross: MarketEventsPoint["maCross"] = "none";

    if (previousDate) {
      const currentMacd = macd[currentDate];
      const previousMacd = macd[previousDate];

      if (
        currentMacd?.macd !== null &&
        currentMacd?.signal !== null &&
        previousMacd?.macd !== null &&
        previousMacd?.signal !== null
      ) {
        if (
          previousMacd.macd <= previousMacd.signal &&
          currentMacd.macd > currentMacd.signal
        ) {
          macdCross = "bullish_cross";
        }

        if (
          previousMacd.macd >= previousMacd.signal &&
          currentMacd.macd < currentMacd.signal
        ) {
          macdCross = "bearish_cross";
        }
      }

      const currentStoch = stochastic[currentDate];
      const previousStoch = stochastic[previousDate];

      if (
        currentStoch?.stochK !== null &&
        currentStoch?.stochD !== null &&
        previousStoch?.stochK !== null &&
        previousStoch?.stochD !== null
      ) {
        if (
          previousStoch.stochK <= previousStoch.stochD &&
          currentStoch.stochK > currentStoch.stochD
        ) {
          stochCross = "bullish_cross";
        }

        if (
          previousStoch.stochK >= previousStoch.stochD &&
          currentStoch.stochK < currentStoch.stochD
        ) {
          stochCross = "bearish_cross";
        }
      }

      const currentSma50 = sma50[currentDate];
      const currentSma200 = sma200[currentDate];
      const previousSma50 = sma50[previousDate];
      const previousSma200 = sma200[previousDate];

      if (
        currentSma50 !== null &&
        currentSma200 !== null &&
        previousSma50 !== null &&
        previousSma200 !== null
      ) {
        if (previousSma50 <= previousSma200 && currentSma50 > currentSma200) {
          maCross = "golden_cross";
        }

        if (previousSma50 >= previousSma200 && currentSma50 < currentSma200) {
          maCross = "death_cross";
        }
      }
    }

    const supportResistance = calculateSupportResistance(candles, i);

    result[currentDate] = {
      macdCross,
      stochCross,
      maCross,
      candlePattern: detectCandlePattern(current, previous),
      ...supportResistance,
    };
  }

  return result;
}