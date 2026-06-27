import type { TechnicalSnapshot } from "../market/buildTechnicalSnapshot";

export type SignalSentiment = "favorable" | "vigilance" | "vendeur";

export type MarketSignal = {
  code: string;
  category: "TENDANCE" | "MOMENTUM" | "MOYENNES";
  sentiment: SignalSentiment;
  label: string;
  explanation: string;
  importance: number;
};

export function runSignalEngine(
  snapshot: TechnicalSnapshot
): MarketSignal[] {
  const signals: MarketSignal[] = [];

  if (snapshot.trend.shortTerm === "haussier") {
    signals.push({
      code: "PRICE_ABOVE_SMA20",
      category: "TENDANCE",
      sentiment: "favorable",
      label: "Cours au-dessus de la SMA20",
      explanation: "Le cours évolue au-dessus de la moyenne mobile 20 jours.",
      importance: 55,
    });
  }

  if (snapshot.trend.shortTerm === "baissier") {
    signals.push({
      code: "PRICE_BELOW_SMA20",
      category: "TENDANCE",
      sentiment: "vigilance",
      label: "Cours sous la SMA20",
      explanation: "Le cours évolue sous la moyenne mobile 20 jours.",
      importance: 60,
    });
  }

  if (snapshot.trend.mediumTerm === "haussier") {
    signals.push({
      code: "SMA20_ABOVE_SMA50",
      category: "MOYENNES",
      sentiment: "favorable",
      label: "Tendance court terme positive",
      explanation: "La SMA20 évolue au-dessus de la SMA50.",
      importance: 45,
    });
  }

  if (snapshot.trend.longTerm === "haussier") {
    signals.push({
      code: "SMA50_ABOVE_SMA200",
      category: "MOYENNES",
      sentiment: "favorable",
      label: "Tendance long terme positive",
      explanation: "La SMA50 évolue au-dessus de la SMA200.",
      importance: 70,
    });
  }

  if (snapshot.momentum.rsiZone === "surachat") {
    signals.push({
      code: "RSI_OVERBOUGHT",
      category: "MOMENTUM",
      sentiment: "vigilance",
      label: "RSI en surachat",
      explanation: `Le RSI14 est à ${snapshot.momentum.rsi14?.toFixed(2)}.`,
      importance: 75,
    });
  }

  if (snapshot.momentum.rsiZone === "survente") {
    signals.push({
      code: "RSI_OVERSOLD",
      category: "MOMENTUM",
      sentiment: "favorable",
      label: "RSI en survente",
      explanation: `Le RSI14 est à ${snapshot.momentum.rsi14?.toFixed(2)}.`,
      importance: 75,
    });
  }

  if (snapshot.momentum.macdStatus === "haussier") {
    signals.push({
      code: "MACD_BULLISH",
      category: "MOMENTUM",
      sentiment: "favorable",
      label: "MACD haussier",
      explanation: "Le MACD évolue au-dessus de sa ligne de signal.",
      importance: 65,
    });
  }

  if (snapshot.momentum.macdStatus === "baissier") {
    signals.push({
      code: "MACD_BEARISH",
      category: "MOMENTUM",
      sentiment: "vigilance",
      label: "MACD baissier",
      explanation: "Le MACD évolue sous sa ligne de signal.",
      importance: 65,
    });
  }

  return signals.sort((a, b) => b.importance - a.importance);
}