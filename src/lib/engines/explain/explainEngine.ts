import type { DecisionResult } from "../decision/decisionEngine";

export type ExplainResult = {
  title: string;
  summary: string;
  mainReasonsText: string[];
};

export function runExplainEngine(decision: DecisionResult): ExplainResult {
  const mainReasonsText = decision.mainReasons.map(
    (reason) => `${reason.label} — ${reason.explanation}`
  );

  const topReasons = decision.mainReasons
    .slice(0, 3)
    .map((reason) => reason.label)
    .join(", ");

  return {
    title: decision.decisionName,

    summary:
      `La recommandation ${decision.decisionName} est principalement influencée par ${topReasons}. ` +
      `Le score de décision est de ${decision.score}/100 avec une confiance de ${decision.confidence}/100.`,

    mainReasonsText,
  };
}