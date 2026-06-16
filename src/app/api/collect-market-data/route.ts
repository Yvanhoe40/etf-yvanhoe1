import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: etfs, error } = await supabase
    .from("etfs")
    .select("id, ticker, name, exchange, currency, region, topic, is_active")
    .eq("is_active", true)
    .limit(1);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!etfs || etfs.length === 0) {
    return Response.json({ error: "No active ETF found" }, { status: 404 });
  }

  const etf = etfs[0];
  const yahooSymbol = etf.ticker;

  const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?interval=1d&range=1mo`;

  const response = await fetch(quoteUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
    cache: "no-store",
  });

  const yahooData = await response.json();
  const result = yahooData?.chart?.result?.[0];

  if (!result) {
    return Response.json({
      status: "error",
      testedEtf: etf,
      yahooResponse: yahooData,
    });
  }

  const meta = result.meta;
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};

  const candles = timestamps.map((timestamp: number, index: number) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    open: quote.open?.[index] ?? null,
    high: quote.high?.[index] ?? null,
    low: quote.low?.[index] ?? null,
    close: quote.close?.[index] ?? null,
    volume: quote.volume?.[index] ?? null,
  }));

  return Response.json({
    status: "ok",
    testedEtf: etf,
    yahooSymbol,
    meta,
    candlesCount: candles.length,
    lastCandle: candles[candles.length - 1],
    candles,
  });
}