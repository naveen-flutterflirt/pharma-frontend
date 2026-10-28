"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  CheckCircle2,
  Truck,
  AlertTriangle,
  FileText,
  Download,
  ShieldAlert,
  X,
  Sparkles,
  QrCode,
  Check,
  Boxes,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  Trash2
} from "lucide-react";
import { api } from "@/lib/api";

interface PurchaseOrderItem {
  id?: string;
  purchaseOrderId?: string;
  name: string;
  pack: string;
  orderedQty: number;
  freeQty: number;
  receivedQty?: number | null;
  ptsPrice: number;
  invoicedPts?: number | null;
  mrp: number;
  batchNo?: string | null;
  expDate?: string | null;
  isDiscrepancy?: boolean;
  discrepancyNote?: string | null;
}

interface PurchaseOrderRecord {
  id: string;
  poNumber: string;
  principalName: string;
  depotLocation: string;
  orderDate: string;
  expectedDate: string;
  linesCount: number;
  totalPts: number;
  freeGoodsValue: number;
  schemeSlab?: string | null;
  status: "transmitted" | "inwarding" | "received" | "discrepancy";
  grnNumber?: string | null;
  supplierInvoiceNo?: string | null;
  debitNoteNo?: string | null;
  debitNoteAmount?: number | null;
  backOrdersWaiting: number;
  createdAt?: string;
  updatedAt?: string;
  items: PurchaseOrderItem[];
}

interface PurchaseStats {
  openOrdersValue: number;
  openOrdersCount: number;
  inwardingShipmentsCount: number;
  rateDiscrepancyAmount: number;
  pendingDebitNotesCount: number;
  backOrdersWaitingCount: number;
  totalPosCount: number;
  transmittedCount: number;
  inwardingCount: number;
  receivedCount: number;
  discrepancyCount: number;
}

