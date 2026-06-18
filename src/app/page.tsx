"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Etf = {
  id: string;
  isin: string;
  ticker: string;
  name: string;
  exchange: string | null;
  currency: string | null;
  region: string;
  topic: string | null;
};

type Snapshot = {
  etf_id: string;
  snapshot_at: string;
  price: number | null;
  open_price: number | null;
  high_price: number | null;
  low_price: number | null;
  previous_close: number | null;
  day_change: number | null;
  day_change_percent: number | null;
  volume: number | null;
  raw_quote: {
    meta?: {
      fiftyTwoWeekHigh?: number;
      fiftyTwoWeekLow?: number;
    };
  } | null;
};

type PositionSummary = {
  etf_id: string;
  buy_price: number | null;
  quantity: number | null;
  buy_fees: number | null;
  sell_fees: number | null;
  link_1: string | null;
  link_2: string | null;
  is_currently_held: boolean | null;
  invested_amount: number | null;
  current_value: number | null;
  unrealized_gain: number | null;
  unrealized_gain_percent: number | null;
};

type EtfWithSnapshot = Etf & {
  snapshot?: Snapshot | null;
  position?: PositionSummary | null;
};

type PositionForm = {
  buy_price: string;
  quantity: string;
  buy_fees: string;
  sell_fees: string;
  link_1: string;
  link_2: string;
  is_currently_held: boolean;
};

const regions = ["World", "US", "Europe", "EM", "Commodities", "Sectors"];
const exchanges = ["EURONEXT", "XETRA", "MILAN"];
const currencies = ["EUR", "USD", "GBP", "CHF"];

const regionStyle: Record<string, string> = {
  World: "border-l-blue-500",
  US: "border-l-green-500",
  Europe: "border-l-cyan-500",
  EM: "border-l-orange-500",
  Commodities: "border-l-yellow-500",
  Sectors: "border-l-purple-500",
};

