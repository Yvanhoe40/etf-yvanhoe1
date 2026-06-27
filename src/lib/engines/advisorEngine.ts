import { runMarketEngine, type MarketCandle } from "./market/marketEngine";
import { buildTechnicalSnapshot } from "./market/buildTechnicalSnapshot";
import { runSignalEngine } from "./signal/signalEngine";
import { runDecisionEngine } from "./decision/decisionEngine";
import { runExplainEngine } from "./explain/explainEngine";
import { persistAnalysis } from "./persistence/persistenceEngine";

export async function runAdvisorEngine(
  candles: MarketCandle[],
  options?: {
    etfId?: string;
    ticker?: string;
    persist?: boolean;
  }
) {
  const marketPoints = runMarketEngine(candles);
  const latestPoint = marketPoints[marketPoints.length - 1];

  console.log(
  "LATEST POINT",
  latestPoint.trading_date
);


  if (!latestPoint) {
    return null;
  }

  const snapshot = buildTechnicalSnapshot(latestPoint);
  const signals = runSignalEngine(snapshot);
  const decision = runDecisionEngine(signals);
  const explanation = runExplainEngine(decision);

  if (options?.persist && options.etfId && options.ticker) {
    await persistAnalysis(
      options.etfId,
      options.ticker,
      snapshot,
      signals,
      decision,
      explanation
    );
  }

  return {
    snapshot,
    signals,
    decision,
    explanation,
  };
}