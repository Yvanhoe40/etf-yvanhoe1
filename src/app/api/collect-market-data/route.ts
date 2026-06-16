import { supabase } from "@/lib/supabase";

type Candle = {
  trading_date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

async function collectOneEtf(etf: any) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      etf.ticker
    )}?interval=1d&range=1mo`,
    {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    }
  );

  const yahooData = await response.json();
  const result = yahooData?.chart?.result?.[0];

  if (!result) {
    return {
      ticker: etf.ticker,
      status: "error",
      error: "Yahoo data not found",
      yahooData,
    };
  }

  const meta = result.meta;
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};

  const candles: Candle[] = timestamps.map((timestamp: number, index: number) => ({
    trading_date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    open: quote.open?.[index] ?? null,
    high: quote.high?.[index] ?? null,
    low: quote.low?.[index] ?? null,
    close: quote.close?.[index] ?? null,
    volume: quote.volume?.[index] ?? null,
  }));

  const lastCandle = candles[candles.length - 1];

  if (!lastCandle) {
    return {
      ticker: etf.ticker,
      status: "error",
      error: "No candle found",
    };
  }

  const price = meta.regularMarketPrice ?? lastCandle.close;
  const previousClose = meta.chartPreviousClose ?? null;

  const { error: snapshotError } = await supabase
    .from("etf_market_snapshots")
    .insert({
      etf_id: etf.id,
      price,
      open_price: lastCandle.open,
      high_price: lastCandle.high,
      low_price: lastCandle.low,
      previous_close: previousClose,
      day_change:
        price !== null && previousClose
          ? price - previousClose
          : null,
      day_change_percent:
        price !== null && previousClose
          ? ((price - previousClose) / previousClose) * 100
          : null,
      volume: lastCandle.volume,
      market_status: "COLLECTED",
      raw_quote: meta,
    });

  if (snapshotError) {
    return {
      ticker: etf.ticker,
      status: "error",
      error: snapshotError.message,
    };
  }

  let upsertedCandles = 0;

  for (const candle of candles) {
    const { error: candleError } = await supabase
      .from("etf_ohlcv_daily")
      .upsert(
        {
          etf_id: etf.id,
          trading_date: candle.trading_date,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          raw_candle: candle,
        },
        { onConflict: "etf_id,trading_date" }
      );

    if (!candleError) upsertedCandles++;
  }

  return {
    ticker: etf.ticker,
    status: "success",
    currentPrice: price,
    upsertedCandles,
    lastCandle,
  };
}

export async function GET() {
  const { data: etfs, error } = await supabase
    .from("etfs")
    .select("*")
    .eq("is_active", true)
    .order("ticker");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!etfs || etfs.length === 0) {
    return Response.json({ error: "No active ETF found" }, { status: 404 });
  }

  const results = [];

  for (const etf of etfs) {
    const result = await collectOneEtf(etf);
    results.push(result);

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return Response.json({
    status: "completed",
    totalEtfs: etfs.length,
    successful: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "error").length,
    results,
  });
}