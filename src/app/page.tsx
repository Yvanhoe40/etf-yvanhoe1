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
  const [etfs, setEtfs] = useState<Etf[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adminCode, setAdminCode] = useState("");

  const canEdit = adminCode === "topaz";

  const [isin, setIsin] = useState("");
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [exchange, setExchange] = useState("EURONEXT");
  const [currency, setCurrency] = useState("EUR");
  const [region, setRegion] = useState("World");
  const [topic, setTopic] = useState("");

  async function loadEtfs() {
    const { data } = await supabase.from("etfs").select("*");

    const sorted = (data || []).sort((a, b) => {
      const regionDiff = regions.indexOf(a.region) - regions.indexOf(b.region);

      if (regionDiff !== 0) return regionDiff;

      return a.ticker.localeCompare(b.ticker);
    });

    setEtfs(sorted);
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
    if (!canEdit) {
      alert("Mode lecture seule : entre le code administrateur.");
      return;
    }

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

    if (editingId) {
      const { error } = await supabase
        .from("etfs")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        alert(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("etfs").insert(payload);

      if (error) {
        alert(error.message);
        return;
      }
    }

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
    if (!canEdit) {
      alert("Mode lecture seule : entre le code administrateur.");
      return;
    }

    if (!confirm("Confirmer la suppression de cet ETF ?")) return;

    const { error } = await supabase.from("etfs").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadEtfs();
  }

  useEffect(() => {
    loadEtfs();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-10">
      <h1 className="text-4xl font-bold mb-2">ETF Dashboard</h1>
      <p className="text-slate-400 mb-8">Gestion de ta liste d’ETF</p>

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
      </div>

      {canEdit && (
        <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-2xl font-semibold mb-4">
            {editingId ? "Modifier un ETF" : "Ajouter un ETF"}
          </h2>

          <div className="grid gap-3 md:grid-cols-4">
            <input
              className="rounded bg-slate-800 p-3"
              placeholder="ISIN"
              value={isin}
              onChange={(e) => setIsin(e.target.value)}
            />

            <input
              className="rounded bg-slate-800 p-3"
              placeholder="Ticker ex: NUCL.PA"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
            />

            <input
              className="rounded bg-slate-800 p-3"
              placeholder="Nom de l’ETF"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <select
              className="rounded bg-slate-800 p-3"
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
            >
              {exchanges.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>

            <select
              className="rounded bg-slate-800 p-3"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              className="rounded bg-slate-800 p-3"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <input
              className="rounded bg-slate-800 p-3"
              placeholder="Topic ex: Uranium, Battery, AI"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={saveEtf}
              className="rounded bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
            >
              {editingId ? "Sauvegarder" : "Ajouter ETF"}
            </button>

            {editingId && (
              <button
                onClick={resetForm}
                className="rounded bg-slate-700 px-5 py-3 font-semibold hover:bg-slate-600"
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {etfs.map((etf) => (
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
                <p className="text-slate-500">
                  Currency : {etf.currency || "EUR"}
                </p>
                <p className="text-slate-500">Region : {etf.region}</p>
                <p className="text-slate-500">Topic : {etf.topic || "-"}</p>
              </div>

              {canEdit && (
                <div className="flex gap-2">
                  <button
                    onClick={() => editEtf(etf)}
                    className="rounded bg-amber-600 px-4 py-2 font-semibold hover:bg-amber-500"
                  >
                    Modifier
                  </button>

                  <button
                    onClick={() => deleteEtf(etf.id)}
                    className="rounded bg-red-700 px-4 py-2 font-semibold hover:bg-red-600"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-lg bg-slate-800 p-4">
              <p className="text-yellow-400">Analyse en attente</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}