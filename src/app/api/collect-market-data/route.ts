import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: etfs, error } = await supabase
    .from("etfs")
    .select("*")
    .eq("is_active", true)
    .limit(1);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!etfs || etfs.length === 0) {
    return Response.json(
      { error: "No active ETF found" },
      { status: 404 }
    );
  }

  const etf = etfs[0];

  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      etf.ticker
    )}?interval=1d&range=1mo`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    }
  );

  const yahooData = await response.json();

  const result = yahooData?.chart?.result?.[0];

  if (!result) {
    return Response.json(
      {
        error: "Yahoo data not found",
        yahooData,
      },
      { status: 500 }
    );
  }

  const meta = result.meta;

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};

  const candles = timestamps.map((timestamp: number, index: number) => ({
    trading_date: new Date(timestamp * 1000)
      .toISOString()
      .slice(0, 10),

    open: quote.open?.[index] ?? null,
    high: quote.high?.[index] ?? null,
    low: quote.low?.[index] ?? null,
    close: quote.close?.[index] ?? null,
    volume: quote.volume?.[index] ?? null,
  }));

  const lastCandle = candles[candles.length - 1];

  // Snapshot

  const { error: snapshotError } = await supabase
    .from("etf_market_snapshots")
    .insert({
      etf_id: etf.id,
      price: meta.regularMarketPrice,
      open_price: lastCandle.open,
      high_price: lastCandle.high,
      low_price: lastCandle.low,
      previous_close: meta.chartPreviousClose,
      day_change:
        meta.regularMarketPrice - meta.chartPreviousClose,
      day_change_percent:
        ((meta.regularMarketPrice -
          meta.chartPreviousClose) /
          meta.chartPreviousClose) *
        100,
      volume: lastCandle.volume,
      market_status: "OPEN",
      raw_quote: meta,
    });

  if (snapshotError) {
    return Response.json(
      { error: snapshotError.message },
      { status: 500 }
    );
  }

  // Bougies journalières

  let insertedCandles = 0;

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
        {
          onConflict: "etf_id,trading_date",
        }
      );

    if (!candleError) {
      insertedCandles++;
    }
  }

  return Response.json({
    status: "success",
    etf: etf.ticker,
    currentPrice: meta.regularMarketPrice,
    insertedCandles,
    lastCandle,
  });
}