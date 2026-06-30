import type { MarketAnalysisPoint } from "./marketEngine";

export type TechnicalSnapshot = {
  trading_date: string;
  close: number | null;

  trend: {
    shortTerm: "haussier" | "baissier" | "neutre";
    mediumTerm: "haussier" | "baissier" | "neutre";
    longTerm: "haussier" | "baissier" | "neutre";
    trendScore: number;
    direction: "haussier" | "neutre" | "baissier";
    strength: "faible" | "moyenne" | "forte";
    confidence: number;
  };

  momentum: {
    rsi14: number | null;
    rsiZone: "surachat" | "survente" | "neutre" | null;
    macdStatus: "haussier" | "baissier" | "neutre";
    stochK: number | null;
    stochD: number | null;
    stochSignal: "surachat" | "survente" | "haussier" | "baissier" | "neutre";
  };

  performance: {
    change1d: number | null;
    change5d: number | null;
    change20d: number | null;
    change50d: number | null;
    momentumLabel:
      | "accélération haussière"
      | "ralentissement"
      | "pression baissière"
      | "neutre";
  };

  movingAverages: {
    sma20: number | null;
    sma50: number | null;
    sma100: number | null;
    sma200: number | null;
  };
};

function compareValues(
  a: number | null,
  b: number | null
): "haussier" | "baissier" | "neutre" {
  if (a === null || b === null) return "neutre";
  if (a > b) return "haussier";
  if (a < b) return "baissier";
  return "neutre";
}

export function buildTechnicalSnapshot(
  point: MarketAnalysisPoint
): TechnicalSnapshot {
  const macdStatus = compareValues(point.macd, point.macdSignal);

  return {
    trading_date: point.trading_date,
    close: point.close,

    trend: {
      shortTerm: compareValues(point.close, point.sma20),
      mediumTerm: compareValues(point.sma20, point.sma50),
      longTerm: compareValues(point.sma50, point.sma200),
      trendScore: point.trendScore,
      direction: point.trendDirection,
      strength: point.trendStrength,
      confidence: point.trendConfidence,
    },

    momentum: {
      rsi14: point.rsi14,
      rsiZone: point.rsiZone,
      macdStatus,
      stochK: point.stochK,
      stochD: point.stochD,
      stochSignal: point.stochSignal,
    },

    performance: {
      change1d: point.change1d,
      change5d: point.change5d,
      change20d: point.change20d,
      change50d: point.change50d,
      momentumLabel: point.momentumLabel,
    },

    movingAverages: {
      sma20: point.sma20,
      sma50: point.sma50,
      sma100: point.sma100,
      sma200: point.sma200,
    },
  };
}