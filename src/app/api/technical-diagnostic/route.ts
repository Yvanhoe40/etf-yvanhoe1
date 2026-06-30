import { supabase } from "@/lib/supabase";
import { runMarketEngine, type MarketCandle } from "@/lib/engines/market/marketEngine";
import { buildTechnicalSnapshot } from "@/lib/engines/market/buildTechnicalSnapshot";
import { runSignalEngine } from "@/lib/engines/signal/signalEngine";
import { runDecisionEngine } from "@/lib/engines/decision/decisionEngine";

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

  const results = [];

  for (const etf of etfs || []) {
    const { data: candles, error: candlesError } = await supabase
      .from("etf_ohlcv_daily")
      .select("trading_date, open, high, low, close, volume")
      .eq("etf_id", etf.id)
      .order("trading_date", { ascending: true })
      .range(0, 4999);

    if (candlesError || !candles || candles.length < 50) {
      results.push({
        ticker: etf.ticker,
        status: "skipped",
        error: candlesError?.message || "Not enough candles",
        candles: candles?.length || 0,
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

    const marketPoints = runMarketEngine(marketCandles);
    const latestPoint = [...marketPoints]
      .reverse()
      .find((point) => point.close !== null);

    if (!latestPoint) {
      results.push({
        ticker: etf.ticker,
        status: "skipped",
        error: "No latest point",
      });
      continue;
    }

    const snapshot = buildTechnicalSnapshot(latestPoint);
    const signals = runSignalEngine(snapshot);
    const decision = runDecisionEngine(snapshot, signals);

    results.push({
      ticker: etf.ticker,
      name: etf.name,
      status: "success",

      date: latestPoint.trading_date,
      close: latestPoint.close,
      volume: latestPoint.volume,

      indicators: {
        sma20: latestPoint.sma20,
        sma50: latestPoint.sma50,
        sma100: latestPoint.sma100,
        sma200: latestPoint.sma200,
        ema12: latestPoint.ema12,
        ema26: latestPoint.ema26,

        rsi14: latestPoint.rsi14,
        rsiZone: latestPoint.rsiZone,

        stochK: latestPoint.stochK,
        stochD: latestPoint.stochD,
        stochSignal: latestPoint.stochSignal,

        macd: latestPoint.macd,
        macdSignal: latestPoint.macdSignal,
        macdHistogram: latestPoint.macdHistogram,

        change1d: latestPoint.change1d,
        change5d: latestPoint.change5d,
        change20d: latestPoint.change20d,
        change50d: latestPoint.change50d,
        momentumLabel: latestPoint.momentumLabel,

        trendScore: latestPoint.trendScore,
        trendDirection: latestPoint.trendDirection,
        trendStrength: latestPoint.trendStrength,
        trendConfidence: latestPoint.trendConfidence,

      signals: signals.map((signal) => ({
        code: signal.code,
        sentiment: signal.sentiment,
        importance: signal.importance,
        label: signal.label,
        explanation: signal.explanation,
      })),

      decision: {
        name: decision.decisionName,
        level: decision.decisionLevel,
        score: decision.score,
        confidence: decision.confidence,
      },
    });
  }

  return Response.json({
    status: "completed",
    generatedAt: new Date().toISOString(),
    count: results.length,
    results,
  });
}