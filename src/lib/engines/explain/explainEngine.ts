import type { DecisionResult } from "../decision/decisionEngine";

export type ExplainResult = {
  title: string;
  summary: string;
  mainReasonsText: string[];
};

export function runExplainEngine(decision: DecisionResult): ExplainResult {
  const mainReasons = decision.mainReasons || [];

  const labels = mainReasons.map((signal) => signal.label);
  const topReasons = labels.slice(0, 3).join(", ");

  const hasOverbought = mainReasons.some(
    (s) => s.code === "RSI_OVERBOUGHT" || s.code === "STOCH_OVERBOUGHT"
  );

  const hasBullishTrend = mainReasons.some(
    (s) => s.code === "TREND_BULLISH" || s.code === "SMA50_ABOVE_SMA200"
  );

  const hasBearishMomentum = mainReasons.some(
    (s) =>
      s.code === "MOMENTUM_BEARISH" ||
      s.code === "MACD_BEARISH" ||
      s.code === "STOCH_BEARISH"
  );

  let summary = "";

  if (decision.decisionName === "Acheter sur repli") {
    summary =
      "La tendance de fond reste positive, mais certains indicateurs de court terme signalent un risque de surchauffe. Le moteur privilégie donc un achat sur repli plutôt qu'un achat immédiat.";
  } else if (decision.decisionLevel === "strong_buy") {
    summary =
      "La configuration technique est très favorable. La tendance, le momentum et les principaux signaux convergent vers un scénario positif.";
  } else if (decision.decisionLevel === "buy") {
    summary =
      "La configuration reste favorable, mais le moteur ne détecte pas suffisamment de confirmations pour classer le signal en achat fort.";
  } else if (decision.decisionLevel === "hold") {
    summary =
      "Le moteur recommande de conserver. Les signaux sont partagés ou insuffisamment forts pour justifier un renforcement immédiat.";
  } else if (decision.decisionLevel === "reduce") {
    summary =
      "Le moteur recommande de réduire l'exposition. Plusieurs signaux de vigilance ou de faiblesse court terme pèsent sur la configuration.";
  } else if (decision.decisionLevel === "sell") {
    summary =
      "Le moteur recommande de vendre. Les signaux vendeurs dominent clairement les signaux favorables.";
  } else {
    summary =
      "Le moteur recommande d'attendre. La configuration actuelle ne donne pas encore un signal suffisamment clair.";
  }

  if (hasBullishTrend && hasOverbought) {
    summary +=
      " La tendance longue reste constructive, mais le surachat invite à attendre une respiration du marché.";
  }

  if (hasBearishMomentum && hasBullishTrend) {
    summary +=
      " La tendance de fond reste positive, mais le momentum court terme se détériore.";
  }

  if (topReasons) {
    summary += ` Les principaux facteurs identifiés sont : ${topReasons}.`;
  }

  summary += ` Le score de décision est de ${decision.score}/100 avec une confiance de ${decision.confidence}/100.`;

  return {
    title: decision.decisionName,
    summary,
    mainReasonsText: mainReasons.map(
      (signal) => `${signal.label} — ${signal.explanation}`
    ),
  };
}