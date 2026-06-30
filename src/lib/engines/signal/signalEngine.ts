import type { TechnicalSnapshot } from "../market/buildTechnicalSnapshot";

export type SignalSentiment = "favorable" | "vigilance" | "vendeur";

export type MarketSignal = {
  code: string;
  category: "TENDANCE" | "MOMENTUM" | "MOYENNES" | "RISQUE";
  sentiment: SignalSentiment;
  label: string;
  explanation: string;
  importance: number;
};

export function runSignalEngine(snapshot: TechnicalSnapshot): MarketSignal[] {
  const signals: MarketSignal[] = [];

  if (snapshot.trend.direction === "haussier") {
    signals.push({
      code: "TREND_BULLISH",
      category: "TENDANCE",
      sentiment: "favorable",
      label: "Tendance globale haussière",
      explanation: `Le score de tendance est de ${snapshot.trend.trendScore}/100 avec une force ${snapshot.trend.strength}.`,
      importance: snapshot.trend.trendScore,
    });
  }

  if (snapshot.trend.direction === "baissier") {
    signals.push({
      code: "TREND_BEARISH",
      category: "TENDANCE",
      sentiment: "vendeur",
      label: "Tendance globale baissière",
      explanation: `Le score de tendance est de ${snapshot.trend.trendScore}/100 avec une force ${snapshot.trend.strength}.`,
      importance: 100 - snapshot.trend.trendScore,
    });
  }

  if (snapshot.trend.shortTerm === "baissier") {
    signals.push({
      code: "PRICE_BELOW_SMA20",
      category: "MOYENNES",
      sentiment: "vigilance",
      label: "Cours sous SMA20",
      explanation: "Le cours évolue sous la moyenne mobile 20 jours.",
      importance: 60,
    });
  }

  if (snapshot.trend.mediumTerm === "haussier") {
    signals.push({
      code: "SMA20_ABOVE_SMA50",
      category: "MOYENNES",
      sentiment: "favorable",
      label: "SMA20 au-dessus de la SMA50",
      explanation: "La tendance court terme reste supérieure à la tendance moyenne.",
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

  if (snapshot.performance.momentumLabel === "accélération haussière") {
    signals.push({
      code: "MOMENTUM_ACCELERATING",
      category: "MOMENTUM",
      sentiment: "favorable",
      label: "Momentum haussier en accélération",
      explanation: "La progression récente accélère par rapport à la tendance de fond.",
      importance: 70,
    });
  }

  if (snapshot.performance.momentumLabel === "pression baissière") {
    signals.push({
      code: "MOMENTUM_BEARISH",
      category: "MOMENTUM",
      sentiment: "vendeur",
      label: "Momentum baissier",
      explanation: "La dynamique récente montre une pression baissière.",
      importance: 75,
    });
  }

  if (snapshot.performance.momentumLabel === "ralentissement") {
    signals.push({
      code: "MOMENTUM_SLOWING",
      category: "MOMENTUM",
      sentiment: "vigilance",
      label: "Essoufflement de la tendance",
      explanation: "Le rythme de progression ralentit.",
      importance: 45,
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

  if (snapshot.momentum.stochSignal === "surachat") {
    signals.push({
      code: "STOCH_OVERBOUGHT",
      category: "MOMENTUM",
      sentiment: "vigilance",
      label: "Stochastique en surachat",
      explanation: `Le stochastique %K est à ${snapshot.momentum.stochK?.toFixed(2)}.`,
      importance: 65,
    });
  }

  if (snapshot.momentum.stochSignal === "survente") {
    signals.push({
      code: "STOCH_OVERSOLD",
      category: "MOMENTUM",
      sentiment: "favorable",
      label: "Stochastique en survente",
      explanation: `Le stochastique %K est à ${snapshot.momentum.stochK?.toFixed(2)}.`,
      importance: 65,
    });
  }

  if (snapshot.momentum.stochSignal === "haussier") {
    signals.push({
      code: "STOCH_BULLISH",
      category: "MOMENTUM",
      sentiment: "favorable",
      label: "Stochastique haussier",
      explanation: `Le stochastique %K (${snapshot.momentum.stochK?.toFixed(2)}) est au-dessus de %D (${snapshot.momentum.stochD?.toFixed(2)}).`,
      importance: 45,
    });
  }

  if (snapshot.momentum.stochSignal === "baissier") {
    signals.push({
      code: "STOCH_BEARISH",
      category: "MOMENTUM",
      sentiment: "vigilance",
      label: "Stochastique baissier",
      explanation: `Le stochastique %K (${snapshot.momentum.stochK?.toFixed(2)}) est sous %D (${snapshot.momentum.stochD?.toFixed(2)}).`,
      importance: 45,
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