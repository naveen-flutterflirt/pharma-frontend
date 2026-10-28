"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { HeaderActions } from "@/components/HeaderActions";
import {
  FileText,
  Receipt,
  Warehouse,
  Truck,
  IndianRupee,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
  ChevronRight,
  ShieldCheck,
  X,
  Sparkles
} from "lucide-react";
import { api } from "@/lib/api";

interface DashboardData {
  pipeline: {
    pendingOrders: number;
    pendingOrdersValue?: number;
    billedInvoices: number;
    activeWarehouseTrays: number;
    deliveryVansOnRoute: number;
    collectedTodayAmount: number;
  };
  kpis: {
    salesToday: number;
    salesGrowth: string;
    grossMargin: string;
    grossMarginNote: string;
    totalOrders: number;
    pendingOrders: number;
    fillRate: string;
    shortLinesCount: number;
    totalOutstanding: number;
    overdue45Days: number;
    claimsPending: number;
    claimsOlder90d: number;
  };
  channelBreakdown: Array<{
    label: string;
    value: number;
    percent: number;
    color: string;
  }>;
  topPrincipals: Array<{
    name: string;
    sales: number;
    margin: number;
    count: number;
  }>;
  receivablesAgeing: {
    ageing0to15: number;
    ageing16to30: number;
    ageing31to45: number;
    ageingOver45: number;
    totalOutstanding: number;
    blockedCustomersCount: number;
  };
  shortages: Array<{
    id: string;
    name: string;
    principal: string;
    demandToday: number;
    inStock: number;
    lostSales: number;
    reorderLink: string;
  }>;
  expiryWatch: {
    expiringIn90Days: number;
    returnableToPrincipals: number;
    expiredReturnsFromChemists: number;
  };
  collectionsSummary: {
    totalCollectedToday: number;
    upiPercent: number;
    chequePercent: number;
    cashPercent: number;
  };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedRange, setSelectedRange] = useState("Today");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const t = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(t);
  }, []);

  const loadData = useCallback(async (isSilent = false, rangeToFetch?: string) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    const activeRange = rangeToFetch || selectedRange;
    try {
      const res = await api.getDashboardSummary({ range: activeRange });
      if (res?.summary) {
        setData(res.summary);
      }
    } catch (err) {
      console.error("Error loading dashboard summary:", err);
      showToast("Unable to sync live data from database");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedRange, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format currency helpers
  const formatLakh = (amt: number) => {
    const val = (amt || 0) / 100000;
    return `₹${val.toFixed(1)}L`;
  };

  const formatCrore = (amt: number) => {
    const val = (amt || 0) / 10000000;
    return `₹${val.toFixed(2)}Cr`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f8f9] overflow-y-auto relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-4 right-8 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl bg-slate-900 text-white text-xs font-semibold animate-in slide-in-from-top-3">
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-white/70 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="px-4 sm:px-8 py-5 sm:py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 bg-white sm:bg-transparent">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Good morning, Mr. Shah
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Live ERP Pulse
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Main Central Depot · Pharma Distribution Management Console
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <HeaderActions
            selectedRange={selectedRange}
            onRangeChange={(range) => {
              setSelectedRange(range);
              loadData(true, range);
              showToast(`Date filter: ${range}`);
            }}
          />

          <button
            id="refresh-dashboard-btn"
            onClick={() => {
              loadData(true);
              showToast("Refreshing operational metrics from DB...");
            }}
            disabled={refreshing}
            className="p-2 bg-white border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
            title="Refresh Live Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#178582]" : ""}`} />
          </button>

          <a
            id="export-dashboard-mis-btn"
            href={api.getDashboardExportUrl(selectedRange)}
            download
            onClick={() => showToast(`Downloading ${selectedRange} Executive MIS CSV...`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
            title="Download Executive MIS CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Export MIS</span>
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-4 sm:p-8 space-y-6">

        {/* ADMIN OPERATIONS PIPELINE (Live Business Cycle Stepper) */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span>Daily Distribution Pipeline</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Flow
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Click any stage to oversee and manage today&apos;s operations</p>
            </div>
            <div className="text-xs font-semibold text-[#178582] flex items-center gap-1">
              <span>Admin Control Center</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3">
            {/* Step 1: Order Intake */}
            <Link
              id="pipeline-step-orders"
              href="/order-desk"
              className="p-3 rounded-lg border border-gray-200 hover:border-[#178582] hover:bg-teal-50/30 transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1.5 text-gray-700 font-bold group-hover:text-[#178582]">
                  <FileText className="w-3.5 h-3.5 text-[#178582]" />
                  1. Order Intake
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-gray-900 font-mono">
                  {loading ? "..." : (data?.pipeline.pendingOrders ?? 12)}
                </span>
                <span className="text-[10px] text-amber-600 font-semibold">Pending</span>
              </div>
            </Link>

            {/* Step 2: Billing & IRN */}
            <Link
              id="pipeline-step-billing"
              href="/billing"
              className="p-3 rounded-lg border border-gray-200 hover:border-[#178582] hover:bg-teal-50/30 transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1.5 text-gray-700 font-bold group-hover:text-[#178582]">
                  <Receipt className="w-3.5 h-3.5 text-[#178582]" />
                  2. GST Billing
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-gray-900 font-mono">
                  {loading ? "..." : (data?.pipeline.billedInvoices ?? 33)}
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold">Billed</span>
              </div>
            </Link>

            {/* Step 3: Warehouse Picking */}
            <Link
              id="pipeline-step-warehouse"
              href="/warehouse"
              className="p-3 rounded-lg border border-gray-200 hover:border-[#178582] hover:bg-teal-50/30 transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1.5 text-gray-700 font-bold group-hover:text-[#178582]">
                  <Warehouse className="w-3.5 h-3.5 text-[#178582]" />
                  3. Warehouse
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-gray-900 font-mono">
                  {loading ? "..." : `${data?.pipeline.activeWarehouseTrays ?? 12} Trays`}
                </span>
                <span className="text-[10px] text-blue-600 font-semibold">FEFO Active</span>
              </div>
            </Link>

            {/* Step 4: Van Delivery */}
            <Link
              id="pipeline-step-delivery"
              href="/delivery"
              className="p-3 rounded-lg border border-gray-200 hover:border-[#178582] hover:bg-teal-50/30 transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1.5 text-gray-700 font-bold group-hover:text-[#178582]">
                  <Truck className="w-3.5 h-3.5 text-[#178582]" />
                  4. Delivery
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-gray-900 font-mono">
                  {loading ? "..." : `${data?.pipeline.deliveryVansOnRoute ?? 3} Vans`}
                </span>
                <span className="text-[10px] text-purple-600 font-semibold">On Route</span>
              </div>
            </Link>

            {/* Step 5: Collections */}
            <Link
              id="pipeline-step-collections"
              href="/collections"
              className="p-3 rounded-lg border border-gray-200 hover:border-[#178582] hover:bg-teal-50/30 transition-all flex flex-col justify-between group cursor-pointer col-span-2 md:col-span-1"
            >
              <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1.5 text-gray-700 font-bold group-hover:text-[#178582]">
                  <IndianRupee className="w-3.5 h-3.5 text-[#178582]" />
                  5. Collections
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-gray-900 font-mono">
                  {loading ? "..." : formatLakh(data?.pipeline.collectedTodayAmount ?? 790600)}
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold">Today</span>
              </div>
            </Link>
          </div>
        </div>

        {/* KPI Cards Row (Fully clickable links for Admin drill-down) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <KpiCard
            id="kpi-sales-today"
            href="/billing"
            title="Sales today"
            value={loading ? "..." : formatLakh(data?.kpis.salesToday ?? 2585040)}
            subtitle={data?.kpis.salesGrowth ?? "▲ 8.4% vs last week"}
            subtitleColor="text-emerald-600"
          />
          <KpiCard
            id="kpi-gross-margin"
            href="/reports"
            title="Gross margin"
            value={data?.kpis.grossMargin ?? "9.8%"}
            subtitle={data?.kpis.grossMarginNote ?? "▼ 0.3 pts — schemes"}
            subtitleColor="text-orange-500"
          />
          <KpiCard
            id="kpi-orders-count"
            href="/order-desk"
            title="Orders"
            value={loading ? "..." : String(data?.kpis.totalOrders ?? 25)}
            subtitle={`${data?.kpis.pendingOrders ?? 12} pending billing`}
            subtitleColor="text-amber-600"
          />
          <KpiCard
            id="kpi-fill-rate"
            href="/products"
            title="Fill rate"
            value={data?.kpis.fillRate ?? "97.8%"}
            subtitle={`${data?.kpis.shortLinesCount ?? 1} lines short`}
            subtitleColor="text-orange-500"
          />
          <KpiCard
            id="kpi-outstanding"
            href="/collections"
            title="Outstanding"
            value={loading ? "..." : formatCrore(data?.kpis.totalOutstanding ?? 28400000)}
            subtitle={`${formatLakh(data?.kpis.overdue45Days ?? 3800000)} over 45 days`}
            subtitleColor="text-orange-500"
          />
          <KpiCard
            id="kpi-claims-pending"
            href="/claims"
            title="Claims pending"
            value={loading ? "..." : formatLakh(data?.kpis.claimsPending ?? 1120000)}
            subtitle={`${formatLakh(data?.kpis.claimsOlder90d ?? 310000)} older than 90 d`}
            subtitleColor="text-orange-500"
          />
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">

          {/* Sales by channel */}
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-[15px] font-bold text-gray-900">Sales by channel — today</h2>
              <Link href="/salesmen" className="text-xs text-[#178582] hover:underline font-semibold">
                Manage Beats →
              </Link>
            </div>
            <div className="space-y-4">
              {(data?.channelBreakdown || [
                { label: "Salesman app", value: 610000, percent: 45, color: "bg-[#178582]" },
                { label: "Chemist app", value: 380000, percent: 28, color: "bg-[#178582]" },
                { label: "WhatsApp OCR", value: 240000, percent: 18, color: "bg-[#94a3b8]" },
                { label: "Hospitals", value: 190000, percent: 14, color: "bg-[#178582]" },
                { label: "Counter", value: 40000, percent: 3, color: "bg-[#178582]" }
              ]).map((ch, idx) => (
                <ChannelBar
                  key={idx}
                  label={ch.label}
                  value={formatLakh(ch.value)}
                  percent={ch.percent}
                  color={ch.color}
                />
              ))}
            </div>
          </div>

          {/* Top principals */}
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-[15px] font-bold text-gray-900">Top principals — month to date</h2>
              <Link href="/purchase" className="text-xs text-[#178582] hover:underline font-semibold">
                Purchase POs →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[260px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100 text-[11px] sm:text-xs font-semibold">
                    <th className="pb-2.5 pr-3 font-semibold">Principal</th>
                    <th className="pb-2.5 px-3 font-semibold">Sales</th>
                    <th className="pb-2.5 pl-3 font-semibold text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="text-gray-900 font-medium">
                  {(data?.topPrincipals || [
                    { name: "Cipla Ltd", sales: 6240000, margin: 10.2 },
                    { name: "Sun Pharma", sales: 4810000, margin: 9.1 },
                    { name: "Abbott Healthcare", sales: 3170000, margin: 11.4 },
                    { name: "GlaxoSmithKline", sales: 2290000, margin: 8.6 },
                    { name: "Torrent Pharmaceuticals", sales: 1850000, margin: 9.8 }
                  ]).map((p, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                      <td className="py-2.5 pr-3 font-bold text-gray-800 whitespace-nowrap">{p.name}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">{formatLakh(p.sales)}</td>
                      <td className="py-2.5 pl-3 text-right font-mono text-emerald-700 font-bold whitespace-nowrap">
                        {p.margin}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Receivables ageing */}
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-5 flex flex-col md:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm sm:text-[15px] font-bold text-gray-900">Receivables ageing</h2>
              <Link href="/collections" className="text-xs text-[#178582] hover:underline font-semibold">
                Ledger →
              </Link>
            </div>
            <div className="flex-1 flex items-end justify-between gap-2 pb-2 min-h-[120px]">
              <AgeingBar
                label="0–15 d"
                value={formatCrore(data?.receivablesAgeing.ageing0to15 ?? 13600000)}
                height="h-24"
                color="bg-[#a8d3d1]"
              />
              <AgeingBar
                label="16–30 d"
                value={formatCrore(data?.receivablesAgeing.ageing16to30 ?? 8800000)}
                height="h-16"
                color="bg-[#a8d3d1]"
              />
              <AgeingBar
                label="31–45 d"
                value={formatCrore(data?.receivablesAgeing.ageing31to45 ?? 2200000)}
                height="h-8"
                color="bg-[#f59e0b]"
              />
              <AgeingBar
                label=">45 d"
                value={formatCrore(data?.receivablesAgeing.ageingOver45 ?? 3800000)}
                height="h-10"
                color="bg-[#ef4444]"
              />
            </div>
            <Link
              id="ageing-blocked-chemists-link"
              href="/customers"
              className="text-xs text-red-600 font-bold mt-3 pt-3 border-t border-gray-100 flex items-center justify-between hover:bg-red-50/50 p-1.5 rounded transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-600"></span>
                <span>
                  {data?.receivablesAgeing.blockedCustomersCount ?? 2} customers auto-blocked for overdue &gt; 45d
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">

          {/* Shortages hurting fill rate */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200/80 shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-sm sm:text-[15px] font-bold text-gray-900">Shortages hurting fill rate</h2>
                <p className="text-xs text-gray-500">Unfulfilled customer demand requiring immediate procurement</p>
              </div>
              <Link href="/purchase" className="text-xs sm:text-sm text-[#178582] hover:underline font-semibold cursor-pointer">
                Create purchase order →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[540px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100 text-[11px] sm:text-xs">
                    <th className="pb-2.5 pr-4 font-semibold">Product</th>
                    <th className="pb-2.5 px-3 font-semibold">Principal</th>
                    <th className="pb-2.5 px-3 font-semibold">Demand today</th>
                    <th className="pb-2.5 px-3 font-semibold text-center">In stock</th>
                    <th className="pb-2.5 px-3 font-semibold text-right">Lost sales</th>
                    <th className="pb-2.5 pl-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-gray-900 font-medium">
                  {(data?.shortages || [
                    { id: "1", name: "Amoxicillin + Clav 625 tab", principal: "Sun Pharma", demandToday: 340, inStock: 120, lostSales: 21400 },
                    { id: "2", name: "Insulin glargine pen", principal: "Cipla Ltd", demandToday: 48, inStock: 0, lostSales: 18900 },
                    { id: "3", name: "Pantoprazole 40 tab", principal: "Abbott Healthcare", demandToday: 510, inStock: 300, lostSales: 9600 },
                    { id: "4", name: "ORS sachet", principal: "GSK", demandToday: 1200, inStock: 650, lostSales: 4100 }
                  ]).map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 pr-4 font-bold text-gray-900 whitespace-nowrap">{item.name}</td>
                      <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{item.principal}</td>
                      <td className="py-3 px-3 font-semibold whitespace-nowrap">{item.demandToday} units</td>
                      <td className={`py-3 px-3 font-mono font-bold text-center whitespace-nowrap ${item.inStock === 0 ? "text-red-700" : "text-amber-700"
                        }`}>
                        {item.inStock}
                      </td>
                      <td className="py-3 px-3 text-right text-red-600 font-bold font-mono whitespace-nowrap">
                        ₹{item.lostSales.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <Link
                          href={`/purchase?search=${encodeURIComponent(item.name)}`}
                          className="px-2.5 py-1 text-[11px] bg-teal-50 text-[#178582] hover:bg-teal-100 rounded font-semibold transition-colors"
                        >
                          Reorder
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right column: Expiry watch & Collected today */}
          <div className="space-y-4 sm:space-y-6">
            {/* Expiry watch */}
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm sm:text-[15px] font-bold text-gray-900">Expiry watch</h2>
                <Link href="/claims" className="text-xs text-[#178582] hover:underline font-semibold">
                  File Claims →
                </Link>
              </div>
              <div className="space-y-3 text-xs sm:text-sm">
                <Link href="/products" className="flex justify-between items-center hover:bg-gray-50 p-1.5 rounded transition-colors">
                  <span className="text-gray-600">Expiring in 90 days</span>
                  <span className="font-bold text-gray-900 font-mono">
                    {formatLakh(data?.expiryWatch.expiringIn90Days ?? 840000)}
                  </span>
                </Link>
                <Link href="/claims" className="flex justify-between items-center hover:bg-gray-50 p-1.5 rounded transition-colors">
                  <span className="text-gray-600">Returnable to principals</span>
                  <span className="font-bold text-[#178582] font-mono">
                    {formatLakh(data?.expiryWatch.returnableToPrincipals ?? 690000)}
                  </span>
                </Link>
                <Link href="/claims" className="flex justify-between items-center hover:bg-gray-50 p-1.5 rounded transition-colors">
                  <span className="text-gray-600">Expired returns from chemists</span>
                  <span className="font-bold text-gray-900 font-mono">
                    {formatLakh(data?.expiryWatch.expiredReturnsFromChemists ?? 220000)}
                  </span>
                </Link>
              </div>
            </div>

            {/* Collected today */}
            <Link
              id="dashboard-collections-card"
              href="/collections"
              className="bg-[#0c2427] text-white rounded-xl shadow-xs p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-[#0f2e32] transition-colors group cursor-pointer block"
            >
              <div className="flex items-center gap-4">
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
                  {formatLakh(data?.collectionsSummary.totalCollectedToday ?? 790600)}
                </div>
                <div>
                  <div className="font-bold text-sm sm:text-[15px] text-white">Collected today</div>
                  <div className="text-xs text-[#8ea7aa] mt-0.5">
                    UPI {data?.collectionsSummary.upiPercent ?? 61}% · cheque {data?.collectionsSummary.chequePercent ?? 24}% · cash {data?.collectionsSummary.cashPercent ?? 15}%
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-teal-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

function KpiCard({
  id,
  title,
  value,
  subtitle,
  subtitleColor,
  href
}: {
  id?: string;
  title: string;
  value: string;
  subtitle: string;
  subtitleColor: string;
  href: string;
}) {
  return (
    <Link
      id={id}
      href={href}
      className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-3.5 sm:p-4 flex flex-col justify-between hover:border-[#178582] hover:shadow-md transition-all group cursor-pointer"
    >
      <div className="flex items-center justify-between text-xs text-gray-500 font-semibold truncate" title={title}>
        <span>{title}</span>
        <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-[#178582] group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="my-1.5 text-xl sm:text-2xl font-bold text-gray-900 font-mono tracking-tight">{value}</div>
      <div className={`text-[11px] sm:text-xs font-semibold ${subtitleColor} truncate`} title={subtitle}>{subtitle}</div>
    </Link>
  );
}

function ChannelBar({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm">
      <div className="w-28 sm:w-32 text-gray-600 font-medium truncate" title={label}>{label}</div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}></div>
      </div>
      <div className="w-12 sm:w-14 text-right font-bold text-gray-900 font-mono">{value}</div>
    </div>
  );
}

function AgeingBar({ label, value, height, color }: { label: string; value: string; height: string; color: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-2">
      <div className={`w-full max-w-[36px] sm:max-w-[44px] rounded-t-sm ${color} ${height} transition-all`}></div>
      <div className="text-center text-[10px] sm:text-xs">
        <div className="text-gray-500 font-medium">{label}</div>
        <div className="font-bold text-gray-900 mt-0.5 font-mono">{value}</div>
      </div>
    </div>
  );
}
