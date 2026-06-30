import { supabase } from "@/lib/supabase";
import { runAdvisorEngine } from "@/lib/engines/advisorEngine";
import type { MarketCandle } from "@/lib/engines/market/marketEngine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    let candles: any[] = [];
    let candlesError: any = null;

    for (let from = 0; from < 5000; from += 1000) {
      const to = from + 999;

      const { data, error } = await supabase
        .from("etf_ohlcv_daily")
        .select("trading_date, open, high, low, close, volume")
        .eq("etf_id", etf.id)
        .order("trading_date", { ascending: true })
        .range(from, to);

      if (error) {
        candlesError = error;
        break;
      }

      if (!data || data.length === 0) break;

      candles.push(...data);

      if (data.length < 1000) break;
    }

    if (candlesError) {
      results.push({
        ticker: etf.ticker,
        status: "error",
        error: candlesError.message,
      });
      continue;
    }

    if (candles.length < 50) {
      results.push({
        ticker: etf.ticker,
        status: "skipped",
        error: "Not enough historical candles",
        candles: candles.length,
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
        candlesLoaded: candles.length,
        lastCandle: marketCandles[marketCandles.length - 1].trading_date,
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
    generatedAt: new Date().toISOString(),
    totalEtfs: etfs.length,
    successful: results.filter((r) => r.status === "success").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "error").length,
    results,
  });
}