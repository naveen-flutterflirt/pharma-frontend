"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  ShoppingCart,
  Snowflake,
  ShieldAlert,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Check,
  ChevronDown,
  Sparkles,
  Info,
  RefreshCw,
  Plus,
  SlidersHorizontal,
  ArrowRight
} from "lucide-react";
import { api } from "@/lib/api";

interface ProductBatch {
  id?: string;
  batchNo: string;
  qty: number;
  exp: string;
  tag?: "active" | "push" | "overstock" | "quarantine" | "expired";
}

interface ProductRecord {
  id: string;
  name: string;
  principal: string;
  pack: string;
  hsn: string;
  gstPercent: number;
  stock: number;
  avgDay: number;
  daysCover: number;
  batches: ProductBatch[];
  scheme: string;
  suggestedPo: number | string;
  coldChain: boolean;
  scheduleH: boolean;
  mrp: number;
  ptr: number;
  pts: number;
  binLocation: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ProductStats {
  totalProducts: number;
  totalStockUnits: number;
  totalStockValuePts: number;
  totalPrincipalsCount: number;
  lowStockCount: number;
  nearExpiryCount: number;
  overstockCount: number;
  coldChainCount: number;
  outOfStockCount: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [principalsList, setPrincipalsList] = useState<string[]>(["All"]);
  const [selectedPrincipal, setSelectedPrincipal] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"all" | "low-stock" | "near-expiry" | "overstock" | "cold-chain" | "schedule-h">("all");
  const [loading, setLoading] = useState<boolean>(true);

  // Modals & Drawers
  const [showPoModal, setShowPoModal] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [showAdjustStockModal, setShowAdjustStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [adjustTargetProduct, setAdjustTargetProduct] = useState<ProductRecord | null>(null);

  // New Product Form State
  const [newProdName, setNewProdName] = useState("");
  const [newProdPrincipal, setNewProdPrincipal] = useState("GlaxoSmithKline (Glaxo Regional)");
  const [newProdPack, setNewProdPack] = useState("10 tab");
  const [newProdHsn, setNewProdHsn] = useState("30041010");
  const [newProdGst, setNewProdGst] = useState(12);
  const [newProdMrp, setNewProdMrp] = useState<number | "">(200);
  const [newProdPtr, setNewProdPtr] = useState<number | "">(160);
  const [newProdPts, setNewProdPts] = useState<number | "">(144);
  const [newProdAvgDay, setNewProdAvgDay] = useState<number | "">(50);
  const [newProdBin, setNewProdBin] = useState("Aisle B · Rack 03 · Bin 1");
  const [newProdColdChain, setNewProdColdChain] = useState(false);
  const [newProdScheduleH, setNewProdScheduleH] = useState(false);
  const [newProdBatchNo, setNewProdBatchNo] = useState("BTH-2026-01");
  const [newProdBatchQty, setNewProdBatchQty] = useState<number | "">(500);
  const [newProdBatchExp, setNewProdBatchExp] = useState("12/28");

  // Stock Adjustment Form State
  const [adjBatchNo, setAdjBatchNo] = useState("");
  const [adjType, setAdjType] = useState<"add" | "deduct" | "set">("add");
  const [adjQty, setAdjQty] = useState<number | "">(100);
  const [adjReason, setAdjReason] = useState("Physical Stock Audit");
  const [adjStatus, setAdjStatus] = useState("active");

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "info" | "warning">("info");

  const showToast = useCallback((msg: string, type: "success" | "info" | "warning" = "info") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Fetch products, stats and principals list
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodRes, statsRes, princRes] = await Promise.all([
        api.getProducts(),
        api.getProductStats(),
        api.getProductPrincipals()
      ]);

      if (prodRes && Array.isArray(prodRes.products)) {
        setProducts(prodRes.products);
      }
      if (statsRes && statsRes.stats) {
        setStats(statsRes.stats);
      }
      if (princRes && Array.isArray(princRes.principals)) {
        setPrincipalsList(princRes.principals);
      }
    } catch (err: any) {
      console.error("Failed to load products data:", err);
      showToast(err.message || "Failed to load stock catalog", "warning");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedPrincipal !== "All" && p.principal !== selectedPrincipal) return false;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.principal.toLowerCase().includes(q) ||
        p.pack.toLowerCase().includes(q) ||
        p.hsn.toLowerCase().includes(q) ||
        p.binLocation.toLowerCase().includes(q) ||
        p.batches.some((b) => b.batchNo.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeTab === "low-stock") return p.daysCover <= 3;
      if (activeTab === "near-expiry") return p.batches.some((b) => b.tag === "push" || b.tag === "quarantine");
      if (activeTab === "overstock") return p.daysCover > 45 || p.batches.some((b) => b.tag === "overstock");
      if (activeTab === "cold-chain") return p.coldChain;
      if (activeTab === "schedule-h") return p.scheduleH;

      return true;
    });
  }, [products, selectedPrincipal, searchQuery, activeTab]);

  // Open Quick Stock Adjustment Modal
  const handleOpenStockAdjust = (p: ProductRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setAdjustTargetProduct(p);
    setAdjBatchNo(p.batches[0]?.batchNo || "BTH-2026-01");
    setAdjType("add");
    setAdjQty(100);
    setAdjReason("Physical Stock Audit");
    setAdjStatus("active");
    setShowAdjustStockModal(true);
  };

  // Submit Stock Adjustment
  const handleStockAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetProduct) return;
    if (!adjBatchNo.trim() || Number(adjQty) <= 0) {
      showToast("Please enter a valid batch number and quantity", "warning");
      return;
    }

    try {
      const res = await api.adjustProductStock(adjustTargetProduct.id, {
        batchNumber: adjBatchNo.trim(),
        adjustmentType: adjType,
        qty: Number(adjQty),
        reason: adjReason,
        status: adjStatus
      });

      setShowAdjustStockModal(false);
      showToast(res.message || "Stock adjusted successfully!", "success");
      await loadData();
    } catch (err: any) {
      console.error("Error adjusting stock:", err);
      showToast(err.message || "Failed to adjust stock", "warning");
    }
  };

  // Submit New Product
  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrincipal.trim()) {
      showToast("Product name and principal are required", "warning");
      return;
    }

    try {
      const payload = {
        name: newProdName.trim(),
        principal: newProdPrincipal.trim(),
        pack: newProdPack,
        hsn: newProdHsn,
        gstPercent: Number(newProdGst),
        mrp: Number(newProdMrp),
        ptr: Number(newProdPtr),
        pts: Number(newProdPts),
        avgDailySale: Number(newProdAvgDay),
        binLocation: newProdBin,
        coldChain: newProdColdChain,
        scheduleH: newProdScheduleH,
        initialBatchNumber: newProdBatchNo.trim(),
        initialBatchQty: Number(newProdBatchQty),
        initialExpDate: newProdBatchExp.trim()
      };

      const res = await api.createProduct(payload);
      setShowNewProductModal(false);
      showToast(res.message || `Product ${res.product?.name} created!`, "success");
      await loadData();
    } catch (err: any) {
      console.error("Error creating product:", err);
      showToast(err.message || "Failed to create product", "warning");
    }
  };

  // Products needing PO suggestion (low stock / stockout)
  const lowStockPoSuggestions = useMemo(() => {
    return products.filter((p) => p.daysCover <= 3 || p.stock === 0);
  }, [products]);

  // Total estimated PO value
  const totalSuggestedPoPts = useMemo(() => {
    return lowStockPoSuggestions.reduce((acc, p) => {
      const qty = typeof p.suggestedPo === "number" ? p.suggestedPo : 100;
      return acc + (qty * p.pts);
    }, 0);
  }, [lowStockPoSuggestions]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f8f9] overflow-hidden relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className={`absolute top-4 right-8 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-xs font-semibold transition-all transform animate-in slide-in-from-top-3 duration-200 ${
            toastType === "success" 
              ? "bg-emerald-900 text-white border-emerald-700" 
              : toastType === "warning"
              ? "bg-amber-900 text-white border-amber-700"
              : "bg-slate-900 text-white border-slate-700"
          }`}
        >
          {toastType === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toastType === "warning" && <ShieldAlert className="w-4 h-4 text-amber-400" />}
          {toastType === "info" && <Sparkles className="w-4 h-4 text-blue-400" />}
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-white/70 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="px-4 sm:px-8 py-5 sm:py-6 bg-white border-b border-gray-200 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Products &amp; Stock Catalog
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Live PostgreSQL Connected
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              {stats ? (
                <>
                  <strong className="text-gray-900 font-semibold">{stats.totalProducts}</strong> products ·{" "}
                  <strong className="text-gray-900 font-semibold">{stats.totalPrincipalsCount}</strong> principals · stock value{" "}
                  <strong className="text-emerald-700 font-bold">
                    ₹{((stats.totalStockValuePts || 0) / 100000).toFixed(1)} Lakh
                  </strong>{" "}
                  at PTS ({stats.totalStockUnits.toLocaleString("en-IN")} units)
                </>
              ) : (
                "Loading stock statistics..."
              )}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Filter: Principal Dropdown */}
            <div className="relative">
              <select
                value={selectedPrincipal}
                onChange={(e) => setSelectedPrincipal(e.target.value)}
                className="pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-md text-xs sm:text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#178582] transition-colors cursor-pointer shadow-xs appearance-none"
              >
                {principalsList.map((p) => (
                  <option key={p} value={p} className="text-gray-900 bg-white">
                    {p === "All" ? "Filter: All Principals" : `Filter: ${p}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <Link
              href="/purchase"
              className="px-3.5 py-2 bg-teal-50 border border-teal-200 text-[#178582] font-semibold rounded-md text-xs sm:text-sm hover:bg-teal-100 transition-colors shadow-xs"
            >
              Purchase Orders →
            </Link>

            {/* Export CSV Button */}
            <a
              href={api.getProductsExportUrl()}
              download
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 font-semibold rounded-md text-xs sm:text-sm hover:bg-gray-50 transition-colors shadow-xs"
              title="Download Statutory Stock Statement CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </a>

            {/* Refresh Button */}
            <button
              onClick={loadData}
              className="p-2 border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600 cursor-pointer"
              title="Refresh Catalog Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#178582]" : ""}`} />
            </button>

            {/* New Product Button */}
            <button
              onClick={() => setShowNewProductModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#178582] text-[#178582] font-semibold rounded-md text-xs sm:text-sm hover:bg-teal-50 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Product</span>
            </button>

            {/* Suggest Purchase Order Button */}
            <button
              onClick={() => setShowPoModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#178582] text-white font-semibold rounded-md text-xs sm:text-sm hover:bg-[#126b68] transition-colors cursor-pointer shadow-sm active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Suggest PO ({stats?.lowStockCount || 0})</span>
            </button>
          </div>
        </div>

        {/* Dynamic Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-5 pt-5 border-t border-gray-100">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All Formulations ({products.length})
            </button>
            <button
              onClick={() => setActiveTab("low-stock")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "low-stock" ? "bg-white text-red-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Low Cover (&lt;3d) ({stats?.lowStockCount || 0})
            </button>
            <button
              onClick={() => setActiveTab("near-expiry")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "near-expiry" ? "bg-white text-amber-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Push / Short-Dated ({stats?.nearExpiryCount || 0})
            </button>
            <button
              onClick={() => setActiveTab("overstock")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "overstock" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Overstocked ({stats?.overstockCount || 0})
            </button>
            <button
              onClick={() => setActiveTab("cold-chain")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "cold-chain" ? "bg-white text-cyan-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Cold Chain ({stats?.coldChainCount || 0})
            </button>
            <button
              onClick={() => setActiveTab("schedule-h")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "schedule-h" ? "bg-white text-purple-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Schedule H / H1
            </button>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product, pack, batch, HSN..."
              className="pl-9 pr-4 py-2 w-full rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 placeholder:text-gray-400 font-medium"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-6">
        
        {/* Products Table Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[850px]">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Pack</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">Avg/day</th>
                  <th className="py-3 px-4">Days cover</th>
                  <th className="py-3 px-4">Batches (qty · expiry)</th>
                  <th className="py-3 px-4">Scheme</th>
                  <th className="py-3 px-4">Suggested PO</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-900">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400 text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#178582]" />
                        <span>Loading product catalog from database...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400 text-sm">
                      No matching products found in stock catalog.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isZeroStock = p.stock === 0;
                    
                    return (
                      <tr 
                        key={p.id} 
                        onClick={() => setSelectedProduct(p)}
                        className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                      >
                        {/* Product Name & Flags */}
                        <td className="py-3.5 px-4 font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{p.name}</span>
                            {p.coldChain && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                                <Snowflake className="w-2.5 h-2.5" /> Cold
                              </span>
                            )}
                            {p.scheduleH && (
                              <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                                Rx · H
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 font-normal mt-0.5">
                            {p.principal} · {p.binLocation} · HSN {p.hsn}
                          </div>
                        </td>

                        {/* Pack */}
                        <td className="py-3.5 px-4 text-gray-600 font-medium">
                          {p.pack}
                        </td>

                        {/* Stock */}
                        <td className="py-3.5 px-4 font-bold font-mono">
                          <span className={isZeroStock ? "text-red-600 bg-red-50 px-2 py-0.5 rounded" : "text-gray-900"}>
                            {p.stock.toLocaleString("en-IN")}
                          </span>
                        </td>

                        {/* Avg/day */}
                        <td className="py-3.5 px-4 font-mono text-gray-700">
                          {p.avgDay}
                        </td>

                        {/* Days cover */}
                        <td className="py-3.5 px-4 font-bold font-mono">
                          <span className={
                            p.daysCover === 0 
                              ? "text-red-600" 
                              : p.daysCover <= 2.5 
                              ? "text-amber-600" 
                              : "text-emerald-700"
                          }>
                            {p.daysCover} d
                          </span>
                        </td>

                        {/* Batches (qty · expiry) */}
                        <td className="py-3.5 px-4 font-mono text-gray-700">
                          {p.batches.length === 0 ? (
                            <span className="text-gray-400 italic">No active batches</span>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              {p.batches.map((b, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1">
                                  <span>{b.qty.toLocaleString("en-IN")} · {b.exp}</span>
                                  {b.tag === "push" && (
                                    <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-1 py-0.2 rounded font-sans uppercase">
                                      push
                                    </span>
                                  )}
                                  {b.tag === "overstock" && (
                                    <span className="text-[10px] font-bold bg-gray-200 text-gray-800 px-1 py-0.2 rounded font-sans uppercase">
                                      overstock
                                    </span>
                                  )}
                                  {b.tag === "quarantine" && (
                                    <span className="text-[10px] font-bold bg-red-100 text-red-800 px-1 py-0.2 rounded font-sans uppercase">
                                      quarantine
                                    </span>
                                  )}
                                  {idx < p.batches.length - 1 && <span className="text-gray-300">·</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Scheme */}
                        <td className="py-3.5 px-4 font-semibold text-emerald-800">
                          {p.scheme}
                        </td>

                        {/* Suggested PO */}
                        <td className="py-3.5 px-4 font-bold font-mono text-gray-900">
                          {p.suggestedPo !== "—" ? (
                            <span className="text-[#178582] bg-[#178582]/10 px-2 py-0.5 rounded">
                              {Number(p.suggestedPo).toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-normal">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleOpenStockAdjust(p, e)}
                              className="px-2.5 py-1 border border-gray-300 rounded text-[11px] font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer shadow-2xs"
                              title="Adjust Stock or Add Batch"
                            >
                              <SlidersHorizontal className="w-3 h-3 inline mr-1 text-[#178582]" />
                              <span>Adjust</span>
                            </button>
                            <button
                              onClick={() => setSelectedProduct(p)}
                              className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded text-[11px] font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                              title="View FEFO Batch Register"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Formula Footnote */}
          <div className="p-3 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-500 italic flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>
              Suggested PO = (forecast × lead time + safety stock − stock − open PO), rounded to the principal&apos;s case size and adjusted so the order qualifies for the current scheme slab.
            </span>
          </div>
        </div>

        {/* Lower Two Panels: Action Board & Stock Rules */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Near-Expiry Action Board */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[14px] font-bold text-gray-900">
                  Near-expiry action board · next 6 months
                </h2>
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Total Exposure: ₹26.6L
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase text-[10px]">
                      <th className="pb-2">Bucket</th>
                      <th className="pb-2">Value</th>
                      <th className="pb-2 text-right">Action Recommended</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-bold text-red-600">Expired (in stock)</td>
                      <td className="py-2.5 font-mono font-bold text-gray-900">₹1.1L</td>
                      <td className="py-2.5 text-right">
                        <Link 
                          href="/claims"
                          className="text-[#178582] hover:text-[#126b68] font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <span>Quarantine · raise expiry claim to principal</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-bold text-amber-600">0–3 months</td>
                      <td className="py-2.5 font-mono font-bold text-gray-900">₹8.4L</td>
                      <td className="py-2.5 text-right">
                        <button 
                          onClick={() => showToast("Institutional priority allocation sheet prepared for hospitals.", "info")}
                          className="text-[#178582] hover:text-[#126b68] font-semibold hover:underline cursor-pointer"
                        >
                          Return within principal&apos;s window · offer to hospitals →
                        </button>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-bold text-gray-800">3–6 months</td>
                      <td className="py-2.5 font-mono font-bold text-gray-900">₹14.9L</td>
                      <td className="py-2.5 text-right">
                        <Link 
                          href="/salesmen"
                          className="text-[#178582] hover:text-[#126b68] font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <span>Push via salesman app, small scheme</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 font-bold text-gray-800">Chemist returns waiting</td>
                      <td className="py-2.5 font-mono font-bold text-gray-900">₹2.2L</td>
                      <td className="py-2.5 text-right">
                        <Link 
                          href="/claims"
                          className="text-[#178582] hover:text-[#126b68] font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <span>Verify, credit note, add to claim</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
              <span>Expiry alerts auto-synchronize with WhatsApp salesman briefings daily at 8:00 AM.</span>
            </div>
          </div>

          {/* Stock Rules Enforced */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-[14px] font-bold text-gray-900 mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#178582]" />
                <span>Stock rules enforced by system</span>
              </h2>

              <ul className="space-y-2.5 text-xs text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#178582] mt-1.5 shrink-0" />
                  <span><strong>Billing picks the earliest-expiry batch first (FEFO)</strong> — no manual batch overrides permitted without checker login.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#178582] mt-1.5 shrink-0" />
                  <span><strong>Minimum shelf life on sale</strong> — system hard-blocks any batch under 90 days from billing to retail chemists.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <span><strong>Expired and recalled batches hard-blocked</strong> from inventory reservation across all order channels.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <span><strong>Cold-chain items flagged</strong> for insulated cold-box packing with validated ice-gel packs.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#178582] mt-1.5 shrink-0" />
                  <span><strong>Schedule H1 &amp; narcotics sales</strong> automatically logged in statutory drug registers with doctor details.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#178582] mt-1.5 shrink-0" />
                  <span><strong>Multiple warehouses / branches</strong> supported with tracked Inter-Stock Transfers (IST).</span>
                </li>
              </ul>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
              <span>Complies with Drugs &amp; Cosmetics Act Rule 65 &amp; Good Distribution Practice (GDP).</span>
            </div>
          </div>

        </div>

      </div>

      {/* SUGGEST PURCHASE ORDER MODAL */}
      {showPoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 animate-in zoom-in-95 duration-150 border border-gray-200">
            <div className="flex justify-between items-start pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Automated Purchase Order Recommendations
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Calculated against lead times, buffer covers, and scheme qualifiers from live stock
                </p>
              </div>
              <button onClick={() => setShowPoModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between items-center">
                <div>
                  <span className="text-gray-500">Selected Principal:</span>
                  <div className="font-bold text-gray-900 text-sm">{selectedPrincipal === "All" ? "All Principals (Priority Reorder)" : selectedPrincipal}</div>
                </div>
                <div className="text-right">
                  <span className="text-gray-500">Scheme Slab Qualifier:</span>
                  <div className="font-bold text-emerald-700">10+1 Commercial Free Goods</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-64">
                <table className="w-full text-left min-w-[450px]">
                  <thead className="bg-gray-100/70 text-gray-500 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-3">Stock &amp; Cover</th>
                      <th className="py-2 px-3">Run-rate</th>
                      <th className="py-2 px-3 text-right">Recommended PO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {lowStockPoSuggestions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-400">
                          All products currently have adequate stock cover (&gt;3 days).
                        </td>
                      </tr>
                    ) : (
                      lowStockPoSuggestions.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 font-semibold text-gray-900">{p.name}</td>
                          <td className="py-2 px-3 font-mono text-red-600">
                            {p.stock} ({p.daysCover}d)
                          </td>
                          <td className="py-2 px-3 font-mono">{p.avgDay}/day</td>
                          <td className="py-2 px-3 text-right font-bold text-[#178582] font-mono">
                            {p.suggestedPo} units
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center text-xs p-2.5 bg-emerald-50 rounded border border-emerald-200 text-emerald-900">
                <span>Estimated PO Value (PTS): <strong className="text-gray-900">₹{totalSuggestedPoPts.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></span>
                <span className="font-semibold text-emerald-800">Qualifies for 10+1 Free Goods</span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowPoModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
              <Link
                href="/purchase"
                className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm inline-flex items-center gap-1.5"
              >
                <span>Go to Purchase Orders</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* NEW PRODUCT MASTER MODAL */}
      {showNewProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900">Add New Product Master SKU</h3>
                <p className="text-xs text-gray-500">Register new formulation, pricing tiers, and warehouse bin location</p>
              </div>
              <button onClick={() => setShowNewProductModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProductSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Formulation Name *</label>
                  <input
                    type="text"
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="e.g. Cefpodoxime 200mg tab"
                    className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-800 mb-1">Manufacturer / Principal *</label>
                  <input
                    type="text"
                    required
                    value={newProdPrincipal}
                    onChange={(e) => setNewProdPrincipal(e.target.value)}
                    placeholder="e.g. Cipla Stockist"
                    className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Pack Size</label>
                  <input
                    type="text"
                    value={newProdPack}
                    onChange={(e) => setNewProdPack(e.target.value)}
                    placeholder="10 tab"
                    className="w-full border border-gray-300 rounded-md p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={newProdHsn}
                    onChange={(e) => setNewProdHsn(e.target.value)}
                    placeholder="30041010"
                    className="w-full border border-gray-300 rounded-md p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">GST Slab %</label>
                  <select
                    value={newProdGst}
                    onChange={(e) => setNewProdGst(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 text-xs font-semibold"
                  >
                    <option value={5}>5% GST (Life Saving / Critical)</option>
                    <option value={12}>12% GST (Standard Pharma)</option>
                    <option value={18}>18% GST (Cosmeceuticals / Devices)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">MRP (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProdMrp}
                    onChange={(e) => setNewProdMrp(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-md p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">PTR (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProdPtr}
                    onChange={(e) => setNewProdPtr(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-md p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">PTS (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProdPts}
                    onChange={(e) => setNewProdPts(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-md p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Avg Daily Sales (Units)</label>
                  <input
                    type="number"
                    value={newProdAvgDay}
                    onChange={(e) => setNewProdAvgDay(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="50"
                    className="w-full border border-gray-300 rounded-md p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Warehouse Bin Location</label>
                  <input
                    type="text"
                    value={newProdBin}
                    onChange={(e) => setNewProdBin(e.target.value)}
                    placeholder="Aisle B · Rack 03 · Bin 1"
                    className="w-full border border-gray-300 rounded-md p-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProdColdChain}
                    onChange={(e) => setNewProdColdChain(e.target.checked)}
                    className="rounded text-[#178582] focus:ring-[#178582]"
                  />
                  <span className="font-semibold text-gray-800">Cold Chain (2°C - 8°C)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProdScheduleH}
                    onChange={(e) => setNewProdScheduleH(e.target.checked)}
                    className="rounded text-[#178582] focus:ring-[#178582]"
                  />
                  <span className="font-semibold text-gray-800">Schedule H / H1 Prescription</span>
                </label>
              </div>

              {/* Initial Batch */}
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/70">
                <h4 className="font-bold text-gray-800 mb-2">Initial Opening Batch (Optional)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Batch Number</label>
                    <input
                      type="text"
                      value={newProdBatchNo}
                      onChange={(e) => setNewProdBatchNo(e.target.value)}
                      placeholder="e.g. BTH-2026-01"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Initial Qty</label>
                    <input
                      type="number"
                      value={newProdBatchQty}
                      onChange={(e) => setNewProdBatchQty(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="500"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">Expiry Date (MM/YY)</label>
                    <input
                      type="text"
                      value={newProdBatchExp}
                      onChange={(e) => setNewProdBatchExp(e.target.value)}
                      placeholder="12/28"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowNewProductModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm"
                >
                  Save Product to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK STOCK ADJUSTMENT MODAL */}
      {showAdjustStockModal && adjustTargetProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Adjust Physical Stock</h3>
                <p className="text-xs text-gray-500">{adjustTargetProduct.name} · {adjustTargetProduct.principal}</p>
              </div>
              <button onClick={() => setShowAdjustStockModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStockAdjustSubmit} className="my-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">Batch Number</label>
                <input
                  type="text"
                  required
                  value={adjBatchNo}
                  onChange={(e) => setAdjBatchNo(e.target.value)}
                  placeholder="e.g. AC2501"
                  className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Action Type</label>
                  <select
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value as "add" | "deduct" | "set")}
                    className="w-full border border-gray-300 rounded p-2 bg-white text-xs font-semibold"
                  >
                    <option value="add">+ Add Stock (Inward/Return)</option>
                    <option value="deduct">- Deduct Stock (Damage/Shortage)</option>
                    <option value="set">= Set Exact Count (Audit)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Quantity (Units)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={adjQty}
                    onChange={(e) => setAdjQty(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full border border-gray-300 rounded p-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Adjustment Reason</label>
                <select
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 bg-white text-xs font-medium"
                >
                  <option value="Physical Stock Audit">Physical Stock Audit / Rectification</option>
                  <option value="Transit Breakage / Leakage">Transit Breakage / Leakage</option>
                  <option value="Chemist Return Restocked">Chemist Return Restocked</option>
                  <option value="Quarantined for Principal Claim">Quarantined for Principal Claim</option>
                  <option value="Doctor Sampling Allocation">Doctor Sampling Allocation</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Batch Inventory Status</label>
                <select
                  value={adjStatus}
                  onChange={(e) => setAdjStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 bg-white text-xs font-medium"
                >
                  <option value="active">Active (Available for FEFO Billing)</option>
                  <option value="push">Push (Short-Dated Priority)</option>
                  <option value="overstock">Overstock Buffer</option>
                  <option value="quarantine">Quarantine (Blocked from sale)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustStockModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm"
                >
                  Apply Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRODUCT BATCH REGISTER DRAWER / MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 animate-in zoom-in-95 duration-150 border border-gray-200">
            <div className="flex justify-between items-start pb-3 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">{selectedProduct.name}</h3>
                  {selectedProduct.coldChain && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold">Cold Chain</span>
                  )}
                  {selectedProduct.scheduleH && (
                    <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 font-bold">Rx · Schedule H</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedProduct.principal} · Pack: {selectedProduct.pack} · {selectedProduct.binLocation} · HSN {selectedProduct.hsn}
                </p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 text-center">
                <div>
                  <span className="text-gray-400 text-[10px]">MRP</span>
                  <div className="font-bold text-gray-900 font-mono">₹{selectedProduct.mrp.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px]">PTR (Sell)</span>
                  <div className="font-bold text-[#178582] font-mono">₹{selectedProduct.ptr.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px]">PTS (Cost)</span>
                  <div className="font-bold text-gray-700 font-mono">₹{selectedProduct.pts.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px]">GST Slab</span>
                  <div className="font-bold text-purple-700 font-mono">{selectedProduct.gstPercent}%</div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-gray-800">Allocated FEFO Batches ({selectedProduct.batches.length}):</h4>
                  <button
                    onClick={(e) => {
                      setSelectedProduct(null);
                      handleOpenStockAdjust(selectedProduct, e);
                    }}
                    className="text-[#178582] hover:underline font-semibold flex items-center gap-1 cursor-pointer text-xs"
                  >
                    <Plus className="w-3 h-3" /> Adjust / Add Batch
                  </button>
                </div>

                {selectedProduct.batches.length === 0 ? (
                  <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200 text-xs">
                    Stockout! Zero active batches currently in warehouse inventory.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedProduct.batches.map((b, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2.5 bg-gray-50 rounded border border-gray-200">
                        <div>
                          <span className="font-mono font-bold text-gray-900">{b.batchNo}</span>
                          <span className="text-gray-500 ml-2">Exp: {b.exp}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {b.tag && b.tag !== "active" && (
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              b.tag === "push" 
                                ? "bg-orange-100 text-orange-800" 
                                : b.tag === "quarantine"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-200 text-gray-800"
                            }`}>
                              {b.tag}
                            </span>
                          )}
                          <span className="font-mono font-bold text-gray-900">{b.qty} units</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-2.5 bg-gray-50 rounded border border-gray-200 flex justify-between items-center text-xs">
                <span className="text-gray-600">Total Stock Value at PTS:</span>
                <span className="font-bold text-gray-900 font-mono text-sm">
                  ₹{(selectedProduct.stock * selectedProduct.pts).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm"
              >
                Close Register
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
