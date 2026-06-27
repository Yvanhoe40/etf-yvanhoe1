import { supabase } from "@/lib/supabase";
import type { DecisionResult } from "../decision/decisionEngine";
import type { ExplainResult } from "../explain/explainEngine";
import type { MarketSignal } from "../signal/signalEngine";
import type { TechnicalSnapshot } from "../market/buildTechnicalSnapshot";

export async function persistAnalysis(
  etfId: string,
  ticker: string,
  snapshot: TechnicalSnapshot,
  signals: MarketSignal[],
  decision: DecisionResult,
  explanation: ExplainResult
) {
  const { error } = await supabase
    .from("etf_analysis_history")
    .upsert(
      {
        etf_id: etfId,
        ticker,

        analysis_date: snapshot.trading_date,

        close: snapshot.close,

        trend_score: snapshot.trend.trendScore,
        trend_direction: snapshot.trend.direction,
        trend_strength: snapshot.trend.strength,
        trend_confidence: snapshot.trend.confidence,

        decision_level: decision.decisionLevel,
        decision_name: decision.decisionName,
        decision_score: decision.score,
        decision_confidence: decision.confidence,

        favorable_score: decision.favorableScore,
        vigilance_score: decision.vigilanceScore,
        seller_score: decision.sellerScore,

        signals,

        explanation,
      },
      {
        onConflict: "etf_id,analysis_date,engine_version",
      }
    );

  if (error) {
    throw error;
  }
}