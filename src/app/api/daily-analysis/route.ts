import { supabase } from "@/lib/supabase";
import { runAdvisorEngine } from "@/lib/engines/advisorEngine";
import type { MarketCandle } from "@/lib/engines/market/marketEngine";

export async function GET() {
  const { data: etfs, error: etfsError } = await supabase
    .from("etfs")
    .select("*")
    .eq("is_active", true)
    .order("ticker");

  if (etfsError) {
    return Response.json({ error: etfsError.message }, { status: 500 });
  }

  if (!etfs || etfs.length === 0) {
    return Response.json({ error: "No active ETF found" }, { status: 404 });
  }

  const results = [];

  for (const etf of etfs) {
    const { data: candles, error: candlesError } = await supabase
      .from("etf_ohlcv_daily")
      .select("trading_date, open, high, low, close, volume")
      .eq("etf_id", etf.id)
      .order("trading_date", { ascending: true });

    if (candlesError) {
      results.push({
        ticker: etf.ticker,
        status: "error",
        error: candlesError.message,
      });
      continue;
    }

    if (!candles || candles.length < 50) {
      results.push({
        ticker: etf.ticker,
        status: "skipped",
        error: "Not enough historical candles",
        candles: candles?.length ?? 0,
      });
      continue;
    }

    const marketCandles: MarketCandle[] = candles.map((candle) => ({
      trading_date: candle.trading_date,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));

    try {
      const analysis = await runAdvisorEngine(marketCandles, {
        etfId: etf.id,
        ticker: etf.ticker,
        persist: true,
      });

      results.push({
        ticker: etf.ticker,
        status: "success",
        analysisDate: analysis?.snapshot.trading_date,
        decision: analysis?.decision.decisionName,
        score: analysis?.decision.score,
        confidence: analysis?.decision.confidence,
        signals: analysis?.signals.length,
      });
    } catch (error) {
      results.push({
        ticker: etf.ticker,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return Response.json({
    status: "completed",
    totalEtfs: etfs.length,
    successful: results.filter((r) => r.status === "success").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "error").length,
    results,
  });
}