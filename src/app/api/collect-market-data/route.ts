export async function GET() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "TWELVE_DATA_API_KEY is missing" },
      { status: 500 }
    );
  }

  const quoteUrl = new URL("https://api.twelvedata.com/quote");

  quoteUrl.searchParams.set("symbol", "NUCL");
  quoteUrl.searchParams.set("exchange", "EURONEXT");
  quoteUrl.searchParams.set("apikey", apiKey);

  const response = await fetch(quoteUrl.toString());
  const data = await response.json();

  return Response.json({
    testedSymbol: "NUCL",
    testedExchange: "EURONEXT",
    twelveDataResponse: data,
  });
}