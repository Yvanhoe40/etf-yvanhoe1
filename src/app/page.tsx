"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

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

type Portfolio = {
  id: string;
  portfolio_name: string;
  access_code: string;
};

type PortfolioPosition = {
  portfolio_id: string;
  etf_id: string;
  quantity_held: number | null;
  average_price: number | null;
  net_invested_amount: number | null;
  current_price: number | null;
  current_value: number | null;
  unrealized_gain: number | null;
};

type PortfolioSummary = {
  portfolio_id: string;
  invested_amount: number | null;
  current_value: number | null;
  unrealized_gain: number | null;
  performance_percent: number | null;
  positions_count?: number | null;
  day_change_amount: number | null;
  day_change_percent: number | null;
};

type PortfolioRealizedSummary = {
  portfolio_id: string;

  etfs_with_sales: number | null;
  sell_transactions: number | null;

  realized_gain: number | null;
  realized_profit: number | null;
  realized_loss: number | null;

  winning_trades: number | null;
  losing_trades: number | null;
  win_rate: number | null;

  best_trade_ticker: string | null;
  best_trade_gain: number | null;

  worst_trade_ticker: string | null;
  worst_trade_gain: number | null;
};

type Transaction = {
  id: string;
  portfolio_id: string;
  etf_id: string;
  transaction_type: "BUY" | "SELL";
  transaction_date: string;
  quantity: number;
  price: number;
  fees: number | null;
  broker: string | null;
  note: string | null;
};

type Recommendation = {
  etf_id: string;
  portfolio_id: string;
  recommendation_level: string;
  recommendation_name: string;
  recommendation_confidence: number | null;
  thesis_code: string | null;
  thesis_confidence: number | null;
  is_held: boolean | null;
  latent_gain_percent: number | null;
  explanation: string | null;
};

type RecommendationFactor = {
  recommendation_id: string;
  etf_id: string;
  portfolio_id: string;
  trading_date: string;
  factor_category: string;
  factor_label: string;
  factor_explanation: string;
  importance_score: number;
  factor_sentiment: "favorable" | "vigilance" | "vendeur";
};

type EtfWithSnapshot = Etf & {
  snapshot?: Snapshot | null;
  portfolioPosition?: PortfolioPosition | null;
  transactions?: Transaction[];
  recommendation?: Recommendation | null;
  recommendationFactors?: RecommendationFactor[];
};

type TransactionForm = {
  transaction_type: "BUY" | "SELL";
  transaction_date: string;
  quantity: string;
  price: string;
  fees: string;
  broker: string;
  note: string;
};

type PortfolioTargetAllocation = {
  id: string;
  portfolio_id: string;
  category_type: string;
  category_name: string;
  target_percent: number;
};

const regions = ["World", "US", "Europe", "EM", "Commodities", "Sectors"];
const exchanges = ["EURONEXT", "XETRA", "MILAN"];
const currencies = ["EUR", "USD", "GBP", "CHF"];
const brokers = ["MeDirect", "Keytrade", "Degiro", "Bolero"];

const regionStyle: Record<string, string> = {
  World: "border-l-blue-500",
  US: "border-l-green-500",
  Europe: "border-l-cyan-500",
  EM: "border-l-orange-500",
  Commodities: "border-l-yellow-500",
  Sectors: "border-l-purple-500",
};
const chartColors = [
  "#22c55e",
  "#06b6d4",
  "#a855f7",
  "#f97316",
  "#eab308",
  "#ef4444",
  "#3b82f6",
  "#14b8a6",
];

const defaultTargetRegionalAllocation = {
  World: 4,
  US: 31,
  Europe: 5,
  EM: 25,
  Commodities: 10,
  Sectors: 25,
};


