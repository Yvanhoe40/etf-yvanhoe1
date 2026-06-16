export async function GET() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "TWELVE_DATA_API_KEY is missing" },
      { status: 500 }
    );
  }

  const symbol = "NUCL";
  const exchange = "EURONEXT";

  const searchUrl = new URL("https://api.twelvedata.com/symbol_search");
  searchUrl.searchParams.set("symbol", symbol);
  searchUrl.searchParams.set("apikey", apiKey);

  const quoteUrl = new URL("https://api.twelvedata.com/quote");
  quoteUrl.searchParams.set("symbol", symbol);
  quoteUrl.searchParams.set("exchange", exchange);
  quoteUrl.searchParams.set("apikey", apiKey);

  const timeSeriesUrl = new URL("https://api.twelvedata.com/time_series");
  timeSeriesUrl.searchParams.set("symbol", symbol);
  timeSeriesUrl.searchParams.set("exchange", exchange);
  timeSeriesUrl.searchParams.set("interval", "1day");
  timeSeriesUrl.searchParams.set("outputsize", "5");
  timeSeriesUrl.searchParams.set("apikey", apiKey);

  const [searchResponse, quoteResponse, timeSeriesResponse] =
    await Promise.all([
      fetch(searchUrl.toString()),
      fetch(quoteUrl.toString()),
      fetch(timeSeriesUrl.toString()),
    ]);

  const [searchData, quoteData, timeSeriesData] = await Promise.all([
    searchResponse.json(),
    quoteResponse.json(),
    timeSeriesResponse.json(),
  ]);

  return Response.json({
    testedSymbol: symbol,
    testedExchange: exchange,
    symbolSearch: searchData,
    quote: quoteData,
    timeSeries: timeSeriesData,
  });
}