export default function PurchasePage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
  const [stats, setStats] = useState<PurchaseStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "inwarding" | "transmitted" | "discrepancy" | "received">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [showNewPoModal, setShowNewPoModal] = useState(false);
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [selectedPoForGrn, setSelectedPoForGrn] = useState<PurchaseOrderRecord | null>(null);
  const [grnSupplierInv, setGrnSupplierInv] = useState("");
  const [grnItems, setGrnItems] = useState<Array<{
    id: string;
    name: string;
    orderedQty: number;
    freeQty: number;
    receivedQty: number;
    ptsPrice: number;
    invoicedPts: number;
    batchNo: string;
    expDate: string;
  }>>([]);

  const [showDebitNoteModal, setShowDebitNoteModal] = useState(false);
  const [selectedPoForDebitNote, setSelectedPoForDebitNote] = useState<PurchaseOrderRecord | null>(null);

  const [showPoDocModal, setShowPoDocModal] = useState(false);
  const [selectedPoForDoc, setSelectedPoForDoc] = useState<PurchaseOrderRecord | null>(null);

  const [showEInvoiceModal, setShowEInvoiceModal] = useState(false);
  const [eInvoiceJson, setEInvoiceJson] = useState("");

  // New PO Form State
  const [newPoPrincipal, setNewPoPrincipal] = useState("GlaxoSmithKline (Glaxo Regional)");
  const [newPoDepot, setNewPoDepot] = useState("Regional C&F Depot, Sector 4");
  const [newPoScheme, setNewPoScheme] = useState("10+1 Free Goods Slab (100+10)");
  const [newPoBackOrders, setNewPoBackOrders] = useState(0);
  const [newPoLines, setNewPoLines] = useState<Array<{
    name: string;
    pack: string;
    orderedQty: number;
    freeQty: number;
    ptsPrice: number;
    mrp: number;
  }>>([
    { name: "Amoxicillin + Clav 625 (10)", pack: "10 tab", orderedQty: 1000, freeQty: 100, ptsPrice: 146.16, mrp: 204.0 },
    { name: "Cefixime 200 (10)", pack: "10 tab", orderedQty: 500, freeQty: 50, ptsPrice: 79.38, mrp: 110.0 }
  ]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "info" | "warning">("info");

  const showToast = useCallback((message: string, type: "success" | "info" | "warning" = "info") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Fetch POs and Stats
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [ordersRes, statsRes] = await Promise.all([
        api.getPurchaseOrders(),
        api.getPurchaseStats()
      ]);

      if (ordersRes && Array.isArray(ordersRes.orders)) {
        setPurchaseOrders(ordersRes.orders);
      }
      if (statsRes && statsRes.stats) {
        setStats(statsRes.stats);
      }
    } catch (err: any) {
      console.error("Failed to load purchase orders:", err);
      showToast(err.message || "Failed to load purchase orders from server", "warning");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        po.poNumber.toLowerCase().includes(q) ||
        po.principalName.toLowerCase().includes(q) ||
        (po.grnNumber && po.grnNumber.toLowerCase().includes(q)) ||
        (po.supplierInvoiceNo && po.supplierInvoiceNo.toLowerCase().includes(q)) ||
        (po.debitNoteNo && po.debitNoteNo.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeFilter === "inwarding") return po.status === "inwarding";
      if (activeFilter === "transmitted") return po.status === "transmitted";
      if (activeFilter === "discrepancy") return po.status === "discrepancy";
      if (activeFilter === "received") return po.status === "received";

      return true;
    });
  }, [purchaseOrders, searchQuery, activeFilter]);

  // Open GRN Verification Modal
  const handleInwardGrn = (po: PurchaseOrderRecord) => {
    setSelectedPoForGrn(po);
    setGrnSupplierInv(po.supplierInvoiceNo || "INV-SUP-88912");
    setGrnItems(
      (po.items || []).map((it, idx) => ({
        id: it.id || "",
        name: it.name,
        orderedQty: it.orderedQty,
        freeQty: it.freeQty,
        receivedQty: it.receivedQty !== null && it.receivedQty !== undefined ? it.receivedQty : it.orderedQty,
        ptsPrice: it.ptsPrice,
        invoicedPts: it.invoicedPts !== null && it.invoicedPts !== undefined ? it.invoicedPts : it.ptsPrice,
        batchNo: it.batchNo || `BTH-2026-${String(idx + 1).padStart(2, "0")}`,
        expDate: it.expDate || "10/28"
      }))
    );
    setShowGrnModal(true);
  };

  // Submit GRN
  const handleConfirmGrn = async () => {
    if (!selectedPoForGrn) return;

    try {
      const res = await api.processGrn(selectedPoForGrn.id, {
        supplierInvoiceNo: grnSupplierInv,
        receivedItems: grnItems
      });

      setShowGrnModal(false);
      showToast(res.message || "GRN processed successfully!", "success");
      await loadData();
    } catch (err: any) {
      console.error("Error processing GRN:", err);
      showToast(err.message || "Failed to process GRN", "warning");
    }
  };

  // Handle New PO submission
  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoPrincipal.trim()) {
      showToast("Please select or enter a Principal name", "warning");
      return;
    }
    if (newPoLines.length === 0) {
      showToast("Please add at least one formulation item", "warning");
      return;
    }

    try {
      const payload = {
        principalName: newPoPrincipal,
        depotLocation: newPoDepot,
        schemeSlab: newPoScheme,
        backOrdersWaiting: Number(newPoBackOrders) || 0,
        items: newPoLines.map((it) => ({
          name: it.name,
          pack: it.pack,
          orderedQty: Number(it.orderedQty),
          freeQty: Number(it.freeQty),
          ptsPrice: Number(it.ptsPrice),
          mrp: Number(it.mrp)
        }))
      };

      const res = await api.createPurchaseOrder(payload);
      setShowNewPoModal(false);
      showToast(res.message || `Purchase Order ${res.order?.poNumber} transmitted via EDI portal.`, "success");
      await loadData();
    } catch (err: any) {
      console.error("Error creating PO:", err);
      showToast(err.message || "Failed to create purchase order", "warning");
    }
  };

  // Add line to New PO
  const handleAddNewLine = () => {
    setNewPoLines([
      ...newPoLines,
      { name: "Paracetamol 650 tab", pack: "15 tab", orderedQty: 500, freeQty: 50, ptsPrice: 25.65, mrp: 34.5 }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (newPoLines.length <= 1) {
      showToast("At least one formulation item is required", "warning");
      return;
    }
    setNewPoLines(newPoLines.filter((_, idx) => idx !== index));
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updated = [...newPoLines];
    const current = { ...updated[index], [field]: value };

    // Auto-calculate 10+1 free goods if orderedQty changes
    if (field === "orderedQty") {
      const q = Number(value) || 0;
      current.freeQty = Math.floor(q / 10);
    }
    updated[index] = current;
    setNewPoLines(updated);
  };

  // Calculate totals for new PO
  const newPoTotalPts = useMemo(() => {
    return newPoLines.reduce((acc, it) => acc + (Number(it.orderedQty || 0) * Number(it.ptsPrice || 0)), 0);
  }, [newPoLines]);

  const newPoFreeGoodsValue = useMemo(() => {
    return newPoLines.reduce((acc, it) => acc + (Number(it.freeQty || 0) * Number(it.ptsPrice || 0)), 0);
  }, [newPoLines]);

  // Open Debit Note modal
  const handleOpenDebitNote = (po: PurchaseOrderRecord) => {
    setSelectedPoForDebitNote(po);
    setShowDebitNoteModal(true);
  };

  // Open PO Document modal
  const handleOpenPoDoc = (po: PurchaseOrderRecord) => {
    setSelectedPoForDoc(po);
    setShowPoDocModal(true);
  };

  // Format currency
  const formatCurrency = (val: number) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)} Lakh`;
    }
    return `₹${val.toLocaleString("en-IN")}`;
  };

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
          {toastType === "warning" && <AlertTriangle className="w-4 h-4 text-amber-400" />}
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
                Purchase Orders &amp; GRN Inwarding
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Live PostgreSQL Connected
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Purchase-to-stock workflow: suggest PO, verify GRN barcode batches, resolve rate discrepancies, and auto-bill back-orders.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/products"
              className="px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-100 transition-colors"
            >
              ← Stock Catalog
            </Link>
            <Link
              href="/claims"
              className="px-3 py-2 bg-teal-50 border border-teal-200 text-[#178582] rounded-md text-xs font-semibold hover:bg-teal-100 transition-colors"
            >
              Principal Claims →
            </Link>
            <button
              onClick={() => setShowEInvoiceModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-sm font-semibold hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-gray-500" />
              <span>Import C&amp;F e-Invoice</span>
            </button>
            <a
              href={api.getPurchaseManifestExportUrl()}
              download
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-50 transition-colors shadow-xs"
              title="Download Statutory Purchase Manifest CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </a>
            <button
              onClick={loadData}
              className="p-2 border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600 cursor-pointer"
              title="Refresh Purchase Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#178582]" : ""}`} />
            </button>
            <button
              onClick={() => setShowNewPoModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#178582] text-white rounded-md text-sm font-semibold hover:bg-[#126b68] transition-colors shadow-sm cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Purchase Order</span>
            </button>
          </div>
        </div>

        {/* Dynamic KPI Stat Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Open Orders to Principals</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">
              {stats ? formatCurrency(stats.openOrdersValue) : "Loading..."}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {stats ? `${stats.openOrdersCount} active POs across suppliers` : "Fetching live data..."}
            </div>
          </div>
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Inwarding / GRN in Progress</div>
            <div className="text-lg font-bold text-amber-700 mt-0.5">
              {stats ? `${stats.inwardingShipmentsCount} Shipments` : "Loading..."}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Physical batch scanning in progress</div>
          </div>
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Rate Discrepancy Claims</div>
            <div className="text-lg font-bold text-red-600 mt-0.5">
              {stats ? `₹${stats.rateDiscrepancyAmount.toLocaleString("en-IN")}` : "Loading..."}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {stats ? `${stats.pendingDebitNotesCount} Debit Notes pending deduction` : "Monitoring invoiced PTS..."}
            </div>
          </div>
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Back-Orders Waiting Arrival</div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">
              {stats ? `${stats.backOrdersWaitingCount} Strips` : "Loading..."}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Auto-bills on GRN confirmation</div>
          </div>
        </div>
      </header>

      {/* Main Table Area */}
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-4">
        
        {/* Filter & Search Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All Purchase Orders ({purchaseOrders.length})
            </button>
            <button
              onClick={() => setActiveFilter("inwarding")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "inwarding" ? "bg-white text-amber-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Inwarding / GRN Active ({stats?.inwardingCount ?? 0})
            </button>
            <button
              onClick={() => setActiveFilter("discrepancy")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "discrepancy" ? "bg-white text-red-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Discrepancies / Debit Notes ({stats?.discrepancyCount ?? 0})
            </button>
            <button
              onClick={() => setActiveFilter("transmitted")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "transmitted" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              PO Sent to C&amp;F ({stats?.transmittedCount ?? 0})
            </button>
            <button
              onClick={() => setActiveFilter("received")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "received" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Completed &amp; Stocked ({stats?.receivedCount ?? 0})
            </button>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PO #, Principal, Supplier Inv..."
              className="pl-9 pr-4 py-2 w-full rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 placeholder:text-gray-400 font-medium"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Purchase Orders Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[850px]">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">PO # &amp; Date</th>
                  <th className="py-3 px-4">Principal / C&amp;F Depot</th>
                  <th className="py-3 px-4">Lines &amp; Value (PTS)</th>
                  <th className="py-3 px-4">Scheme Benefit</th>
                  <th className="py-3 px-4">Inward Status</th>
                  <th className="py-3 px-4">Back-Order Impact</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-900">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#178582]" />
                        <span>Loading purchase orders from database...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                      No matching purchase orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50/80 transition-colors group">
                      
                      {/* PO # & Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 font-mono text-sm">{po.poNumber}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">Ordered: {po.orderDate}</div>
                        <div className="text-[10px] text-gray-400">Exp: {po.expectedDate}</div>
                      </td>

                      {/* Principal & Depot */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 text-[13px]">{po.principalName}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{po.depotLocation}</div>
                      </td>

                      {/* Lines & Value */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-gray-900 text-sm">₹{po.totalPts.toLocaleString("en-IN")}</div>
                        <div className="text-[11px] text-gray-500">{po.linesCount} SKUs requested</div>
                      </td>

                      {/* Scheme Benefit */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-block text-[11px]">
                          {po.schemeSlab || "Standard Commercial Terms"}
                        </div>
                        {po.freeGoodsValue > 0 && (
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Free Goods: <span className="font-bold text-gray-800">₹{po.freeGoodsValue.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                      </td>

                      {/* Inward Status */}
                      <td className="py-3.5 px-4">
                        {po.status === "inwarding" && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                              <Boxes className="w-3 h-3 text-amber-600" /> GRN Inwarding ({po.grnNumber || "Pending"})
                            </span>
                            {po.supplierInvoiceNo && (
                              <div className="text-[10px] text-gray-400 mt-0.5">Inv #{po.supplierInvoiceNo}</div>
                            )}
                          </div>
                        )}
                        {po.status === "transmitted" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Truck className="w-3 h-3 text-blue-600" /> Transmitted via EDI
                          </span>
                        )}
                        {po.status === "discrepancy" && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700 border border-red-300">
                              <AlertTriangle className="w-3 h-3 text-red-600" /> Rate Discrepancy (DN #{po.debitNoteNo || "DN-Pending"})
                            </span>
                            <div className="text-[10px] text-red-600 font-semibold mt-0.5">
                              Debit Note: ₹{po.debitNoteAmount?.toLocaleString("en-IN")}
                            </div>
                          </div>
                        )}
                        {po.status === "received" && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> GRN Completed
                            </span>
                            <div className="text-[10px] text-gray-400 mt-0.5">{po.grnNumber}</div>
                          </div>
                        )}
                      </td>

                      {/* Back-Order Impact */}
                      <td className="py-3.5 px-4">
                        {po.backOrdersWaiting > 0 ? (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded border border-emerald-200">
                            {po.backOrdersWaiting} strips will auto-bill
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">No pending back-orders</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(po.status === "inwarding" || po.status === "transmitted") && (
                            <button
                              onClick={() => handleInwardGrn(po)}
                              className="px-3 py-1.5 bg-[#178582] text-white font-semibold rounded text-xs hover:bg-[#126b68] cursor-pointer shadow-xs"
                            >
                              Verify GRN
                            </button>
                          )}
                          {po.status === "discrepancy" && (
                            <button
                              onClick={() => handleOpenDebitNote(po)}
                              className="px-2.5 py-1.5 border border-red-300 bg-red-50 text-red-700 font-semibold rounded text-xs hover:bg-red-100 cursor-pointer"
                            >
                              View Debit Note
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenPoDoc(po)}
                            className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 text-gray-600 cursor-pointer"
                            title="View / Print PO Document"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* VERIFY GRN MODAL */}
      {showGrnModal && selectedPoForGrn && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">
                    Verify Goods Receipt Note ({selectedPoForGrn.poNumber})
                  </h3>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                    Supplier: {selectedPoForGrn.principalName}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Scan received barcodes, verify FEFO expiry dates, and reconcile invoiced PTS against PO contracted price.
                </p>
              </div>
              <button onClick={() => setShowGrnModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-4 text-xs">
              
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block font-semibold text-gray-700 mb-1">Supplier Invoice Number</label>
                  <input
                    type="text"
                    value={grnSupplierInv}
                    onChange={(e) => setGrnSupplierInv(e.target.value)}
                    placeholder="e.g. INV-C&F-88912"
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs font-mono font-medium focus:ring-1 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block font-semibold text-gray-700 mb-1">C&amp;F Depot Received At</label>
                  <input
                    type="text"
                    value={selectedPoForGrn.depotLocation}
                    disabled
                    className="w-full border border-gray-200 bg-gray-50 text-gray-600 rounded px-3 py-1.5 text-xs font-medium"
                  />
                </div>
              </div>

              {/* Items Inwarding Table */}
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Batch No</th>
                      <th className="py-2.5 px-3">Expiry</th>
                      <th className="py-2.5 px-3">Ordered Qty</th>
                      <th className="py-2.5 px-3">Received Qty</th>
                      <th className="py-2.5 px-3">Contract PTS</th>
                      <th className="py-2.5 px-3 text-right">Invoiced PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {grnItems.map((item, idx) => {
                      const isRateMismatch = item.invoicedPts > item.ptsPrice;
                      return (
                        <tr key={idx} className={`hover:bg-gray-50 ${isRateMismatch ? "bg-red-50/40" : ""}`}>
                          <td className="py-2.5 px-3 font-semibold text-gray-900">
                            <div>{item.name}</div>
                            {isRateMismatch && (
                              <div className="text-[10px] text-red-600 font-semibold flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3 text-red-500" />
                                Rate Discrepancy! +₹{(item.invoicedPts - item.ptsPrice).toFixed(2)}/unit
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={item.batchNo}
                              onChange={(e) => {
                                const next = [...grnItems];
                                next[idx].batchNo = e.target.value;
                                setGrnItems(next);
                              }}
                              className="w-24 border border-gray-300 rounded px-2 py-1 font-mono text-[11px]"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={item.expDate}
                              onChange={(e) => {
                                const next = [...grnItems];
                                next[idx].expDate = e.target.value;
                                setGrnItems(next);
                              }}
                              placeholder="MM/YY"
                              className="w-20 border border-gray-300 rounded px-2 py-1 font-mono text-[11px]"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono text-gray-600">
                            {item.orderedQty} + {item.freeQty} free
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              value={item.receivedQty}
                              onChange={(e) => {
                                const next = [...grnItems];
                                next[idx].receivedQty = Number(e.target.value);
                                setGrnItems(next);
                              }}
                              className="w-20 border border-gray-300 rounded px-2 py-1 font-mono text-[11px] font-bold text-emerald-800"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono text-gray-700">
                            ₹{item.ptsPrice.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            <input
                              type="number"
                              step="0.01"
                              value={item.invoicedPts}
                              onChange={(e) => {
                                const next = [...grnItems];
                                next[idx].invoicedPts = Number(e.target.value);
                                setGrnItems(next);
                              }}
                              className={`w-24 border rounded px-2 py-1 font-mono text-[11px] text-right font-bold ${
                                isRateMismatch ? "border-red-400 bg-red-50 text-red-700" : "border-gray-300 text-gray-900"
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Automatic Back-Order Resolution Banner */}
              {selectedPoForGrn.backOrdersWaiting > 0 && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 text-emerald-900 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs">Back-Order Auto-Billing Queue Activated:</div>
                    <div className="text-[11px] text-emerald-800 mt-0.5">
                      Confirming this GRN will automatically allocate <strong>{selectedPoForGrn.backOrdersWaiting} strips</strong> directly to pending customer back-orders (e.g. <strong>Sri Sai Medicals · SO-2026-8812</strong>) and trigger warehouse pick slip generation!
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <span className="text-[11px] text-gray-400">
                {grnItems.some((it) => it.invoicedPts > it.ptsPrice) ? (
                  <span className="text-red-600 font-semibold flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> A debit note will be automatically generated upon inwarding.
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Rates match purchase order contract perfectly.
                  </span>
                )}
              </span>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowGrnModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmGrn}
                  className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm"
                >
                  Complete GRN &amp; Inward Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW PURCHASE ORDER MODAL */}
      {showNewPoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900">Create Purchase Order (EDI Transmit)</h3>
                <p className="text-xs text-gray-500">Order directly to Principal C&amp;F depot with scheme slab optimizer</p>
              </div>
              <button onClick={() => setShowNewPoModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePoSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Select Principal / Manufacturer</label>
                  <select
                    value={newPoPrincipal}
                    onChange={(e) => setNewPoPrincipal(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none text-xs"
                  >
                    <option value="GlaxoSmithKline (Glaxo Regional)">GlaxoSmithKline (Glaxo Regional Depot)</option>
                    <option value="Novartis / Sandoz Logistics">Novartis / Sandoz Logistics Hub</option>
                    <option value="Cipla Pharmaceuticals">Cipla Pharmaceuticals (State Mother Depot)</option>
                    <option value="Abbott Healthcare India">Abbott Healthcare India (Regional Depot 01)</option>
                    <option value="Sun Pharma Distributors">Sun Pharma Distributors (Bhiwandi C&amp;F)</option>
                    <option value="Dr. Reddy's Laboratories">Dr. Reddy&apos;s Laboratories</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-800 mb-1">Depot / Warehouse Location</label>
                  <input
                    type="text"
                    value={newPoDepot}
                    onChange={(e) => setNewPoDepot(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Scheme Slab Contract</label>
                  <input
                    type="text"
                    value={newPoScheme}
                    onChange={(e) => setNewPoScheme(e.target.value)}
                    placeholder="e.g. 10+1 Free Goods Slab (100+10)"
                    className="w-full border border-emerald-300 bg-emerald-50/50 text-emerald-900 font-medium rounded-md p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-800 mb-1">Pending Back-Orders to Fulfill</label>
                  <input
                    type="number"
                    value={newPoBackOrders}
                    onChange={(e) => setNewPoBackOrders(Number(e.target.value))}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-md p-2 text-xs"
                  />
                </div>
              </div>

              {/* Formulations line item builder */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="font-bold text-gray-800">Formulation Line Items</label>
                  <button
                    type="button"
                    onClick={handleAddNewLine}
                    className="text-xs text-[#178582] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add SKU Line
                  </button>
                </div>

                <div className="space-y-2 border border-gray-200 rounded-lg p-2.5 bg-gray-50/60 max-h-56 overflow-y-auto">
                  {newPoLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                      <div className="flex-2">
                        <input
                          type="text"
                          placeholder="Product Name"
                          value={line.name}
                          onChange={(e) => handleLineChange(idx, "name", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-semibold"
                        />
                      </div>
                      <div className="w-20">
                        <input
                          type="text"
                          placeholder="Pack"
                          value={line.pack}
                          onChange={(e) => handleLineChange(idx, "pack", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          placeholder="Qty"
                          value={line.orderedQty}
                          onChange={(e) => handleLineChange(idx, "orderedQty", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-mono font-bold"
                        />
                      </div>
                      <div className="w-16">
                        <input
                          type="number"
                          placeholder="Free"
                          value={line.freeQty}
                          onChange={(e) => handleLineChange(idx, "freeQty", e.target.value)}
                          className="w-full border border-emerald-300 bg-emerald-50 text-emerald-800 rounded px-2 py-1 text-xs font-mono"
                          title="Free units (Scheme)"
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="PTS Price"
                          value={line.ptsPrice}
                          onChange={(e) => handleLineChange(idx, "ptsPrice", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                          title="Contracted PTS"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="text-gray-400 hover:text-red-500 p-1 cursor-pointer"
                        title="Remove Line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-700">Total Order Value (PTS):</span>
                  <span className="text-base font-bold text-gray-900 font-mono">
                    ₹{newPoTotalPts.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex justify-between items-center text-xs">
                  <span className="font-semibold text-emerald-800">Free Goods Earned:</span>
                  <span className="text-base font-bold text-emerald-900 font-mono">
                    ₹{newPoFreeGoodsValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowNewPoModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm"
                >
                  Transmit PO via EDI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEBIT NOTE MODAL */}
      {showDebitNoteModal && selectedPoForDebitNote && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-red-100 text-red-700 font-bold text-[10px] uppercase">
                    Commercial Debit Note
                  </span>
                  <h3 className="text-base font-bold text-gray-900 font-mono">
                    {selectedPoForDebitNote.debitNoteNo || "DN-25-0104"}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Statutory claim note for invoiced rate mismatch against purchase order
                </p>
              </div>
              <button onClick={() => setShowDebitNoteModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <div className="text-gray-500 text-[11px]">Principal Supplier</div>
                  <div className="font-bold text-gray-900 mt-0.5">{selectedPoForDebitNote.principalName}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-[11px]">PO Reference</div>
                  <div className="font-bold text-gray-900 font-mono mt-0.5">{selectedPoForDebitNote.poNumber}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-[11px]">Supplier Invoice No</div>
                  <div className="font-bold text-gray-900 font-mono mt-0.5">{selectedPoForDebitNote.supplierInvoiceNo || "INV-NOV-44102"}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-[11px]">GRN Reference</div>
                  <div className="font-bold text-gray-900 font-mono mt-0.5">{selectedPoForDebitNote.grnNumber || "GRN-25-1046"}</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-2">Rate Discrepancy Breakdown</h4>
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-semibold">
                      <tr>
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3">Received Qty</th>
                        <th className="py-2 px-3">Contract PTS</th>
                        <th className="py-2 px-3">Invoiced PTS</th>
                        <th className="py-2 px-3 text-right">Debit Claim</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {selectedPoForDebitNote.items.filter((i) => i.isDiscrepancy || (i.invoicedPts && i.invoicedPts > i.ptsPrice)).map((item, idx) => {
                        const invPts = item.invoicedPts || item.ptsPrice;
                        const diff = invPts - item.ptsPrice;
                        const claim = diff * (item.receivedQty || item.orderedQty);
                        return (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-sans font-semibold text-gray-900">{item.name}</td>
                            <td className="py-2 px-3">{item.receivedQty || item.orderedQty}</td>
                            <td className="py-2 px-3 text-gray-600">₹{item.ptsPrice.toFixed(2)}</td>
                            <td className="py-2 px-3 text-red-600 font-bold">₹{invPts.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-bold text-red-700">₹{claim.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 bg-red-50 rounded-lg border border-red-200 flex justify-between items-center">
                <span className="font-bold text-red-900">Total Debit Claim Amount:</span>
                <span className="text-base font-bold text-red-700 font-mono">
                  ₹{Number(selectedPoForDebitNote.debitNoteAmount || 14400).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowDebitNoteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  showToast(`Debit note ${selectedPoForDebitNote.debitNoteNo} downloaded for ledger adjustment.`, "success");
                  setShowDebitNoteModal(false);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-700 text-white rounded-md text-xs font-semibold hover:bg-red-800 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Debit Note PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PO DOCUMENT MODAL */}
      {showPoDocModal && selectedPoForDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-teal-100 text-teal-800 font-bold text-[10px] uppercase">
                    Official Purchase Order
                  </span>
                  <h3 className="text-base font-bold text-gray-900 font-mono">
                    {selectedPoForDoc.poNumber}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  EDI Transmit Manifest · Registered Pharma Distributor
                </p>
              </div>
              <button onClick={() => setShowPoDocModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <div className="text-gray-500 text-[11px]">Supplier / Principal</div>
                  <div className="font-bold text-gray-900 mt-0.5">{selectedPoForDoc.principalName}</div>
                  <div className="text-[11px] text-gray-500">{selectedPoForDoc.depotLocation}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-[11px]">Order &amp; Delivery Schedule</div>
                  <div className="font-semibold text-gray-900 mt-0.5">Ordered: {selectedPoForDoc.orderDate}</div>
                  <div className="text-[11px] text-gray-500">Expected: {selectedPoForDoc.expectedDate}</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-2">Ordered Formulation Lines</h4>
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-semibold">
                      <tr>
                        <th className="py-2 px-3">Product Name</th>
                        <th className="py-2 px-3">Pack</th>
                        <th className="py-2 px-3">Ordered Qty</th>
                        <th className="py-2 px-3">Free Scheme</th>
                        <th className="py-2 px-3">Contract PTS</th>
                        <th className="py-2 px-3 text-right">Line Total (PTS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {selectedPoForDoc.items.map((item, idx) => {
                        const lineTotal = item.orderedQty * item.ptsPrice;
                        return (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-sans font-semibold text-gray-900">{item.name}</td>
                            <td className="py-2 px-3 text-gray-600">{item.pack}</td>
                            <td className="py-2 px-3 font-bold text-gray-800">{item.orderedQty}</td>
                            <td className="py-2 px-3 text-emerald-700">+{item.freeQty} free</td>
                            <td className="py-2 px-3">₹{item.ptsPrice.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-bold text-gray-900">₹{lineTotal.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center font-mono">
                <div>
                  <div className="text-[11px] text-gray-500 font-sans">Scheme Slab: {selectedPoForDoc.schemeSlab || "Standard"}</div>
                  <div className="text-[11px] text-emerald-700 font-sans font-semibold">
                    Free Goods Value: ₹{(selectedPoForDoc.freeGoodsValue || 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase font-sans font-semibold">Total Order Value (PTS)</div>
                  <div className="text-lg font-bold text-gray-900">₹{selectedPoForDoc.totalPts.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowPoDocModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  showToast(`Purchase Order ${selectedPoForDoc.poNumber} sent to printer.`, "info");
                  window.print();
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print PO Manifest</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* C&F E-INVOICE IMPORT MODAL */}
      {showEInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900">Import C&amp;F e-Invoice (SFTP/EDI)</h3>
                <p className="text-xs text-gray-500">Paste or drop NIC e-Invoice JSON payload for instant automated GRN inwarding</p>
              </div>
              <button onClick={() => setShowEInvoiceModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">e-Invoice JSON Payload</label>
                <textarea
                  rows={6}
                  value={eInvoiceJson}
                  onChange={(e) => setEInvoiceJson(e.target.value)}
                  placeholder={`{\n  "SupplierGstin": "27AABCG1234F1Z5",\n  "InvoiceNo": "INV-CF-9081",\n  "Irn": "67b93a8912e...",\n  "ItemList": [{ "Name": "Amoxicillin 625", "Qty": 1000, "Batch": "B912" }]\n}`}
                  className="w-full border border-gray-300 rounded-md p-2.5 font-mono text-[11px] focus:ring-1 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px]">
                <strong>Automated Inwarding Engine:</strong> Parsing this e-invoice will verify barcode batches, check GSTIN authenticity, compare PTS against PO contract, and prepare the GRN.
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowEInvoiceModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEInvoiceModal(false);
                  showToast("C&F e-Invoice validated and imported. PO-2026-9041 updated with GRN preview.", "success");
                }}
                className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm"
              >
                Parse &amp; Inward e-Invoice
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
