export default function Home() {
  const etfs = [
    {
      isin: "IE00BF0M2Z96",
      ticker: "BATE.DE",
      name: "L&G Battery Value-Chain UCITS ETF",
      status: "Analyse en attente",
    },
    {
      isin: "IE0007Y8Y157",
      ticker: "NUCL.PA",
      name: "VanEck Uranium and Nuclear Technologies UCITS ETF",
      status: "Analyse en attente",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white p-10">
      <h1 className="text-4xl font-bold mb-2">ETF Dashboard</h1>
      <p className="text-slate-400 mb-8">
        Suivi quotidien des ETF avec RSI, stochastique, volumes et chandeliers japonais.
      </p>

      <div className="grid gap-4">
        {etfs.map((etf) => (
          <div
            key={etf.isin}
            className="rounded-xl border border-slate-700 bg-slate-900 p-6"
          >
            <h2 className="text-2xl font-semibold">{etf.ticker}</h2>
            <p className="text-slate-300">{etf.name}</p>
            <p className="text-slate-500 mt-1">ISIN : {etf.isin}</p>

            <div className="mt-4 rounded-lg bg-slate-800 p-4">
              <p className="text-yellow-400">{etf.status}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