export default function Home() {
  const [etfs, setEtfs] = useState<EtfWithSnapshot[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  const [adminCode, setAdminCode] = useState("");
  const [portfolioCode, setPortfolioCode] = useState("");
  const [activePortfolio, setActivePortfolio] = useState<Portfolio | null>(null);
  const [portfolioSummary, setPortfolioSummary] =
  useState<PortfolioSummary | null>(null);
  const [portfolioRealizedSummary, setPortfolioRealizedSummary] =
  useState<PortfolioRealizedSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [transactionForms, setTransactionForms] = useState<
    Record<string, TransactionForm>
  >({});

  const canEditEtfs = adminCode === "topaz";
  const canEditPortfolio = !!activePortfolio;

  const [isin, setIsin] = useState("");
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [exchange, setExchange] = useState("EURONEXT");
  const [currency, setCurrency] = useState("EUR");
  const [region, setRegion] = useState("World");
  const [topic, setTopic] = useState("");
  const [targetRegionalAllocation, setTargetRegionalAllocation] = useState(
  defaultTargetRegionalAllocation
);
  const [targetAllocations, setTargetAllocations] = useState<
    PortfolioTargetAllocation[]
  >([]);

  const targetAllocationTotal =
  Object.values(targetRegionalAllocation).reduce(
    (sum, value) => sum + value,
    0
  );


  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function emptyTransactionForm(): TransactionForm {
    return {
      transaction_type: "BUY",
      transaction_date: today(),
      quantity: "",
      price: "",
      fees: "",
      broker: "MeDirect",
      note: "",
    };
  }

  function formatNumber(value: number | null | undefined, digits = 2) {
    if (value === null || value === undefined) return "-";
    return value.toLocaleString("fr-BE", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("fr-BE");
  }

  function formatDateTime(value: string | null | undefined) {
    if (!value) return "-";
    return new Date(value).toLocaleString("fr-BE");
  }

  function buildAllocation(
    positions: EtfWithSnapshot[],
    groupBy: "region" | "topic",
    totalValue: number
  ) {
    const allocation = new Map<string, number>();

    positions.forEach((etf) => {
      const key = groupBy === "region" ? etf.region || "Non classé" : etf.topic || "Non classé";
      const value = etf.portfolioPosition?.current_value || 0;

      allocation.set(key, (allocation.get(key) || 0) + value);
    });

    return Array.from(allocation.entries())
      .map(([label, value]) => ({
        label,
        value,
        weight: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }

  function toNumber(value: string) {
    if (!value) return null;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
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

async function loadPortfolioSummary(portfolioId: string | null) {
  if (!portfolioId) {
    setPortfolioSummary(null);
    return;
  }

  const { data } = await supabase
    .from("portfolio_summary")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .maybeSingle();

  setPortfolioSummary(data || null);
}

  async function loadTargetAllocations(portfolioId: string) {
    const { data, error } = await supabase
      .from("portfolio_target_allocations")
      .select("*")
      .eq("portfolio_id", portfolioId)
      .eq("category_type", "region");

    if (error) {
      console.error(error);
      return;
    }

    setTargetAllocations(data || []);

    if (data && data.length > 0) {
      const loadedTargets = { ...defaultTargetRegionalAllocation };

      data.forEach((row) => {
        loadedTargets[row.category_name as keyof typeof loadedTargets] =
          Number(row.target_percent);
      });

      setTargetRegionalAllocation(loadedTargets);
    } else {
      setTargetRegionalAllocation(defaultTargetRegionalAllocation);
    }

  }

  async function saveTargetAllocations() {
    if (!activePortfolio) return;

    const rows = Object.entries(targetRegionalAllocation).map(
      ([category_name, target_percent]) => ({
        portfolio_id: activePortfolio.id,
        category_type: "region",
        category_name,
        target_percent,
      })
    );

    const { error } = await supabase
      .from("portfolio_target_allocations")
      .upsert(rows, {
        onConflict: "portfolio_id,category_type,category_name",
      });

    if (error) {
      console.error(error);
      alert("Erreur lors de la sauvegarde");
      return;
    }

    alert("Allocations cibles sauvegardées");
  }

async function loadPortfolioRealizedSummary(
  portfolioId: string | null
) {
  if (!portfolioId) {
    setPortfolioRealizedSummary(null);
    return;
  }

  const { data } = await supabase
    .from("portfolio_realized_summary")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .maybeSingle();

  setPortfolioRealizedSummary(data || null);
}
  async function loadEtfs(portfolioId?: string | null) {
    const { data: etfData } = await supabase.from("etfs").select("*");

    const { data: snapshotData } = await supabase
      .from("latest_etf_market_snapshots")
      .select("*");

    let positionData: PortfolioPosition[] = [];
    let transactionData: Transaction[] = [];
    let recommendationData: any[] = [];
    let recommendationFactorData: RecommendationFactor[] = [];
    let latestAnalysisData: any[] = [];

    if (portfolioId) {
      const { data: positions } = await supabase
        .from("etf_portfolio_positions")
        .select("*")
        .eq("portfolio_id", portfolioId);

      const { data: transactions } = await supabase
        .from("etf_transactions")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      const { data: recommendations } = await supabase
        .from("recommendations")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("trading_date", { ascending: false });

      const { data: recommendationFactors } = await supabase
        .from("recommendation_decision_factor_items")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("importance_score", { ascending: false });

      const { data: latestAnalysis } = await supabase
        .from("latest_etf_analysis")
        .select("*");

      positionData = positions || [];
      transactionData = transactions || [];
      recommendationData = recommendations || [];
      recommendationFactorData = recommendationFactors || [];  
      latestAnalysisData = latestAnalysis || [];
    }

    const snapshotsByEtfId = new Map(
      (snapshotData || []).map((snapshot) => [snapshot.etf_id, snapshot])
    );

    const positionsByEtfId = new Map(
      positionData.map((position) => [position.etf_id, position])
    );

    const transactionsByEtfId = new Map<string, Transaction[]>();
      transactionData.forEach((transaction) => {
      const existing = transactionsByEtfId.get(transaction.etf_id) || [];
      transactionsByEtfId.set(transaction.etf_id, [...existing, transaction]);
    });

    const recommendationsByEtfId = new Map<string, any>();
      recommendationData.forEach((recommendation) => {
        recommendationsByEtfId.set(recommendation.etf_id, recommendation);
});
    const recommendationFactorsByEtfId = new Map<
        string,
        RecommendationFactor[]
      >();

      recommendationFactorData.forEach((factor) => {
        const existing =
          recommendationFactorsByEtfId.get(factor.etf_id) || [];

        recommendationFactorsByEtfId.set(
          factor.etf_id,
          [...existing, factor]
        );
      });

    const latestAnalysisByEtfId = new Map(
      latestAnalysisData.map((analysis) => [analysis.etf_id, analysis])
    );

    const merged = (etfData || []).map((etf) => ({
      ...etf,
      snapshot: snapshotsByEtfId.get(etf.id) || null,
      portfolioPosition: positionsByEtfId.get(etf.id) || null,
      transactions: transactionsByEtfId.get(etf.id) || [],
      recommendation: recommendationsByEtfId.get(etf.id) || null,
      recommendationFactors:
        recommendationFactorsByEtfId.get(etf.id) || [],
      latestAnalysis: latestAnalysisByEtfId.get(etf.id) || null,
    }));

    const sorted = merged.sort((a, b) => {
      const regionDiff = regions.indexOf(a.region) - regions.indexOf(b.region);
      if (regionDiff !== 0) return regionDiff;
      return a.ticker.localeCompare(b.ticker);
    });

    const forms: Record<string, TransactionForm> = {};
    sorted.forEach((etf) => {
      forms[etf.id] = emptyTransactionForm();
    });

    setEtfs(sorted);
    setTransactionForms(forms);
  }

  async function connectPortfolio() {
    if (!portfolioCode) return alert("Entre un code portefeuille.");

    const { data, error } = await supabase
      .from("etf_portfolios")
      .select("*")
      .eq("access_code", portfolioCode)
      .single();

    if (error || !data) {
      alert("Code portefeuille inconnu.");
      return;
    }

    setActivePortfolio(data);
    await loadEtfs(data.id);
    await loadPortfolioSummary(data.id);
    await loadPortfolioRealizedSummary(data.id);
    await loadTargetAllocations(data.id);
  }

  async function disconnectPortfolio() {
    setActivePortfolio(null);
    setPortfolioCode("");
    setEditingTransactionId(null);
    setPortfolioSummary(null);
    setPortfolioRealizedSummary(null);
    setTargetAllocations([]);
    await loadEtfs(null);
  }

  async function refreshMarketData() {
    if (!canEditEtfs) return;

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

      await loadEtfs(activePortfolio?.id || null);
    } catch (error) {
      console.error(error);
      alert("Erreur technique pendant le rafraîchissement.");
    } finally {
      setIsRefreshing(false);
    }
  }

  function updateTransactionForm(
    etfId: string,
    field: keyof TransactionForm,
    value: string
  ) {
    setTransactionForms((current) => ({
      ...current,
      [etfId]: {
        ...current[etfId],
        [field]: value,
      },
    }));
  }

  function editTransaction(transaction: Transaction) {
    setEditingTransactionId(transaction.id);

    setTransactionForms((current) => ({
      ...current,
      [transaction.etf_id]: {
        transaction_type: transaction.transaction_type,
        transaction_date: transaction.transaction_date,
        quantity: transaction.quantity?.toString() || "",
        price: transaction.price?.toString() || "",
        fees: transaction.fees?.toString() || "",
        broker: transaction.broker || "",
        note: transaction.note || "",
      },
    }));
  }

  function cancelEditTransaction(etfId: string) {
    setEditingTransactionId(null);

    setTransactionForms((current) => ({
      ...current,
      [etfId]: emptyTransactionForm(),
    }));
  }

  async function saveTransaction(etfId: string) {
    if (!activePortfolio) return alert("Connecte d'abord un portefeuille.");

    const form = transactionForms[etfId];
    if (!form) return;

    const quantity = toNumber(form.quantity);
    const price = toNumber(form.price);
    const fees = toNumber(form.fees) || 0;

    if (!quantity || !price) {
      alert("Quantité et prix sont obligatoires.");
      return;
    }

    const payload = {
      portfolio_id: activePortfolio.id,
      etf_id: etfId,
      transaction_type: form.transaction_type,
      transaction_date: form.transaction_date,
      quantity,
      price,
      fees,
      broker: form.broker || null,
      note: form.note || null,
    };

    const { error } = editingTransactionId
      ? await supabase
          .from("etf_transactions")
          .update(payload)
          .eq("id", editingTransactionId)
      : await supabase.from("etf_transactions").insert(payload);

    if (error) return alert(error.message);

    alert(editingTransactionId ? "Transaction modifiée." : "Transaction ajoutée.");

    setEditingTransactionId(null);

    setTransactionForms((current) => ({
      ...current,
      [etfId]: emptyTransactionForm(),
    }));

    await loadEtfs(activePortfolio.id);
    await loadPortfolioSummary(activePortfolio.id);
    await loadPortfolioRealizedSummary(activePortfolio.id);
  }

  async function deleteTransaction(transactionId: string) {
    if (!activePortfolio) return;
    if (!confirm("Supprimer cette transaction ?")) return;

    const { error } = await supabase
      .from("etf_transactions")
      .delete()
      .eq("id", transactionId);

    if (error) return alert(error.message);
    alert("Transaction supprimée.");
    await loadEtfs(activePortfolio.id);
    await loadPortfolioSummary(activePortfolio.id);
    await loadPortfolioRealizedSummary(activePortfolio.id);
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
    if (!canEditEtfs) return alert("Mode lecture seule.");
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
    await loadEtfs(activePortfolio?.id || null);
  }

  function editEtf(etf: Etf) {
    if (!canEditEtfs) return;

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
    if (!canEditEtfs) return alert("Mode lecture seule.");
    if (!confirm("Confirmer la suppression de cet ETF ?")) return;

    const { error } = await supabase.from("etfs").delete().eq("id", id);
    if (error) return alert(error.message);

    await loadEtfs(activePortfolio?.id || null);
  }

  useEffect(() => {
    loadEtfs(null);
  }, []);

    const openPositions = etfs.filter(
      (etf) => (etf.portfolioPosition?.quantity_held || 0) > 0
    );

    const sortedOpenPositions = [...openPositions].sort(
      (a, b) =>
        (b.portfolioPosition?.current_value || 0) -
        (a.portfolioPosition?.current_value || 0)
    );

    const portfolioTotalValue = portfolioSummary?.current_value || 0;

    const biggestPositionWeight =
      portfolioTotalValue > 0
        ? ((sortedOpenPositions[0]?.portfolioPosition?.current_value || 0) /
            portfolioTotalValue) *
          100
        : 0;

    const top3Weight =
      portfolioTotalValue > 0
        ? (sortedOpenPositions
            .slice(0, 3)
            .reduce(
              (sum, etf) => sum + (etf.portfolioPosition?.current_value || 0),
              0
            ) /
            portfolioTotalValue) *
          100
        : 0;

    const top5Weight =
      portfolioTotalValue > 0
        ? (sortedOpenPositions
            .slice(0, 5)
            .reduce(
              (sum, etf) => sum + (etf.portfolioPosition?.current_value || 0),
              0
            ) /
            portfolioTotalValue) *
          100
        : 0;

    const targetRegions = buildAllocation(
      openPositions,
      "region",
      portfolioTotalValue
    );

    const totalGap = targetRegions.reduce((sum, item) => {
      const target =
        targetRegionalAllocation[
          item.label as keyof typeof targetRegionalAllocation
        ] ?? 0;
      return sum + Math.abs(item.weight - target);
    }, 0);

    const balanceScore = Math.max(0, 100 - totalGap);
    
    const rebalancingPlan = Object.entries(targetRegionalAllocation)
    .map(([label, target]) => {
      const current = targetRegions.find(
        (item) => item.label === label
      );

      const currentWeight = current?.weight || 0;

      const gap = currentWeight - target;

      const amountToRebalance =
        ((target - currentWeight) / 100) *
        portfolioTotalValue;

      return {
        label,
        gap,
        amount: amountToRebalance,
      };
    })
    .filter((item) => Math.abs(item.amount) >= 1);

    const rebalancingBuys = rebalancingPlan.filter((item) => item.amount > 0);
    const rebalancingSells = rebalancingPlan.filter((item) => item.amount < 0);

    const totalRebalancingBuys = rebalancingBuys.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    const totalRebalancingSells = rebalancingSells.reduce(
      (sum, item) => sum + Math.abs(item.amount),
      0
    );

    const rebalancingCashNeed =
      totalRebalancingBuys - totalRebalancingSells;

    function getRecommendationStyle(level?: string) {
      switch (level) {
        case "buy":
          return {
            border: "border-green-500/40",
            gradient: "from-slate-800 to-green-950/30",
            text: "text-green-400",
          };

        case "hold":
          return {
            border: "border-blue-500/40",
            gradient: "from-slate-800 to-blue-950/30",
            text: "text-blue-400",
          };

        case "reduce":
          return {
            border: "border-orange-500/40",
            gradient: "from-slate-800 to-orange-950/30",
            text: "text-orange-400",
          };

        case "sell":
          return {
            border: "border-red-500/40",
            gradient: "from-slate-800 to-red-950/30",
            text: "text-red-400",
          };

        default:
          return {
            border: "border-slate-600",
            gradient: "from-slate-800 to-slate-900",
            text: "text-slate-300",
          };
      }
    }
    function getRecommendationLabel(level?: string) {
    switch (level) {
        case "buy":
        case "strong_buy":
            return "🟢 BUY";

        case "hold":
            return "🔵 HOLD";

        case "reduce":
            return "🟠 REDUCE";

        case "sell":
            return "🔴 SELL";

        case "wait":
            return "⚪ WAIT";

        case "watch":
            return "👀 WATCH";

        default:
            return "⚪ WAIT";
    }
}
    return (


    <main className="min-h-screen bg-slate-950 text-white p-10">
      <h1 className="text-4xl font-bold mb-2">ETF Dashboard</h1>
      <p className="text-slate-400 mb-8">
        Référentiel ETF, données Yahoo Finance et portefeuilles personnels.
      </p>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <label className="block text-sm text-slate-400 mb-2">
            Code administrateur ETF
          </label>
          <input
            type="password"
            className="rounded bg-slate-800 p-3 w-full"
            placeholder="Code admin"
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
          />
          <p className="mt-2 text-sm text-slate-500">
            {canEditEtfs
              ? "Mode admin activé"
              : "Mode lecture seule pour la liste ETF"}
          </p>

          {canEditEtfs && (
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

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <label className="block text-sm text-slate-400 mb-2">
            Code portefeuille
          </label>

          {!activePortfolio ? (
            <div className="flex gap-3">
              <input
                type="password"
                className="rounded bg-slate-800 p-3 w-full"
                placeholder="Ex: michel"
                value={portfolioCode}
                onChange={(e) => setPortfolioCode(e.target.value)}
              />
              <button
                onClick={connectPortfolio}
                className="rounded bg-indigo-600 px-5 py-3 font-semibold hover:bg-indigo-500"
              >
                Ouvrir
              </button>
            </div>
          ) : (
            <div>
              <p className="text-green-400 font-semibold">
                Portefeuille actif : {activePortfolio.portfolio_name}
              </p>
              <button
                onClick={disconnectPortfolio}
                className="mt-4 rounded bg-slate-700 px-5 py-3 font-semibold hover:bg-slate-600"
              >
                Fermer le portefeuille
              </button>
            </div>
          )}
        </div>
      </div>
                {activePortfolio && portfolioSummary && (
        <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">
                Dashboard investisseur : {activePortfolio.portfolio_name}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Vue consolidée des positions ouvertes calculées en FIFO.
              </p>
            </div>

            <div
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                (portfolioSummary.unrealized_gain || 0) >= 0
                  ? "bg-green-500/10 text-green-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {(portfolioSummary.unrealized_gain || 0) >= 0
                ? "Portefeuille en gain"
                : "Portefeuille en perte"}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-7">
            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Valeur totale</p>
              <p className="text-2xl font-bold">
                {formatNumber(portfolioSummary.current_value)} EUR
              </p>
            </div>
            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Variation jour</p>
              <p
                className={`text-2xl font-bold ${
                  (portfolioSummary.day_change_amount || 0) >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {formatNumber(portfolioSummary.day_change_amount)} EUR
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Variation jour %</p>
              <p
                className={`text-2xl font-bold ${
                  (portfolioSummary.day_change_percent || 0) >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {formatNumber(portfolioSummary.day_change_percent)} %
              </p>
            </div>
            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Capital investi</p>
              <p className="text-2xl font-bold">
                {formatNumber(portfolioSummary.invested_amount)} EUR
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Gain latent</p>
              <p
                className={`text-2xl font-bold ${
                  (portfolioSummary.unrealized_gain || 0) >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {formatNumber(portfolioSummary.unrealized_gain)} EUR
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Performance</p>
              <p
                className={`text-2xl font-bold ${
                  (portfolioSummary.performance_percent || 0) >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {formatNumber(portfolioSummary.performance_percent)} %
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">ETF détenus</p>
              <p className="text-2xl font-bold">
                {
                  etfs.filter(
                    (etf) => (etf.portfolioPosition?.quantity_held || 0) > 0
                  ).length
                }
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Concentration max</p>
              <p className="text-2xl font-bold">
                {formatNumber(biggestPositionWeight)} %
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Concentration Top 3</p>
              <p className="text-2xl font-bold">
                {formatNumber(top3Weight)} %
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Concentration Top 5</p>
              <p className="text-2xl font-bold">
                {formatNumber(top5Weight)} %
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-slate-800 p-4">
            <p className="text-xs text-slate-400">Portfolio Balance Score</p>
            <p
              className={`text-3xl font-bold ${
                balanceScore >= 80
                  ? "text-green-400"
                  : balanceScore >= 60
                  ? "text-amber-400"
                  : "text-red-400"
              }`}
            >
              {formatNumber(balanceScore, 0)} / 100
            </p>
          </div>

        </div>
      )}

            {activePortfolio && portfolioSummary && openPositions.length > 0 && (
              <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
                <h2 className="mb-4 text-2xl font-semibold">
                  Allocation du portefeuille
                </h2>

                <div className="grid gap-3">
                  {openPositions
                    .sort(
                      (a, b) =>
                        (b.portfolioPosition?.current_value || 0) -
                        (a.portfolioPosition?.current_value || 0)
                    )
                    .map((etf) => {
                      const value = etf.portfolioPosition?.current_value || 0;
                      const total = portfolioSummary.current_value || 0;
                      const weight = total > 0 ? (value / total) * 100 : 0;

                      return (
                        <div key={etf.id} className="rounded-lg bg-slate-800 p-4">
                          <div className="mb-2 flex items-center justify-between gap-4">
                            <div>
                              <p className="font-bold">{etf.ticker}</p>
                              <p className="text-sm text-slate-400">{etf.name}</p>
                            </div>

                            <div className="text-right">
                              <p className="font-bold">
                                {formatNumber(value)} {etf.currency || "EUR"}
                              </p>
                              <p className="text-sm text-slate-400">
                                {formatNumber(weight)} %
                              </p>
                            </div>
                          </div>

                          <div className="h-2 rounded-full bg-slate-700">
                            <div
                              className="h-2 rounded-full bg-emerald-400"
                              style={{ width: `${Math.min(weight, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
              <h2 className="mb-4 text-2xl font-semibold">
                Allocation par région
              </h2>

              <div className="flex h-80 min-h-[320px] w-full justify-center">
                <PieChart width={320} height={320}>
                    <Pie
                      data={buildAllocation(openPositions, "region", portfolioSummary?.current_value || 0).map((item) => ({
                      name: item.label,
                      value: item.value,
                    }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={110}
                      label={false}
                    
                    >
                      {buildAllocation(openPositions, "region", portfolioSummary?.current_value || 0).map((_, index) => (
                        <Cell
                          key={index}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                    formatter={(value) =>
                     `${formatNumber(Number(value || 0))} EUR`
                    }
                  />
                </PieChart>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
              <h2 className="mb-4 text-2xl font-semibold">
                Allocation par thème
              </h2>

              <div className="flex h-80 min-h-[320px] w-full justify-center">
                <PieChart width={320} height={320}>
                    <Pie

                    data={(() => {
                      const items = buildAllocation(
                        openPositions,
                        "topic",
                        portfolioSummary?.current_value || 0
                      );

                      const top5 = items.slice(0, 5);

                      const othersValue = items
                        .slice(5)
                        .reduce((sum, item) => sum + item.value, 0);

                      const finalItems =
                        othersValue > 0
                          ? [...top5, { label: "Autres", value: othersValue }]
                          : top5;

                      return finalItems.map((item) => ({
                        name: item.label,
                        value: item.value,
                      }));
                    })()}

                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={110}
                      label={false}
                  
                    >
                      {(() => {
                        const items = buildAllocation(
                          openPositions,
                          "topic",
                          portfolioSummary?.current_value || 0
                        );

                        const top5 = items.slice(0, 5);

                        const othersValue = items
                          .slice(5)
                          .reduce((sum, item) => sum + item.value, 0);

                        const finalItems =
                          othersValue > 0
                            ? [...top5, { label: "Autres", value: othersValue }]
                            : top5;

                        return finalItems.map((_, index) => (
                          <Cell
                            key={index}
                            fill={chartColors[index % chartColors.length]}
                          />
                        ));
                      })()}
                    </Pie>
                    <Tooltip
                    formatter={(value) =>
                    `${formatNumber(Number(value || 0))} EUR`
                    }
                  />
                </PieChart>
              </div>
            </div>
          </div>

            {activePortfolio && portfolioSummary && openPositions.length > 0 && (
              <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
                <h2 className="mb-4 text-2xl font-semibold">
                  Allocation cible vs actuelle
                </h2>

                <div className="mb-6 rounded-lg bg-slate-800 p-4">
                  <div className="mb-3 font-semibold">
                    Allocation cible
                  </div>

                  <div className="grid gap-3 md:grid-cols-6">
                    {Object.entries(targetRegionalAllocation).map(([region, value]) => (
                      <div key={region}>
                        <label className="mb-1 block text-xs text-slate-400">
                          {region}
                        </label>

                        <input
                          type="number"
                          value={value}
                          onChange={(e) =>
                            setTargetRegionalAllocation((prev) => ({
                              ...prev,
                              [region]: Number(e.target.value),
                            }))
                          }
                          className="w-full rounded bg-slate-700 p-2"
                        />
                      </div>
                    ))}
                  </div>
                  
                   <button
                    onClick={saveTargetAllocations}
                    className="mt-4 rounded bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500"
                  >
                    Sauvegarder les cibles
                  </button>   

                  <div
                    className={`mt-4 font-semibold ${
                      targetAllocationTotal === 100
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    Total : {targetAllocationTotal} %
                    {targetAllocationTotal === 100
                      ? " ✓ Allocation valide"
                      : " ⚠ Doit être égal à 100 %"}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-slate-400">
                      <tr className="border-b border-slate-700">
                        <th className="py-2">Région</th>
                        <th>Actuel</th>
                        <th>Cible</th>
                        <th>Écart</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                  {buildAllocation(openPositions, "region", portfolioSummary.current_value || 0)
                    .map((item) => {
                      const target =
                        targetRegionalAllocation[
                          item.label as keyof typeof targetRegionalAllocation
                        ] ?? 0;
                      const gap = item.weight - target;
                      const amountToRebalance =
                      ((target - item.weight) / 100) *
                      (portfolioSummary.current_value || 0);

                    return (
                      <tr key={item.label} className="border-b border-slate-700">
                        <td className="py-3 font-bold">
                          {item.label}
                        </td>

                        <td>
                          {formatNumber(item.weight)} %
                        </td>

                        <td>
                          {formatNumber(target)} %
                        </td>

                        <td
                          className={
                            Math.abs(gap) <= 2
                              ? "text-green-400"
                              : Math.abs(gap) <= 5
                              ? "text-amber-400"
                              : "text-red-400"
                          }
                        >
                          {formatNumber(gap)} %
                        </td>

                        <td className="text-slate-300">
                          {amountToRebalance > 0
                            ? `Acheter ${formatNumber(amountToRebalance)} EUR`
                            : `Vendre ${formatNumber(Math.abs(amountToRebalance))} EUR`}
                        </td>
                      </tr>
                    );


                    })}
                    </tbody>
                    </table>
                    </div>

              
              </div>
            )}
            
            {activePortfolio && rebalancingPlan.length > 0 && (
            <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
              <h2 className="mb-4 text-2xl font-semibold">
                Plan de rééquilibrage
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-slate-800 p-4">
                  <h3 className="mb-3 font-semibold text-green-400">Achats</h3>

                  {rebalancingBuys.length === 0 ? (
                    <p className="text-sm text-slate-400">Aucun achat recommandé.</p>
                  ) : (
                    rebalancingBuys.map((item) => (
                      <div key={item.label} className="flex justify-between border-b border-slate-700 py-2">
                        <span>{item.label}</span>
                        <span className="font-semibold text-green-400">
                          {formatNumber(item.amount)} EUR
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="rounded-lg bg-slate-800 p-4">
                  <h3 className="mb-3 font-semibold text-red-400">Ventes</h3>

                  {rebalancingSells.length === 0 ? (
                    <p className="text-sm text-slate-400">Aucune vente recommandée.</p>
                  ) : (
                    rebalancingSells.map((item) => (
                      <div key={item.label} className="flex justify-between border-b border-slate-700 py-2">
                        <span>{item.label}</span>
                        <span className="font-semibold text-red-400">
                          {formatNumber(Math.abs(item.amount))} EUR
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

            <div className="mt-4 rounded-lg bg-slate-800 p-4">
              <h3 className="mb-3 font-semibold">Résumé</h3>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-400">Total achats</p>
                  <p className="text-xl font-bold text-green-400">
                    {formatNumber(totalRebalancingBuys)} EUR
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Total ventes</p>
                  <p className="text-xl font-bold text-red-400">
                    {formatNumber(totalRebalancingSells)} EUR
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Cash</p>
                  <p
                    className={`text-xl font-bold ${
                      Math.abs(rebalancingCashNeed) < 1
                        ? "text-green-400"
                        : rebalancingCashNeed > 0
                        ? "text-amber-400"
                        : "text-cyan-400"
                    }`}
                  >
                    {Math.abs(rebalancingCashNeed) < 1
                      ? "Auto-finançable"
                      : rebalancingCashNeed > 0
                      ? `À investir ${formatNumber(rebalancingCashNeed)} EUR`
                      : `Cash libéré ${formatNumber(Math.abs(rebalancingCashNeed))} EUR`}
                  </p>
                </div>
              </div>
            </div>

            {activePortfolio && portfolioSummary && openPositions.length > 0 && (
              <div className="mb-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
                  <h2 className="mb-4 text-2xl font-semibold">
                    Allocation par région
                  </h2>

                  <div className="grid gap-3">
                    {buildAllocation(
                      openPositions,
                      "region",
                      portfolioSummary.current_value || 0
                    ).map((item) => (
                      <div key={item.label} className="rounded-lg bg-slate-800 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-bold">{item.label}</p>
                          <p className="text-sm text-slate-400">
                            {formatNumber(item.value)} EUR — {formatNumber(item.weight)} %
                          </p>
                        </div>

                        <div className="h-2 rounded-full bg-slate-700">
                          <div
                            className="h-2 rounded-full bg-cyan-400"
                            style={{ width: `${Math.min(item.weight, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
                  <h2 className="mb-4 text-2xl font-semibold">
                    Allocation par thème
                  </h2>

                  <div className="grid gap-3">
                    {buildAllocation(
                      openPositions,
                      "topic",
                      portfolioSummary.current_value || 0
                    ).map((item) => (
                      <div key={item.label} className="rounded-lg bg-slate-800 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-bold">{item.label}</p>
                          <p className="text-sm text-slate-400">
                            {formatNumber(item.value)} EUR — {formatNumber(item.weight)} %
                          </p>
                        </div>

                        <div className="h-2 rounded-full bg-slate-700">
                          <div
                            className="h-2 rounded-full bg-purple-400"
                            style={{ width: `${Math.min(item.weight, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activePortfolio && portfolioRealizedSummary && (
        <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="mb-4 text-2xl font-semibold">
            Historique global
          </h2>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Gain réalisé</p>
              <p
                className={`text-xl font-bold ${
                  (portfolioRealizedSummary.realized_gain || 0) >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {formatNumber(
                  portfolioRealizedSummary.realized_gain
                )} EUR
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Profits réalisés</p>
              <p className="text-xl font-bold text-green-400">
                {formatNumber(
                  portfolioRealizedSummary.realized_profit
                )} EUR
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">Pertes réalisées</p>
              <p className="text-xl font-bold text-red-400">
                {formatNumber(
                  portfolioRealizedSummary.realized_loss
                )} EUR
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">ETF avec ventes</p>
              <p className="text-xl font-bold">
                {portfolioRealizedSummary.etfs_with_sales}
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">
                Transactions de vente
              </p>
              <p className="text-xl font-bold">
                {portfolioRealizedSummary.sell_transactions}
              </p>
            </div>
          
            
            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">
                Trades gagnants
              </p>
              <p className="text-xl font-bold text-green-400">
                {portfolioRealizedSummary.winning_trades}
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">
                Trades perdants
              </p>
              <p className="text-xl font-bold text-red-400">
                {portfolioRealizedSummary.losing_trades}
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">
                Taux de réussite
              </p>
              <p className="text-xl font-bold">
                {formatNumber(
                portfolioRealizedSummary.win_rate
                )} %
              </p>
          </div>
        </div>
          <div className="mt-4 rounded-lg bg-slate-800 p-4">
            <p className="text-sm text-slate-400">
              Résultat global (latent + réalisé)
            </p>

            <p
              className={`mt-2 text-3xl font-bold ${
                ((portfolioSummary?.unrealized_gain || 0) +
                  (portfolioRealizedSummary.realized_gain || 0)) >= 0
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {formatNumber(
                (portfolioSummary?.unrealized_gain || 0) +
                  (portfolioRealizedSummary.realized_gain || 0)
              )}{" "}
              EUR
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-slate-800 p-4">
            <p className="text-sm text-slate-400">
              Meilleur trade
            </p>

            <p className="mt-2 text-lg font-bold text-green-400">
              {portfolioRealizedSummary.best_trade_ticker}
            </p>

            <p className="text-2xl font-bold text-green-400">
              {formatNumber(
                portfolioRealizedSummary.best_trade_gain
              )} EUR
            </p>
          </div>

          <div className="rounded-lg bg-slate-800 p-4">
            <p className="text-sm text-slate-400">
              Pire trade
            </p>

            <p className="mt-2 text-lg font-bold text-red-400">
              {portfolioRealizedSummary.worst_trade_ticker}
            </p>

            <p className="text-2xl font-bold text-red-400">
              {formatNumber(
                portfolioRealizedSummary.worst_trade_gain
              )} EUR
            </p>
          </div>
        </div>
        </div>
      )}
      {canEditEtfs && (
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
          const position = etf.portfolioPosition;
          const transactions = etf.transactions || [];
          const transactionForm = transactionForms[etf.id];
          const recommendationStyle = getRecommendationStyle(
            etf.recommendation?.recommendation_level
          );

          const isPositive = (snapshot?.day_change_percent || 0) >= 0;
          const isGainPositive = (position?.unrealized_gain || 0) >= 0;

          const dayPositionGain =
            position?.quantity_held && snapshot?.day_change
              ? position.quantity_held * snapshot.day_change
              : null;

          const dayPositionGainPercent = snapshot?.day_change_percent ?? null;

          const isDayPositionGainPositive = (dayPositionGain || 0) >= 0;          

          const high52 = snapshot?.raw_quote?.meta?.fiftyTwoWeekHigh ?? null;
          const low52 = snapshot?.raw_quote?.meta?.fiftyTwoWeekLow ?? null;
          const distanceHigh = distanceToHigh(snapshot?.price, high52);
          const distanceLow = distanceToLow(snapshot?.price, low52);
          const position52w = position52Weeks(snapshot?.price, high52, low52);

          const gainPercent =
            position?.unrealized_gain !== null &&
            position?.unrealized_gain !== undefined &&
            position?.net_invested_amount
              ? (position.unrealized_gain / position.net_invested_amount) * 100
              : null;
          const facteursFavorables =
            (etf.recommendationFactors || []).filter(
              (f) => f.factor_sentiment === "favorable"
            );

          const facteursVigilance =
            (etf.recommendationFactors || []).filter(
              (f) => f.factor_sentiment === "vigilance"
            );

          const facteursVendeurs =
            (etf.recommendationFactors || []).filter(
              (f) => f.factor_sentiment === "vendeur"
            );
          const renderFacteurs = (facteurs: RecommendationFactor[]) =>
            facteurs.map((factor) => (
              <div
                key={`${factor.factor_category}-${factor.factor_label}`}
                className={`rounded-lg border border-slate-700 border-l-4 bg-slate-900/40 p-3 ${
                  factor.importance_score >= 75
                    ? "border-l-red-400"
                    : factor.importance_score >= 50
                    ? "border-l-orange-400"
                    : factor.importance_score >= 30
                    ? "border-l-yellow-400"
                    : "border-l-slate-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">
                    {factor.factor_category === "PORTEFEUILLE"
                      ? "💼 "
                      : factor.factor_category === "TECHNIQUE"
                      ? "📈 "
                      : factor.factor_category === "CHANDELIER"
                      ? "🕯️ "
                      : "🔎 "}
                    {factor.factor_label}
                  </div>

                  <div className="w-56">
                    <div className="mb-1 flex justify-between text-xs text-slate-400">
                      <span>Importance</span>
                      <span>{factor.importance_score}/100</span>
                    </div>

                    <div className="h-3 rounded-full bg-slate-700">
                      <div
                        className={`h-3 rounded-full ${
                          factor.importance_score >= 75
                            ? "bg-red-400"
                            : factor.importance_score >= 50
                            ? "bg-orange-400"
                            : factor.importance_score >= 30
                            ? "bg-yellow-400"
                            : "bg-slate-500"
                        }`}
                        style={{
                          width: `${Math.min(Number(factor.importance_score || 0), 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-1 text-sm text-slate-300">
                  {factor.factor_explanation}
                </div>
              </div>
            ));

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

                  {etf.recommendation && (
                    <div className="mt-4 w-full rounded-2xl border border-orange-500/40 bg-gradient-to-br from-slate-800 to-orange-950/30 p-5 shadow-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${recommendationStyle.border} ${recommendationStyle.text}`}
                          >
                            {getRecommendationLabel(etf.recommendation.recommendation_level)}
                          </span>

                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            MOTEUR DE DÉCISION
                          </p>
                        </div>

                        <p className={`mt-3 text-4xl font-extrabold ${recommendationStyle.text}`}>
                          {etf.recommendation.recommendation_name}
                        </p>

                          <p className="mt-1 text-sm text-slate-400">
                            Thèse : {etf.recommendation.thesis_code}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-slate-400">AI Score</p>
                          <p className="text-4xl font-extrabold text-cyan-400">
                            {formatNumber(etf.recommendation.recommendation_confidence, 0)}
                          </p>
                          <p className="text-xs text-slate-400">/100</p>
                        </div>
                      </div>

                      <div className="mt-4 h-3 rounded-full bg-slate-700">
                        <div
                          className="h-3 rounded-full bg-cyan-400"
                          style={{
                            width: `${Math.min(
                              Number(etf.recommendation.recommendation_confidence || 0),
                              100
                            )}%`,
                          }}
                        />
                      </div>

                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                        <div className="rounded-lg bg-slate-900/60 p-3">
                          <p className="text-xs text-slate-500">Confiance thèse</p>
                          <p className="font-bold text-white">
                            {formatNumber(etf.recommendation.thesis_confidence, 0)} %
                          </p>
                        </div>

                        <div className="rounded-lg bg-slate-900/60 p-3">
                          <p className="text-xs text-slate-500">Position</p>
                          <p className="font-bold text-white">
                            {etf.recommendation.is_held ? "Détenue" : "Non détenue"}
                          </p>
                        </div>

                        <div className="rounded-lg bg-slate-900/60 p-3">
                          <p className="text-xs text-slate-500">Gain latent</p>
                          <p
                            className={`font-bold ${
                              (etf.recommendation.latent_gain_percent || 0) >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {formatNumber(etf.recommendation.latent_gain_percent)} %
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-4 border-t border-slate-700 pt-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          FACTEURS DE DÉCISION
                        </p>
                      
                      <div className="mt-3 space-y-5">
                        {facteursFavorables.length > 0 && (
                          <div>
                            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-green-400">
                              🟢 Points favorables
                            </h4>
                            <div className="space-y-3">{renderFacteurs(facteursFavorables)}</div>
                          </div>
                        )}

                        {facteursVigilance.length > 0 && (
                          <div>
                            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-400">
                              🟠 Points de vigilance
                            </h4>
                            <div className="space-y-3">{renderFacteurs(facteursVigilance)}</div>
                          </div>
                        )}

                        {facteursVendeurs.length > 0 && (
                          <div>
                            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-red-400">
                              🔴 Signaux vendeurs
                            </h4>
                            <div className="space-y-3">{renderFacteurs(facteursVendeurs)}</div>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 border-t border-slate-700 pt-4">

                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            CONCLUSION
                        </p>

                        <p className="mt-2 text-sm leading-relaxed text-slate-300">
                          La recommandation{" "}
                          <span className={`font-bold ${recommendationStyle.text}`}>
                            {etf.recommendation.recommendation_name}
                          </span>{" "}
                          est principalement influencée par{" "}
                          {(etf.recommendationFactors || [])
                            .slice(0, 3)
                            .map((factor) => factor.factor_label)
                            .join(", ")}
                          . Le score de décision est de{" "}
                          <span className="font-bold text-cyan-400">
                            {formatNumber(etf.recommendation.recommendation_confidence, 0)}/100
                          </span>
                          .
                        </p>

                    </div>
                      </div>
                      
                    </div>
                  )}

                  <p className="text-slate-500 mt-1">ISIN : {etf.isin}</p>
                  <p className="text-slate-500">Exchange : {etf.exchange}</p>
                  <p className="text-slate-500">Currency : {etf.currency || "EUR"}</p>
                  <p className="text-slate-500">Region : {etf.region}</p>
                  <p className="text-slate-500">Topic : {etf.topic || "-"}</p>
                </div>

                {canEditEtfs && (
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
                  <p className="text-lg font-semibold">{formatNumber(snapshot?.volume, 0)}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Dernière collecte</p>
                  <p className="text-sm font-semibold">{formatDateTime(snapshot?.snapshot_at)}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-10 rounded-lg bg-slate-800 p-4">
                <div><p className="text-xs text-slate-400">Open</p><p className="font-semibold">{formatNumber(snapshot?.open_price)}</p></div>
                <div><p className="text-xs text-slate-400">High</p><p className="font-semibold">{formatNumber(snapshot?.high_price)}</p></div>
                <div><p className="text-xs text-slate-400">Low</p><p className="font-semibold">{formatNumber(snapshot?.low_price)}</p></div>
                <div><p className="text-xs text-slate-400">Close J-1</p><p className="font-semibold">{formatNumber(snapshot?.previous_close)}</p></div>
                <div><p className="text-xs text-slate-400">52W High</p><p className="font-semibold">{formatNumber(high52)}</p></div>
                <div><p className="text-xs text-slate-400">52W Low</p><p className="font-semibold">{formatNumber(low52)}</p></div>
                <div><p className="text-xs text-slate-400">Écart 52W High</p><p className="font-semibold">{formatNumber(distanceHigh)} %</p></div>
                <div><p className="text-xs text-slate-400">Écart 52W Low</p><p className="font-semibold text-emerald-400">{formatNumber(distanceLow)} %</p></div>
                <div><p className="text-xs text-slate-400">Position 52W</p><p className="font-semibold">{formatNumber(position52w)} %</p></div>
                <div><p className="text-xs text-slate-400">Source</p><p className="font-semibold">Yahoo</p></div>
              </div>

              <div className="mt-3 rounded-lg bg-slate-800 p-4">
                <h3 className="mb-3 text-lg font-semibold">
                  Portefeuille {activePortfolio ? `: ${activePortfolio.portfolio_name}` : ""}
                </h3>

                <div className="grid gap-3 md:grid-cols-8">
                  <div>
                    <p className="text-xs text-slate-400">Quantité détenue</p>
                    <p className="font-semibold">{formatNumber(position?.quantity_held, 4)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">PRU moyen</p>
                    <p className="font-semibold">{formatNumber(position?.average_price)} {etf.currency || "EUR"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Investi net</p>
                    <p className="font-semibold">{formatNumber(position?.net_invested_amount)} {etf.currency || "EUR"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Valeur actuelle</p>
                    <p className="font-semibold">{formatNumber(position?.current_value)} {etf.currency || "EUR"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Gain jour</p>
                    <p
                      className={`font-semibold ${
                        isDayPositionGainPositive ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {formatNumber(dayPositionGain)} {etf.currency || "EUR"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400">Gain jour %</p>
                    <p
                      className={`font-semibold ${
                        isDayPositionGainPositive ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {formatNumber(dayPositionGainPercent)} %
                    </p>
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
                      {formatNumber(gainPercent)} %
                    </p>
                  </div>
                </div>

                {canEditPortfolio && transactionForm && (
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <select
                      className="rounded bg-slate-900 p-3"
                      value={transactionForm.transaction_type}
                      onChange={(e) =>
                        updateTransactionForm(etf.id, "transaction_type", e.target.value)
                      }
                    >
                      <option value="BUY">Achat</option>
                      <option value="SELL">Vente</option>
                    </select>

                    <input
                      type="date"
                      className="rounded bg-slate-900 p-3"
                      value={transactionForm.transaction_date}
                      onChange={(e) =>
                        updateTransactionForm(etf.id, "transaction_date", e.target.value)
                      }
                    />

                    <input
                      className="rounded bg-slate-900 p-3"
                      placeholder="Quantité"
                      value={transactionForm.quantity}
                      onChange={(e) =>
                        updateTransactionForm(etf.id, "quantity", e.target.value)
                      }
                    />

                    <input
                      className="rounded bg-slate-900 p-3"
                      placeholder="Prix"
                      value={transactionForm.price}
                      onChange={(e) =>
                        updateTransactionForm(etf.id, "price", e.target.value)
                      }
                    />

                    <input
                      className="rounded bg-slate-900 p-3"
                      placeholder="Frais"
                      value={transactionForm.fees}
                      onChange={(e) =>
                        updateTransactionForm(etf.id, "fees", e.target.value)
                      }
                    />

                    <select
                      className="rounded bg-slate-900 p-3"
                      value={transactionForm.broker}
                      onChange={(e) =>
                        updateTransactionForm(etf.id, "broker", e.target.value)
                      }
                    >
                      {brokers.map((broker) => (
                        <option key={broker} value={broker}>
                          {broker}
                        </option>
                      ))}
                    </select>

                    <input
                      className="rounded bg-slate-900 p-3"
                      placeholder="Note"
                      value={transactionForm.note}
                      onChange={(e) =>
                        updateTransactionForm(etf.id, "note", e.target.value)
                      }
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => saveTransaction(etf.id)}
                        className="flex-1 rounded bg-indigo-600 px-5 py-3 font-semibold hover:bg-indigo-500"
                      >
                        {editingTransactionId ? "Modifier transaction" : "Ajouter transaction"}
                      </button>

                      {editingTransactionId && (
                        <button
                          onClick={() => cancelEditTransaction(etf.id)}
                          className="rounded bg-slate-700 px-4 py-3 font-semibold hover:bg-slate-600"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!activePortfolio && (
                  <p className="mt-3 text-sm text-slate-500">
                    Ouvre un portefeuille pour encoder des achats ou ventes.
                  </p>
                )}

                {activePortfolio && (
                  <div className="mt-5">
                    <h4 className="mb-2 font-semibold">Historique des transactions</h4>

                    {transactions.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Aucune transaction encodée pour cet ETF.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="text-slate-400">
                            <tr>
                              <th className="py-2">Date</th>
                              <th>Type</th>
                              <th>Quantité</th>
                              <th>Prix</th>
                              <th>Frais</th>
                              <th>Broker</th>
                              <th>Note</th>
                              <th className="text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map((transaction) => (
                              <tr key={transaction.id} className="border-t border-slate-700">
                                <td className="py-2">{formatDate(transaction.transaction_date)}</td>
                                <td>
                                  <span className={transaction.transaction_type === "BUY" ? "text-green-400" : "text-red-400"}>
                                    {transaction.transaction_type === "BUY" ? "Achat" : "Vente"}
                                  </span>
                                </td>
                                <td>{formatNumber(transaction.quantity, 4)}</td>
                                <td>{formatNumber(transaction.price)} {etf.currency || "EUR"}</td>
                                <td>{formatNumber(transaction.fees)} {etf.currency || "EUR"}</td>
                                <td>{transaction.broker || "-"}</td>
                                <td>{transaction.note || "-"}</td>
                                <td className="text-right">
                                  <button
                                    onClick={() => editTransaction(transaction)}
                                    className="mr-2 rounded bg-amber-600 px-3 py-1 font-semibold hover:bg-amber-500"
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    onClick={() => deleteTransaction(transaction.id)}
                                    className="rounded bg-red-700 px-3 py-1 font-semibold hover:bg-red-600"
                                  >
                                    Supprimer
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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