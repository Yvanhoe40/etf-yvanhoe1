import { runMarketEngine, type MarketCandle } from "./market/marketEngine";
import { buildTechnicalSnapshot } from "./market/buildTechnicalSnapshot";
import { runSignalEngine } from "./signal/signalEngine";
import { runDecisionEngine } from "./decision/decisionEngine";
import { runExplainEngine } from "./explain/explainEngine";

export function runAdvisorEngine(candles: MarketCandle[]) {
  const marketPoints = runMarketEngine(candles);

  const latestPoint = marketPoints[marketPoints.length - 1];

  if (!latestPoint) {
    return null;
  }

  const snapshot = buildTechnicalSnapshot(latestPoint);
  const signals = runSignalEngine(snapshot);
  const decision = runDecisionEngine(signals);
  const explanation = runExplainEngine(decision);

  return {
    snapshot,
    signals,
    decision,
    explanation,
  };
}