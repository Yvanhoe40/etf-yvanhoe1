import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ForecastResult = {
  id: string;
  etf_id: string;
  ticker: string;
  decision_name: string | null;
  decision_level: string | null;
  close_price: number | null;
  analysis_date: string | null;
  forecast_runs:
    | {
        forecast_for: string;
        run_type: string;
        }[]
    | null;
};

function calculateReturn(entryPrice: number, exitPrice: number) {
  if (!entryPrice || entryPrice === 0) return null;
  return ((exitPrice - entryPrice) / entryPrice) * 100;
}

function evaluatePrediction(decisionName: string | null, returnPercent: number | null) {
  if (returnPercent === null || !decisionName) {
    return { result: "UNKNOWN", score: 0 };
  }

  const decision = decisionName.toLowerCase();

  const isBuy =
    decision.includes("acheter") ||
    decision.includes("achat");

  const isSell =
    decision.includes("vendre") ||
    decision.includes("réduire") ||
    decision.includes("reduire");

  const isHold =
    decision.includes("conserver");

  if (isBuy) {
    if (returnPercent > 0.5) return { result: "SUCCESS", score: 100 };
    if (returnPercent >= -0.5) return { result: "NEUTRAL", score: 50 };
    return { result: "FAIL", score: 0 };
  }

  if (isSell) {
    if (returnPercent < -0.5) return { result: "SUCCESS", score: 100 };
    if (returnPercent <= 0.5) return { result: "NEUTRAL", score: 50 };
    return { result: "FAIL", score: 0 };
  }

  if (isHold) {
    if (returnPercent >= -1 && returnPercent <= 1) {
      return { result: "SUCCESS", score: 100 };
    }
    if (returnPercent > 1 && returnPercent <= 2) {
      return { result: "NEUTRAL", score: 60 };
    }
    if (returnPercent < -1 && returnPercent >= -2) {
      return { result: "NEUTRAL", score: 60 };
    }
    return { result: "FAIL", score: 0 };
  }

  return { result: "UNKNOWN", score: 0 };
}

async function getExitPrice(etfId: string, fromDate: string, offset: number) {
  const { data, error } = await supabase
    .from("etf_ohlcv_daily")
    .select("trading_date, close")
    .eq("etf_id", etfId)
    .gte("trading_date", fromDate)
    .order("trading_date", { ascending: true })
    .limit(offset);

  if (error || !data || data.length < offset) {
    return null;
  }

  const candle = data[offset - 1];

  return {
    date: candle.trading_date,
    close: Number(candle.close),
  };
}

export async function GET() {
  const startedAt = new Date();

const { data: forecasts, error } = await supabase
  .from("forecast_results")
  .select(`
    id,
    etf_id,
    ticker,
    decision_name,
    decision_level,
    close_price,
    analysis_date,
    run_id,
    forecast_runs!inner(
      forecast_for,
      run_type
    )
  `)
  .eq("validated", false)
  .not("close_price", "is", null)
  .limit(500);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const forecast of (forecasts || []) as ForecastResult[]) {
    const forecastRun = forecast.forecast_runs?.[0];
    const forecastFor = forecastRun?.forecast_for;

    if (!forecastFor || forecast.close_price === null) {
      results.push({
        ticker: forecast.ticker,
        status: "skipped",
        reason: "Missing forecast_for or entry price",
      });
      continue;
    }

    const entryPrice = Number(forecast.close_price);

    const exit1d = await getExitPrice(forecast.etf_id, forecastFor, 1);
    const exit2d = await getExitPrice(forecast.etf_id, forecastFor, 2);
    const exit5d = await getExitPrice(forecast.etf_id, forecastFor, 5);
    const exit10d = await getExitPrice(forecast.etf_id, forecastFor, 10);

    if (!exit1d) {
      results.push({
        ticker: forecast.ticker,
        status: "pending",
        reason: "No 1D market data yet",
        forecastFor,
      });
      continue;
    }

    const return1d = calculateReturn(entryPrice, exit1d.close);
    const eval1d = evaluatePrediction(forecast.decision_name, return1d);

    const return2d = exit2d ? calculateReturn(entryPrice, exit2d.close) : null;
    const eval2d = exit2d
      ? evaluatePrediction(forecast.decision_name, return2d)
      : { result: null, score: null };

    const return5d = exit5d ? calculateReturn(entryPrice, exit5d.close) : null;
    const eval5d = exit5d
      ? evaluatePrediction(forecast.decision_name, return5d)
      : { result: null, score: null };

    const return10d = exit10d ? calculateReturn(entryPrice, exit10d.close) : null;
    const eval10d = exit10d
      ? evaluatePrediction(forecast.decision_name, return10d)
      : { result: null, score: null };

    const { error: updateError } = await supabase
      .from("forecast_results")
      .update({
        entry_price: entryPrice,

        exit_price_1d: exit1d.close,
        return_1d_percent: return1d,
        result_1d: eval1d.result,
        score_1d: eval1d.score,

        exit_price_2d: exit2d?.close ?? null,
        return_2d_percent: return2d,
        result_2d: eval2d.result,
        score_2d: eval2d.score,

        exit_price_5d: exit5d?.close ?? null,
        return_5d_percent: return5d,
        result_5d: eval5d.result,
        score_5d: eval5d.score,

        exit_price_10d: exit10d?.close ?? null,
        return_10d_percent: return10d,
        result_10d: eval10d.result,
        score_10d: eval10d.score,

        validated: true,
        validated_at: new Date().toISOString(),
        validation_date: exit1d.date,
        actual_close_price: exit1d.close,
        actual_return_percent: return1d,
        prediction_result: eval1d.result,
        validation_comment: `Validation automatique 1D : ${eval1d.result}`,
      })
      .eq("id", forecast.id);

    if (updateError) {
      results.push({
        ticker: forecast.ticker,
        status: "error",
        error: updateError.message,
      });
      continue;
    }

    results.push({
      ticker: forecast.ticker,
      status: "validated",
      decision: forecast.decision_name,
      forecastFor,
      entryPrice,
      exit1d: exit1d.close,
      return1d,
      result1d: eval1d.result,
      score1d: eval1d.score,
    });
  }

  const completedAt = new Date();

  return Response.json({
    status: "completed",
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    total: forecasts?.length || 0,
    validated: results.filter((r) => r.status === "validated").length,
    pending: results.filter((r) => r.status === "pending").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "error").length,
    results,
  });
}