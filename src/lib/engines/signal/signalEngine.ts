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

  const isBullishTrend = snapshot.trend.direction === "haussier";
  const isStrongBullishTrend =
    snapshot.trend.direction === "haussier" &&
    snapshot.trend.trendScore >= 80 &&
    snapshot.trend.strength === "forte";

  const isBearishTrend = snapshot.trend.direction === "baissier";
  const longTermPositive = snapshot.trend.longTerm === "haussier";
  const shortTermWeak = snapshot.trend.shortTerm === "baissier";
  const mediumTermPositive = snapshot.trend.mediumTerm === "haussier";

  if (isBullishTrend) {
    signals.push({
      code: "TREND_BULLISH",
      category: "TENDANCE",
      sentiment: "favorable",
      label: "Tendance globale haussière",
      explanation: `Le score de tendance est de ${snapshot.trend.trendScore}/100 avec une force ${snapshot.trend.strength}.`,
      importance: snapshot.trend.trendScore,
    });
  }

  if (isBearishTrend) {
    signals.push({
      code: "TREND_BEARISH",
      category: "TENDANCE",
      sentiment: longTermPositive ? "vigilance" : "vendeur",
      label: longTermPositive
        ? "Correction dans une tendance long terme positive"
        : "Tendance globale baissière",
      explanation: longTermPositive
        ? "La tendance court/moyen terme se détériore, mais la tendance long terme reste encore positive."
        : `Le score de tendance est de ${snapshot.trend.trendScore}/100 avec une force ${snapshot.trend.strength}.`,
      importance: longTermPositive ? 55 : 100 - snapshot.trend.trendScore,
    });
  }

  if (shortTermWeak) {
    signals.push({
      code: "PRICE_BELOW_SMA20",
      category: "MOYENNES",
      sentiment: isBullishTrend || longTermPositive ? "vigilance" : "vendeur",
      label:
        isBullishTrend || longTermPositive
          ? "Correction court terme sous SMA20"
          : "Cours sous SMA20",
      explanation:
        isBullishTrend || longTermPositive
          ? "Le cours passe sous la SMA20, ce qui signale une correction court terme plutôt qu'une cassure de fond."
          : "Le cours évolue sous la moyenne mobile 20 jours.",
      importance: isBullishTrend || longTermPositive ? 45 : 60,
    });
  }

  if (mediumTermPositive) {
    signals.push({
      code: "SMA20_ABOVE_SMA50",
      category: "MOYENNES",
      sentiment: "favorable",
      label: "SMA20 au-dessus de la SMA50",
      explanation: "La tendance court terme reste supérieure à la tendance moyenne.",
      importance: 45,
    });
  }

  if (longTermPositive) {
    signals.push({
      code: "SMA50_ABOVE_SMA200",
      category: "MOYENNES",
      sentiment: "favorable",
      label: "Tendance long terme positive",
      explanation: "La SMA50 évolue au-dessus de la SMA200.",
      importance: 70,
    });
  }

  if (
    longTermPositive &&
    shortTermWeak &&
    snapshot.momentum.rsi14 !== null &&
    snapshot.momentum.rsi14 >= 35 &&
    snapshot.momentum.rsi14 <= 55
  ) {
    signals.push({
      code: "PULLBACK_POTENTIAL",
      category: "RISQUE",
      sentiment: "favorable",
      label: "Pullback potentiel",
      explanation:
        "Le recul court terme intervient alors que la tendance long terme reste positive. Cela peut devenir une zone de surveillance pour un point d'entrée.",
      importance: 55,
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
      sentiment: isBullishTrend || longTermPositive ? "vigilance" : "vendeur",
      label:
        isBullishTrend || longTermPositive
          ? "Momentum court terme négatif"
          : "Momentum baissier",
      explanation:
        isBullishTrend || longTermPositive
          ? "La dynamique récente se dégrade, mais la tendance de fond n'est pas nécessairement cassée."
          : "La dynamique récente montre une pression baissière.",
      importance: isBullishTrend || longTermPositive ? 55 : 75,
    });
  }

  if (snapshot.performance.momentumLabel === "ralentissement") {
    signals.push({
      code: "MOMENTUM_SLOWING",
      category: "MOMENTUM",
      sentiment: "vigilance",
      label: "Essoufflement de la tendance",
      explanation: "Le rythme de progression ralentit.",
      importance: isStrongBullishTrend ? 35 : 45,
    });
  }

  if (snapshot.momentum.rsiZone === "surachat") {
    signals.push({
      code: "RSI_OVERBOUGHT",
      category: "MOMENTUM",
      sentiment: "vigilance",
      label: isStrongBullishTrend
        ? "RSI en surachat dans tendance forte"
        : "RSI en surachat",
      explanation: isStrongBullishTrend
        ? `Le RSI14 est à ${snapshot.momentum.rsi14?.toFixed(2)}. La tendance reste forte, mais le timing d'achat immédiat devient moins favorable.`
        : `Le RSI14 est à ${snapshot.momentum.rsi14?.toFixed(2)}.`,
      importance: isStrongBullishTrend ? 65 : 75,
    });
  }

  if (snapshot.momentum.rsiZone === "survente") {
    signals.push({
      code: "RSI_OVERSOLD",
      category: "MOMENTUM",
      sentiment: "favorable",
      label: "RSI en survente",
      explanation: `Le RSI14 est à ${snapshot.momentum.rsi14?.toFixed(2)}.`,
      importance: isBearishTrend && !longTermPositive ? 45 : 75,
    });
  }

  if (snapshot.momentum.stochSignal === "surachat") {
    signals.push({
      code: "STOCH_OVERBOUGHT",
      category: "MOMENTUM",
      sentiment: "vigilance",
      label: "Stochastique en surachat",
      explanation: `Le stochastique %K est à ${snapshot.momentum.stochK?.toFixed(2)}.`,
      importance: isStrongBullishTrend ? 50 : 65,
    });
  }

  if (snapshot.momentum.stochSignal === "survente") {
    signals.push({
      code: "STOCH_OVERSOLD",
      category: "MOMENTUM",
      sentiment: "favorable",
      label: "Stochastique en survente",
      explanation: `Le stochastique %K est à ${snapshot.momentum.stochK?.toFixed(2)}.`,
      importance: isBearishTrend && !longTermPositive ? 35 : 65,
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
      importance: isBullishTrend || longTermPositive ? 35 : 45,
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
      sentiment: isBullishTrend || longTermPositive ? "vigilance" : "vendeur",
      label:
        isBullishTrend || longTermPositive
          ? "MACD baissier court terme"
          : "MACD baissier",
      explanation:
        isBullishTrend || longTermPositive
          ? "Le MACD passe sous sa ligne de signal, mais la tendance de fond reste à surveiller avant de conclure à une cassure."
          : "Le MACD évolue sous sa ligne de signal.",
      importance: isBullishTrend || longTermPositive ? 50 : 65,
    });
  }

  return signals.sort((a, b) => b.importance - a.importance);
}