import { supabase } from "@/lib/supabase";

export async function GET() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "TWELVE_DATA_API_KEY is missing" },
      { status: 500 }
    );
  }

  const { data: etfs, error } = await supabase
    .from("etfs")
    .select("id, ticker, name, exchange, currency, region, topic")
    .limit(1);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!etfs || etfs.length === 0) {
    return Response.json({ error: "No ETF found" }, { status: 404 });
  }

  const etf = etfs[0];

  const quoteUrl = new URL("https://api.twelvedata.com/quote");
  quoteUrl.searchParams.set("symbol", etf.ticker);
  quoteUrl.searchParams.set("apikey", apiKey);

  const quoteResponse = await fetch(quoteUrl.toString());
  const quote = await quoteResponse.json();

  return Response.json({
    status: "ok",
    testedEtf: etf,
    twelveDataQuote: quote,
  });
}