export default function Home() {
  const [etfs, setEtfs] = useState<EtfWithSnapshot[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adminCode, setAdminCode] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [positionForms, setPositionForms] = useState<Record<string, PositionForm>>({});

  const canEdit = adminCode === "topaz";

  const [isin, setIsin] = useState("");
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [exchange, setExchange] = useState("EURONEXT");
  const [currency, setCurrency] = useState("EUR");
  const [region, setRegion] = useState("World");
  const [topic, setTopic] = useState("");

  function formatNumber(value: number | null | undefined, digits = 2) {
    if (value === null || value === undefined) return "-";
    return value.toLocaleString("fr-BE", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return "-";
    return new Date(value).toLocaleString("fr-BE");
  }

  function distanceToHigh(price?: number | null, high?: number | null) {
    if (!price || !high) return null;
    return ((price - high) / high) * 100;
  }

  function distanceToLow(price?: number | null, low?: number | null) {
    if (!price || !low) return null;
    return ((price - low) / low) * 100;
  }

  function position52Weeks(
    price?: number | null,
    high?: number | null,
    low?: number | null
  ) {
    if (!price || !high || !low || high <= low) return null;
    return ((price - low) / (high - low)) * 100;
  }

  function toNumber(value: string) {
    if (!value) return null;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function loadEtfs() {
    const { data: etfData } = await supabase.from("etfs").select("*");

    const { data: snapshotData } = await supabase
      .from("latest_etf_market_snapshots")
      .select("*");

    const { data: positionData } = await supabase
      .from("etf_position_summary")
      .select("*");

    const snapshotsByEtfId = new Map(
      (snapshotData || []).map((snapshot) => [snapshot.etf_id, snapshot])
    );

    const positionsByEtfId = new Map(
      (positionData || []).map((position) => [position.etf_id, position])
    );

    const merged = (etfData || []).map((etf) => ({
      ...etf,
      snapshot: snapshotsByEtfId.get(etf.id) || null,
      position: positionsByEtfId.get(etf.id) || null,
    }));

    const sorted = merged.sort((a, b) => {
      const regionDiff = regions.indexOf(a.region) - regions.indexOf(b.region);
      if (regionDiff !== 0) return regionDiff;
      return a.ticker.localeCompare(b.ticker);
    });

    const forms: Record<string, PositionForm> = {};

    sorted.forEach((etf) => {
      const position = etf.position;

      forms[etf.id] = {
        buy_price: position?.buy_price?.toString() || "",
        quantity: position?.quantity?.toString() || "",
        buy_fees: position?.buy_fees?.toString() || "",
        sell_fees: position?.sell_fees?.toString() || "",
        link_1: position?.link_1 || "",
        link_2: position?.link_2 || "",
        is_currently_held: position?.is_currently_held || false,
      };
    });

    setEtfs(sorted);
    setPositionForms(forms);
  }

  async function refreshMarketData() {
    if (!canEdit) return;

    setIsRefreshing(true);

    try {
      const response = await fetch("/api/collect-market-data");
      const result = await response.json();

      if (result.status !== "completed") {
        console.log(result);
        alert("Erreur pendant la collecte des données.");
        return;
      }

      alert(
        `Collecte terminée : ${result.successful}/${result.totalEtfs} ETF mis à jour`
      );

      await loadEtfs();
    } catch (error) {
      console.error(error);
      alert("Erreur technique pendant le rafraîchissement.");
    } finally {
      setIsRefreshing(false);
    }
  }

  function updatePositionForm(
    etfId: string,
    field: keyof PositionForm,
    value: string | boolean
  ) {
    setPositionForms((current) => ({
      ...current,
      [etfId]: {
        ...current[etfId],
        [field]: value,
      },
    }));
  }

  async function savePosition(etfId: string) {
    if (!canEdit) return alert("Mode lecture seule.");

    const form = positionForms[etfId];

    if (!form) return;

    const { error } = await supabase.from("etf_positions").upsert(
      {
        etf_id: etfId,
        buy_price: toNumber(form.buy_price),
        quantity: toNumber(form.quantity),
        buy_fees: toNumber(form.buy_fees) || 0,
        sell_fees: toNumber(form.sell_fees) || 0,
        link_1: form.link_1 || null,
        link_2: form.link_2 || null,
        is_currently_held: form.is_currently_held,
      },
      {
        onConflict: "etf_id",
      }
    );

    if (error) return alert(error.message);

    alert("Position sauvegardée.");
    await loadEtfs();
  }

  function resetForm() {
    setEditingId(null);
    setIsin("");
    setTicker("");
    setName("");
    setExchange("EURONEXT");
    setCurrency("EUR");
    setRegion("World");
    setTopic("");
  }

  async function saveEtf() {
    if (!canEdit) return alert("Mode lecture seule.");
    if (!isin || !ticker || !name) return;

    const payload = {
      isin,
      ticker,
      name,
      exchange,
      currency,
      region,
      topic,
      is_active: true,
    };

    const { error } = editingId
      ? await supabase.from("etfs").update(payload).eq("id", editingId)
      : await supabase.from("etfs").insert(payload);

    if (error) return alert(error.message);

    resetForm();
    loadEtfs();
  }

  function editEtf(etf: Etf) {
    if (!canEdit) return;

    setEditingId(etf.id);
    setIsin(etf.isin);
    setTicker(etf.ticker);
    setName(etf.name);
    setExchange(etf.exchange || "EURONEXT");
    setCurrency(etf.currency || "EUR");
    setRegion(etf.region || "World");
    setTopic(etf.topic || "");
  }

  async function deleteEtf(id: string) {
    if (!canEdit) return alert("Mode lecture seule.");
    if (!confirm("Confirmer la suppression de cet ETF ?")) return;

    const { error } = await supabase.from("etfs").delete().eq("id", id);
    if (error) return alert(error.message);

    loadEtfs();
  }

  useEffect(() => {
    loadEtfs();
  }, []);
  return (
    <main className="min-h-screen bg-slate-950 text-white p-10">
      <h1 className="text-4xl font-bold mb-2">ETF Dashboard</h1>
      <p className="text-slate-400 mb-8">
        Gestion de ta liste d’ETF, données Yahoo Finance et positions personnelles.
      </p>

      <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <label className="block text-sm text-slate-400 mb-2">
          Code administrateur
        </label>
        <input
          type="password"
          className="rounded bg-slate-800 p-3 w-full"
          placeholder="Entrer le code"
          value={adminCode}
          onChange={(e) => setAdminCode(e.target.value)}
        />

        <p className="mt-2 text-sm text-slate-500">
          {canEdit
            ? "Mode édition activé"
            : "Mode lecture seule : ajout, modification et suppression désactivés"}
        </p>

        {canEdit && (
          <button
            onClick={refreshMarketData}
            disabled={isRefreshing}
            className="mt-4 rounded bg-emerald-600 px-5 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-50"
          >
            {isRefreshing
              ? "Rafraîchissement en cours..."
              : "Rafraîchir les données Yahoo Finance"}
          </button>
        )}
      </div>

      {canEdit && (
        <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-2xl font-semibold mb-4">
            {editingId ? "Modifier un ETF" : "Ajouter un ETF"}
          </h2>

          <div className="grid gap-3 md:grid-cols-4">
            <input className="rounded bg-slate-800 p-3" placeholder="ISIN" value={isin} onChange={(e) => setIsin(e.target.value)} />
            <input className="rounded bg-slate-800 p-3" placeholder="Ticker ex: NUCL.PA" value={ticker} onChange={(e) => setTicker(e.target.value)} />
            <input className="rounded bg-slate-800 p-3" placeholder="Nom de l’ETF" value={name} onChange={(e) => setName(e.target.value)} />

            <select className="rounded bg-slate-800 p-3" value={exchange} onChange={(e) => setExchange(e.target.value)}>
              {exchanges.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>

            <select className="rounded bg-slate-800 p-3" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select className="rounded bg-slate-800 p-3" value={region} onChange={(e) => setRegion(e.target.value)}>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <input className="rounded bg-slate-800 p-3" placeholder="Topic ex: Uranium, Battery, AI" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>

          <div className="mt-4 flex gap-3">
            <button onClick={saveEtf} className="rounded bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500">
              {editingId ? "Sauvegarder" : "Ajouter ETF"}
            </button>

            {editingId && (
              <button onClick={resetForm} className="rounded bg-slate-700 px-5 py-3 font-semibold hover:bg-slate-600">
                Annuler
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {etfs.map((etf) => {
          const snapshot = etf.snapshot;
          const position = etf.position;
          const positionForm = positionForms[etf.id];

          const isPositive = (snapshot?.day_change_percent || 0) >= 0;
          const isGainPositive = (position?.unrealized_gain_percent || 0) >= 0;

          const high52 = snapshot?.raw_quote?.meta?.fiftyTwoWeekHigh ?? null;
          const low52 = snapshot?.raw_quote?.meta?.fiftyTwoWeekLow ?? null;
          const distanceHigh = distanceToHigh(snapshot?.price, high52);
          const distanceLow = distanceToLow(snapshot?.price, low52);
          const position52w = position52Weeks(snapshot?.price, high52, low52);

          return (
            <div
              key={etf.id}
              className={`rounded-xl border border-slate-700 border-l-8 ${
                regionStyle[etf.region] || "border-l-slate-500"
              } bg-slate-900 p-6`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">{etf.ticker}</h2>
                  <p className="text-slate-300">{etf.name}</p>
                  <p className="text-slate-500 mt-1">ISIN : {etf.isin}</p>
                  <p className="text-slate-500">Exchange : {etf.exchange}</p>
                  <p className="text-slate-500">Currency : {etf.currency || "EUR"}</p>
                  <p className="text-slate-500">Region : {etf.region}</p>
                  <p className="text-slate-500">Topic : {etf.topic || "-"}</p>
                </div>

                {canEdit && (
                  <div className="flex gap-2">
                    <button onClick={() => editEtf(etf)} className="rounded bg-amber-600 px-4 py-2 font-semibold hover:bg-amber-500">
                      Modifier
                    </button>
                    <button onClick={() => deleteEtf(etf.id)} className="rounded bg-red-700 px-4 py-2 font-semibold hover:bg-red-600">
                      Supprimer
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-5 rounded-lg bg-slate-800 p-4">
                <div>
                  <p className="text-xs text-slate-400">Prix actuel</p>
                  <p className="text-lg font-semibold">
                    {formatNumber(snapshot?.price)} {etf.currency || "EUR"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Variation jour</p>
                  <p className={`text-lg font-semibold ${isPositive ? "text-green-400" : "text-red-400"}`}>
                    {formatNumber(snapshot?.day_change)} {etf.currency || "EUR"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Variation %</p>
                  <p className={`text-lg font-semibold ${isPositive ? "text-green-400" : "text-red-400"}`}>
                    {formatNumber(snapshot?.day_change_percent)} %
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Volume</p>
                  <p className="text-lg font-semibold">
                    {formatNumber(snapshot?.volume, 0)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Dernière collecte</p>
                  <p className="text-sm font-semibold">
                    {formatDate(snapshot?.snapshot_at)}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-10 rounded-lg bg-slate-800 p-4">
                <div>
                  <p className="text-xs text-slate-400">Open</p>
                  <p className="font-semibold">{formatNumber(snapshot?.open_price)}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">High</p>
                  <p className="font-semibold">{formatNumber(snapshot?.high_price)}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Low</p>
                  <p className="font-semibold">{formatNumber(snapshot?.low_price)}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Close J-1</p>
                  <p className="font-semibold">{formatNumber(snapshot?.previous_close)}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">52W High</p>
                  <p className="font-semibold">{formatNumber(high52)}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">52W Low</p>
                  <p className="font-semibold">{formatNumber(low52)}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Écart 52W High</p>
                  <p className="font-semibold">{formatNumber(distanceHigh)} %</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Écart 52W Low</p>
                  <p className="font-semibold text-emerald-400">{formatNumber(distanceLow)} %</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Position 52W</p>
                  <p className="font-semibold">{formatNumber(position52w)} %</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Source</p>
                  <p className="font-semibold">Yahoo</p>
                </div>
              </div>

              <div className="mt-3 rounded-lg bg-slate-800 p-4">
                <h3 className="mb-3 text-lg font-semibold">Position personnelle</h3>

                <div className="grid gap-3 md:grid-cols-6">
                  <div>
                    <p className="text-xs text-slate-400">Quantité</p>
                    <p className="font-semibold">{formatNumber(position?.quantity, 4)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Prix achat</p>
                    <p className="font-semibold">{formatNumber(position?.buy_price)} {etf.currency || "EUR"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Montant investi</p>
                    <p className="font-semibold">{formatNumber(position?.invested_amount)} {etf.currency || "EUR"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Valeur actuelle</p>
                    <p className="font-semibold">{formatNumber(position?.current_value)} {etf.currency || "EUR"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Gain latent</p>
                    <p className={`font-semibold ${isGainPositive ? "text-green-400" : "text-red-400"}`}>
                      {formatNumber(position?.unrealized_gain)} {etf.currency || "EUR"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Gain %</p>
                    <p className={`font-semibold ${isGainPositive ? "text-green-400" : "text-red-400"}`}>
                      {formatNumber(position?.unrealized_gain_percent)} %
                    </p>
                  </div>
                </div>

                {canEdit && positionForm && (
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <input
                      className="rounded bg-slate-900 p-3"
                      placeholder="Quantité"
                      value={positionForm.quantity}
                      onChange={(e) => updatePositionForm(etf.id, "quantity", e.target.value)}
                    />

                    <input
                      className="rounded bg-slate-900 p-3"
                      placeholder="Prix achat"
                      value={positionForm.buy_price}
                      onChange={(e) => updatePositionForm(etf.id, "buy_price", e.target.value)}
                    />

                    <input
                      className="rounded bg-slate-900 p-3"
                      placeholder="Frais achat"
                      value={positionForm.buy_fees}
                      onChange={(e) => updatePositionForm(etf.id, "buy_fees", e.target.value)}
                    />

                    <input
                      className="rounded bg-slate-900 p-3"
                      placeholder="Frais vente"
                      value={positionForm.sell_fees}
                      onChange={(e) => updatePositionForm(etf.id, "sell_fees", e.target.value)}
                    />

                    <input
                      className="rounded bg-slate-900 p-3"
                      placeholder="Lien 1"
                      value={positionForm.link_1}
                      onChange={(e) => updatePositionForm(etf.id, "link_1", e.target.value)}
                    />

                    <input
                      className="rounded bg-slate-900 p-3"
                      placeholder="Lien 2"
                      value={positionForm.link_2}
                      onChange={(e) => updatePositionForm(etf.id, "link_2", e.target.value)}
                    />

                    <label className="flex items-center gap-2 rounded bg-slate-900 p-3">
                      <input
                        type="checkbox"
                        checked={positionForm.is_currently_held}
                        onChange={(e) =>
                          updatePositionForm(etf.id, "is_currently_held", e.target.checked)
                        }
                      />
                      ETF détenu actuellement
                    </label>

                    <button
                      onClick={() => savePosition(etf.id)}
                      className="rounded bg-indigo-600 px-5 py-3 font-semibold hover:bg-indigo-500"
                    >
                      Sauvegarder position
                    </button>
                  </div>
                )}

                {(position?.link_1 || position?.link_2) && (
                  <div className="mt-3 flex gap-4 text-sm">
                    {position.link_1 && (
                      <a href={position.link_1} target="_blank" className="text-blue-400 underline">
                        Lien 1
                      </a>
                    )}
                    {position.link_2 && (
                      <a href={position.link_2} target="_blank" className="text-blue-400 underline">
                        Lien 2
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}