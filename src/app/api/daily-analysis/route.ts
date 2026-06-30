import { supabase } from "@/lib/supabase";
import { runAdvisorEngine } from "@/lib/engines/advisorEngine";
import type { MarketCandle } from "@/lib/engines/market/marketEngine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBelgiumDate(offsetDays = 0) {
  const now = new Date();

  const belgiumDate = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Brussels" })
  );

  belgiumDate.setDate(belgiumDate.getDate() + offsetDays);

  return belgiumDate.toISOString().slice(0, 10);
}

function getForecastFor(runType: string) {
  if (
    runType === "morning" ||
    runType === "pre_open_eu" ||
    runType === "intraday" ||
    runType === "intraday_monitor"
  ) {
    return getBelgiumDate(0);
  }

  if (
    runType === "pre_us" ||
    runType === "pre_open_us" ||
    runType === "after_us" ||
    runType === "post_close_us"
  ) {
    return getBelgiumDate(1);
  }

  return getBelgiumDate(1);
}

export async function GET(request: Request) {
  const startedAt = new Date();
  const generatedAt = startedAt.toISOString();

  const { searchParams } = new URL(request.url);

  const runType = searchParams.get("type") ?? "manual";
  const forecastFor =
    searchParams.get("forecastFor") ?? getForecastFor(runType);

  const { data: forecastRun, error: forecastRunError } = await supabase
    .from("forecast_runs")
    .insert({
      run_type: runType,
      generated_at: generatedAt,
      forecast_for: forecastFor,
      engine_version: "2.1.0",
      market_status: "generated",
      source: "daily-analysis",
      status: "running",
      started_at: generatedAt,
    })
    .select("id")
    .single();

  if (forecastRunError || !forecastRun) {
    return Response.json(
      { error: forecastRunError?.message || "Unable to create forecast run" },
      { status: 500 }
    );
  }

  const { data: etfs, error: etfsError } = await supabase
    .from("etfs")
    .select("*")
    .eq("is_active", true)
    .order("ticker");

  if (etfsError) {
    await supabase
      .from("forecast_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", forecastRun.id);

    return Response.json({ error: etfsError.message }, { status: 500 });
  }

  if (!etfs || etfs.length === 0) {
    await supabase
      .from("forecast_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", forecastRun.id);

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

      if (!analysis) {
        results.push({
          ticker: etf.ticker,
          status: "skipped",
          error: "No analysis generated",
        });
        continue;
      }

      const { error: forecastResultError } = await supabase
        .from("forecast_results")
        .insert({
          run_id: forecastRun.id,
          etf_id: etf.id,
          ticker: etf.ticker,
          decision_level: analysis.decision.decisionLevel,
          decision_name: analysis.decision.decisionName,
          decision_score: analysis.decision.score,
          decision_confidence: analysis.decision.confidence,
          close_price: analysis.snapshot.close,
          analysis_date: analysis.snapshot.trading_date,
          signals: analysis.signals,
          explanation: analysis.explanation,
          prediction_horizon: "1d",
          validated: false,
        });

      if (forecastResultError) {
        results.push({
          ticker: etf.ticker,
          status: "error",
          error: forecastResultError.message,
        });
        continue;
      }

      results.push({
        ticker: etf.ticker,
        status: "success",
        candlesLoaded: candles.length,
        lastCandle: marketCandles[marketCandles.length - 1].trading_date,
        analysisDate: analysis.snapshot.trading_date,
        decision: analysis.decision.decisionName,
        score: analysis.decision.score,
        confidence: analysis.decision.confidence,
        signals: analysis.signals.length,
      });
    } catch (error) {
      results.push({
        ticker: etf.ticker,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  const successful = results.filter((r) => r.status === "success").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "error").length;

  await supabase
    .from("forecast_runs")
    .update({
      status: failed > 0 ? "completed_with_errors" : "completed",
      completed_at: completedAt.toISOString(),
      duration_ms: durationMs,
      total_etfs: etfs.length,
      successful_etfs: successful,
      skipped_etfs: skipped,
      failed_etfs: failed,
    })
    .eq("id", forecastRun.id);

  return Response.json({
    status: failed > 0 ? "completed_with_errors" : "completed",
    generatedAt,
    completedAt: completedAt.toISOString(),
    durationMs,
    forecastRunId: forecastRun.id,
    runType,
    forecastFor,
    totalEtfs: etfs.length,
    successful,
    skipped,
    failed,
    results,
  });
}