import type { MarketAnalysisPoint } from "./marketEngine";

export type TechnicalSnapshot = {
  trading_date: string;
  close: number | null;

  trend: {
    shortTerm: "haussier" | "baissier" | "neutre";
    mediumTerm: "haussier" | "baissier" | "neutre";
    longTerm: "haussier" | "baissier" | "neutre";
  };

  momentum: {
    rsi14: number | null;
    rsiZone: "surachat" | "survente" | "neutre" | null;
    macdStatus: "haussier" | "baissier" | "neutre";
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
    },

    momentum: {
      rsi14: point.rsi14,
      rsiZone: point.rsiZone,
      macdStatus,
    },

    movingAverages: {
      sma20: point.sma20,
      sma50: point.sma50,
      sma100: point.sma100,
      sma200: point.sma200,
    },
  };
}