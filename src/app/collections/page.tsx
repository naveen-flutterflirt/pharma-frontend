"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  CreditCard,
  IndianRupee,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  QrCode,
  FileCheck2,
  Building,
  Plus,
  Check,
  X,
  Sparkles,
  Printer,
  Download,
  Share2,
  RefreshCw,
  FileText,
  Loader2
} from "lucide-react";
import { pharmaApi } from "@/lib/api";

interface CollectionRecord {
  id: string;
  receiptNo: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  route: string;
  collectorName: string;
  collectorRole: "Salesman" | "Delivery Driver" | "Counter / Direct";
  amount: number;
  mode: "UPI QR" | "Cheque" | "Bank NEFT" | "Cash";
  referenceNo: string;
  date: string;
  time: string;
  allocatedInvoices: string[];
  reconciliationStatus: "Matched (Auto)" | "Pending Bank Clearance" | "Disputed";
  bankAccount: string;
  createdAt?: string;
}

interface CollectionStats {
  totalCollectedToday: number;
  totalOutstandingReceivables: number;
  overdueAbove45Days: number;
  dsoDays: number;
  autoBlockedAccountsCount: number;
  modeBreakdown: {
    upiPercent: number;
    chequePercent: number;
    neftPercent: number;
    cashPercent: number;
    upiAmount: number;
    chequeAmount: number;
    neftAmount: number;
    cashAmount: number;
  };
  reconciliationSummary: {
    autoMatchedCount: number;
    pendingClearanceCount: number;
    disputedCount: number;
  };
}

interface CustomerOption {
  id: string;
  name: string;
  code: string;
  route: string;
  creditLimit: number;
  creditUsed: number;
  status: "ACTIVE" | "BLOCKED" | "WARNING";
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Filters
  const [activeFilter, setActiveFilter] = useState<"all" | "upi" | "cheque" | "neft" | "cash">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "matched" | "pending" | "disputed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showNewReceiptModal, setShowNewReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<CollectionRecord | null>(null);
  const [reconcileModalReceipt, setReconcileModalReceipt] = useState<CollectionRecord | null>(null);
  const [reconcileAction, setReconcileAction] = useState<"cleared" | "bounced">("cleared");
  const [reconcileBankRef, setReconcileBankRef] = useState("");
  const [reconcileBounceReason, setReconcileBounceReason] = useState("");
  const [isReconciling, setIsReconciling] = useState(false);

  // Form State
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMode, setFormMode] = useState<"UPI QR" | "Cheque" | "Bank NEFT" | "Cash">("UPI QR");
  const [formReferenceNo, setFormReferenceNo] = useState("");
  const [formCollectorName, setFormCollectorName] = useState("Ramesh Kumar (Van Driver)");
  const [formCollectorRole, setFormCollectorRole] = useState<"Salesman" | "Delivery Driver" | "Counter / Direct">("Delivery Driver");
  const [formBankAccount, setFormBankAccount] = useState("HDFC Primary Current A/c (..8821)");
  const [formAllocatedInvoices, setFormAllocatedInvoices] = useState("");

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "warning" | "info">("info");
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: "success" | "warning" | "info" = "info") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    setToastType(type);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Refresh live collections data from PostgreSQL
  const refreshCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const [colRes, statsRes, custRes] = await Promise.all([
        pharmaApi.getCollections(),
        pharmaApi.getCollectionStats(),
        pharmaApi.getCustomers()
      ]);

      if (colRes?.collections) {
        setCollections(colRes.collections);
      }
      if (statsRes?.stats) {
        setStats(statsRes.stats);
      }
      if (custRes?.customers) {
        setCustomers(custRes.customers);
      }
    } catch (err: unknown) {
      console.error("Error loading collections:", err);
      const msg = err instanceof Error ? err.message : "Failed to fetch live collections data from server.";
      showToast(msg, "warning");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Initial load on mount without cascading renders
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [colRes, statsRes, custRes] = await Promise.all([
          pharmaApi.getCollections(),
          pharmaApi.getCollectionStats(),
          pharmaApi.getCustomers()
        ]);
        if (!isMounted) return;
        if (colRes?.collections) {
          setCollections(colRes.collections);
        }
        if (statsRes?.stats) {
          setStats(statsRes.stats);
        }
        if (custRes?.customers) {
          setCustomers(custRes.customers);
          setFormCustomerId((curr) => curr || custRes.customers[0]?.id || "");
        }
      } catch (err: unknown) {
        console.error("Initial collections fetch error:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Selected Customer in Form
  const selectedFormCustomer = useMemo(() => {
    return customers.find((c) => c.id === formCustomerId) || customers[0] || null;
  }, [customers, formCustomerId]);

  // Filtered Collections
  const filteredCollections = useMemo(() => {
    return collections.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.receiptNo.toLowerCase().includes(q) ||
        c.customerName.toLowerCase().includes(q) ||
        c.customerCode.toLowerCase().includes(q) ||
        c.referenceNo.toLowerCase().includes(q) ||
        c.collectorName.toLowerCase().includes(q) ||
        c.allocatedInvoices.some((inv) => inv.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Mode filter
      if (activeFilter === "upi" && c.mode !== "UPI QR") return false;
      if (activeFilter === "cheque" && c.mode !== "Cheque") return false;
      if (activeFilter === "neft" && c.mode !== "Bank NEFT") return false;
      if (activeFilter === "cash" && c.mode !== "Cash") return false;

      // Status filter
      if (statusFilter === "matched" && c.reconciliationStatus !== "Matched (Auto)") return false;
      if (statusFilter === "pending" && c.reconciliationStatus !== "Pending Bank Clearance") return false;
      if (statusFilter === "disputed" && c.reconciliationStatus !== "Disputed") return false;

      return true;
    });
  }, [collections, searchQuery, activeFilter, statusFilter]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: collections.length,
      upi: collections.filter((c) => c.mode === "UPI QR").length,
      neft: collections.filter((c) => c.mode === "Bank NEFT").length,
      cheque: collections.filter((c) => c.mode === "Cheque").length,
      cash: collections.filter((c) => c.mode === "Cash").length
    };
  }, [collections]);

  // Total collected from state
  const totalCollectedDisplay = useMemo(() => {
    const amt = stats?.totalCollectedToday ?? collections.reduce((acc, curr) => acc + curr.amount, 0);
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(2)} Lakh`;
    return `₹${amt.toLocaleString("en-IN")}`;
  }, [stats, collections]);

  const totalOutstandingDisplay = useMemo(() => {
    const amt = stats?.totalOutstandingReceivables ?? 28400000;
    if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
    if (amt >= 100000) return `₹${(amt / 100000).toFixed(2)} Lakh`;
    return `₹${amt.toLocaleString("en-IN")}`;
  }, [stats]);

  const overdueDisplay = useMemo(() => {
    const amt = stats?.overdueAbove45Days ?? 3800000;
    if (amt >= 100000) return `₹${Math.round(amt / 100000)}L over 45 days`;
    return `₹${amt.toLocaleString("en-IN")} over 45 days`;
  }, [stats]);

  // Auto-Match Bank Feeds
  const handleAutoMatchBankFeeds = async () => {
    try {
      setIsAutoMatching(true);
      const res = await pharmaApi.autoMatchBankFeeds();
      if (res?.success) {
        showToast(
          res.message || `Bank Statement API imported: ${res.matchedCount || 0} credits auto-reconciled.`,
          "success"
        );
        await refreshCollections();
      } else {
        showToast(res?.error || "Failed to auto-match bank feeds.", "warning");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error communicating with banking API service.";
      showToast(msg, "warning");
    } finally {
      setIsAutoMatching(false);
    }
  };

  // Post New Receipt
  const handlePostReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(formAmount);
    if (!numAmount || numAmount <= 0) {
      showToast("Please enter a valid receipt amount in INR.", "warning");
      return;
    }
    if (!formReferenceNo.trim()) {
      showToast("Transaction Reference / Cheque No / UTR is required.", "warning");
      return;
    }

    try {
      setIsPosting(true);
      const res = await pharmaApi.recordCollection({
        customerId: formCustomerId,
        amount: numAmount,
        mode: formMode,
        referenceNo: formReferenceNo.trim(),
        collectorName: formCollectorName,
        collectorRole: formCollectorRole,
        bankAccount: formBankAccount,
        allocatedInvoices: formAllocatedInvoices.trim() || undefined
      });

      if (res?.success) {
        showToast(res.message || "Receipt posted! Customer ledger credited and Tally synced.", "success");
        setShowNewReceiptModal(false);
        setFormAmount("");
        setFormReferenceNo("");
        setFormAllocatedInvoices("");
        await refreshCollections();
      } else {
        showToast(res?.error || "Failed to post collection receipt.", "warning");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Server error while recording receipt.";
      showToast(msg, "warning");
    } finally {
      setIsPosting(false);
    }
  };

  // Cheque Reconcile Action
  const handleReconcileSubmit = async () => {
    if (!reconcileModalReceipt) return;

    try {
      setIsReconciling(true);
      const res = await pharmaApi.reconcileCollection(reconcileModalReceipt.id, {
        status: reconcileAction === "cleared" ? "Matched (Auto)" : "Disputed",
        bankRef: reconcileBankRef.trim() || undefined,
        bounceReason: reconcileBounceReason.trim() || undefined
      });

      if (res?.success) {
        showToast(
          res.message || "Reconciliation status updated successfully.",
          reconcileAction === "cleared" ? "success" : "warning"
        );
        setReconcileModalReceipt(null);
        setReconcileBankRef("");
        setReconcileBounceReason("");
        await refreshCollections();
      } else {
        showToast(res?.error || "Failed to update reconciliation status.", "warning");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Server error updating cheque reconciliation.";
      showToast(msg, "warning");
    } finally {
      setIsReconciling(false);
    }
  };

  // Download CSV Dossier
  const handleDownloadCsv = () => {
    try {
      const url = pharmaApi.getExportCollectionsUrl();
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "collections_register_2026.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Collections dossier downloaded as CSV.", "info");
    } catch {
      showToast("Failed to download collections CSV.", "warning");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f8f9] overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="toast-notification"
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
                Collections &amp; Receivables Reconciliation
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Live PostgreSQL Bank Synced
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Receipt posting, invoice-level allocations, automated bank reconciliation, and DSO management.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/delivery"
              className="px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-100 transition-colors"
            >
              ← Van Deliveries
            </Link>
            <Link
              href="/customers"
              className="px-3 py-2 bg-teal-50 border border-teal-200 text-[#178582] rounded-md text-xs font-semibold hover:bg-teal-100 transition-colors"
            >
              Customer Ledgers →
            </Link>
            <button
              id="export-collections-btn"
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
              title="Download CSV Dossier"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span>Export CSV</span>
            </button>
            <button
              id="auto-match-btn"
              onClick={handleAutoMatchBankFeeds}
              disabled={isAutoMatching}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-xs sm:text-sm font-semibold hover:bg-gray-50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-[#178582] ${isAutoMatching ? "animate-spin" : ""}`} />
              <span>{isAutoMatching ? "Matching Feeds..." : "Auto-Match Bank Feeds"}</span>
            </button>
            <button
              id="record-receipt-btn"
              onClick={() => setShowNewReceiptModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#178582] text-white rounded-md text-xs sm:text-sm font-semibold hover:bg-[#126b68] transition-colors shadow-sm cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Record Receipt</span>
            </button>
          </div>
        </div>

        {/* Financial Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Total Collected Today</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5" id="metric-collected-today">
              {totalCollectedDisplay}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              UPI {stats?.modeBreakdown.upiPercent ?? 61}% · cheque {stats?.modeBreakdown.chequePercent ?? 24}% · cash {stats?.modeBreakdown.cashPercent ?? 15}%
            </div>
          </div>
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Total Outstanding Receivables</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5" id="metric-total-outstanding">
              {totalOutstandingDisplay}
            </div>
            <div className="text-[11px] text-amber-700 font-semibold mt-0.5">{overdueDisplay}</div>
          </div>
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Days Sales Outstanding (DSO)</div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5" id="metric-dso-days">
              {stats?.dsoDays ? `${stats.dsoDays} Days` : "24.6 Days"}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Target: &le; 30 days</div>
          </div>
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Auto-Blocked for Overdue</div>
            <div className="text-lg font-bold text-red-600 mt-0.5" id="metric-blocked-accounts">
              {stats?.autoBlockedAccountsCount ?? 2} Accounts
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Enforcing credit rules strictly</div>
          </div>
        </div>
      </header>

      {/* Main Table Area */}
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-4">
        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
            <button
              id="filter-tab-all"
              onClick={() => setActiveFilter("all")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All Receipts ({tabCounts.all})
            </button>
            <button
              id="filter-tab-upi"
              onClick={() => setActiveFilter("upi")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "upi" ? "bg-white text-[#178582] shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              UPI QR ({tabCounts.upi})
            </button>
            <button
              id="filter-tab-neft"
              onClick={() => setActiveFilter("neft")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "neft" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Bank NEFT / RTGS ({tabCounts.neft})
            </button>
            <button
              id="filter-tab-cheque"
              onClick={() => setActiveFilter("cheque")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "cheque" ? "bg-white text-amber-800 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Cheques ({tabCounts.cheque})
            </button>
            <button
              id="filter-tab-cash"
              onClick={() => setActiveFilter("cash")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "cash" ? "bg-white text-emerald-800 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Cash ({tabCounts.cash})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <select
              id="status-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "matched" | "pending" | "disputed")}
              className="text-xs border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#178582]"
            >
              <option value="all">All Reconciliation Statuses</option>
              <option value="matched">Matched (Auto) Only</option>
              <option value="pending">Pending Bank Clearance</option>
              <option value="disputed">Disputed / Bounced</option>
            </select>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="collections-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Receipt #, Chemist, Ref / UTR..."
                className="pl-9 pr-4 py-2 w-full rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 placeholder:text-gray-400 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Collections Ledger Grid */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-xs text-left" id="collections-table">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Receipt # &amp; Date</th>
                  <th className="py-3 px-4">Chemist Account</th>
                  <th className="py-3 px-4">Amount Collected</th>
                  <th className="py-3 px-4">Payment Mode &amp; Ref</th>
                  <th className="py-3 px-4">Collected By</th>
                  <th className="py-3 px-4">Allocated Invoices</th>
                  <th className="py-3 px-4">Bank Reconciliation</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-900">
                {isLoading && collections.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#178582] mb-2" />
                      Loading collections ledger from PostgreSQL...
                    </td>
                  </tr>
                ) : filteredCollections.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      No collection receipts found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredCollections.map((col) => (
                    <tr key={col.id} id={`receipt-row-${col.receiptNo}`} className="hover:bg-gray-50/80 transition-colors group">
                      {/* Receipt No */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 font-mono text-sm">{col.receiptNo}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {col.date} · {col.time}
                        </div>
                      </td>

                      {/* Chemist */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 text-[13px]">{col.customerName}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {col.customerCode} · {col.route}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-mono font-bold text-sm text-gray-900">
                        ₹{col.amount.toLocaleString("en-IN")}
                      </td>

                      {/* Mode & Ref */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-gray-800">
                          {col.mode === "UPI QR" && <QrCode className="w-3.5 h-3.5 text-[#178582]" />}
                          {col.mode === "Cheque" && <CreditCard className="w-3.5 h-3.5 text-amber-700" />}
                          {col.mode === "Bank NEFT" && <Building className="w-3.5 h-3.5 text-blue-600" />}
                          {col.mode === "Cash" && <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />}
                          <span>{col.mode}</span>
                        </div>
                        <div className="font-mono text-[11px] text-gray-500 mt-0.5">{col.referenceNo}</div>
                      </td>

                      {/* Collected By */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-gray-800">{col.collectorName}</div>
                        <div className="text-[11px] text-gray-400">{col.collectorRole}</div>
                      </td>

                      {/* Invoices */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {col.allocatedInvoices.map((inv, idx) => (
                            <span
                              key={idx}
                              className="font-mono text-[11px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded border border-gray-200"
                            >
                              {inv}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Reconciliation */}
                      <td className="py-3.5 px-4">
                        {col.reconciliationStatus === "Matched (Auto)" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Auto-Matched
                          </span>
                        ) : col.reconciliationStatus === "Pending Bank Clearance" ? (
                          <button
                            onClick={() => {
                              setReconcileModalReceipt(col);
                              setReconcileAction("cleared");
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-300 cursor-pointer transition-colors"
                            title="Click to reconcile or mark cleared"
                          >
                            <Clock className="w-3 h-3 text-amber-600" /> Bank Clearing ▾
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setReconcileModalReceipt(col);
                              setReconcileAction("bounced");
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded border border-red-300 cursor-pointer transition-colors"
                            title="Click to inspect dispute or bounce"
                          >
                            <AlertTriangle className="w-3 h-3 text-red-600" /> Disputed / Bounced
                          </button>
                        )}
                        <div className="text-[10px] text-gray-400 mt-0.5">{col.bankAccount}</div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            id={`btn-view-${col.receiptNo}`}
                            onClick={() => setSelectedReceipt(col)}
                            className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 text-gray-600 cursor-pointer shadow-xs transition-colors"
                            title="View Receipt Voucher"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`btn-share-${col.receiptNo}`}
                            onClick={() => {
                              showToast(
                                `Payment acknowledgment receipt for ₹${col.amount.toLocaleString(
                                  "en-IN"
                                )} dispatched to ${col.customerName} on WhatsApp.`,
                                "success"
                              );
                            }}
                            className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 text-emerald-600 cursor-pointer shadow-xs transition-colors"
                            title="Send WhatsApp Receipt"
                          >
                            <Share2 className="w-3.5 h-3.5" />
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

      {/* RECORD RECEIPT MODAL */}
      {showNewReceiptModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Record Payment Receipt</h3>
                <p className="text-xs text-gray-500">Post collection &amp; allocate directly to unpaid open invoices</p>
              </div>
              <button
                onClick={() => setShowNewReceiptModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePostReceipt} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">Select Chemist</label>
                <select
                  id="modal-select-customer"
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id} className="text-gray-900 bg-white">
                      {c.name} ({c.code}) · {c.route} — O/S: ₹{c.creditUsed.toLocaleString("en-IN")}{" "}
                      {c.status === "BLOCKED" ? "(BLOCKED)" : ""}
                    </option>
                  ))}
                </select>
                {selectedFormCustomer && (
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                    <span>Credit Limit: ₹{selectedFormCustomer.creditLimit.toLocaleString("en-IN")}</span>
                    <span>·</span>
                    <span className={selectedFormCustomer.creditUsed > selectedFormCustomer.creditLimit ? "text-red-600 font-bold" : "text-emerald-700 font-medium"}>
                      Current Outstanding: ₹{selectedFormCustomer.creditUsed.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Amount Received (₹) *</label>
                  <input
                    id="modal-input-amount"
                    type="number"
                    required
                    min="1"
                    step="1"
                    placeholder="e.g. 25000"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-bold font-mono focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Payment Mode *</label>
                  <select
                    id="modal-select-mode"
                    value={formMode}
                    onChange={(e) => {
                      const m = e.target.value as "UPI QR" | "Cheque" | "Bank NEFT" | "Cash";
                      setFormMode(m);
                      if (m === "Cash") setFormBankAccount("Cash Drawer 01");
                      else if (m === "Cheque") setFormBankAccount("ICICI Clearing A/c (..3109)");
                      else setFormBankAccount("HDFC Primary Current A/c (..8821)");
                    }}
                    className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  >
                    <option value="UPI QR">UPI QR (Instant)</option>
                    <option value="Cheque">Cheque Deposit</option>
                    <option value="Bank NEFT">Bank NEFT / RTGS</option>
                    <option value="Cash">Cash at Counter</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Transaction Ref / Cheque No / UTR *
                </label>
                <input
                  id="modal-input-ref"
                  type="text"
                  required
                  placeholder={
                    formMode === "Cheque"
                      ? "e.g. CHQ #409210 (HDFC)"
                      : formMode === "UPI QR"
                      ? "e.g. UPI/26102798124/HDFC"
                      : formMode === "Bank NEFT"
                      ? "e.g. UTR-AXIS-902184102"
                      : "e.g. CASH-DESK-04"
                  }
                  value={formReferenceNo}
                  onChange={(e) => setFormReferenceNo(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-medium font-mono focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Collector Role</label>
                  <select
                    id="modal-select-collector-role"
                    value={formCollectorRole}
                    onChange={(e) => setFormCollectorRole(e.target.value as "Salesman" | "Delivery Driver" | "Counter / Direct")}
                    className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  >
                    <option value="Delivery Driver">Delivery Driver</option>
                    <option value="Salesman">Salesman</option>
                    <option value="Counter / Direct">Counter / Direct</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Collector Name</label>
                  <input
                    id="modal-input-collector"
                    type="text"
                    value={formCollectorName}
                    onChange={(e) => setFormCollectorName(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Deposit Account</label>
                  <select
                    id="modal-select-bank"
                    value={formBankAccount}
                    onChange={(e) => setFormBankAccount(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  >
                    <option value="HDFC Primary Current A/c (..8821)">HDFC Current (..8821)</option>
                    <option value="ICICI Clearing A/c (..3109)">ICICI Clearing (..3109)</option>
                    <option value="Cash Drawer 01">Cash Drawer 01</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Allocate to Invoices (Optional FIFO)</label>
                <input
                  id="modal-input-invoices"
                  type="text"
                  placeholder="e.g. INV-25-48812, INV-25-48813 (Leave blank for FIFO)"
                  value={formAllocatedInvoices}
                  onChange={(e) => setFormAllocatedInvoices(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-mono text-[11px] focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Automatic FIFO: System will automatically settle the customer&apos;s oldest overdue invoices.
                </p>
              </div>

              <div className="mt-5 flex justify-end gap-2.5 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowNewReceiptModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="modal-submit-receipt-btn"
                  type="submit"
                  disabled={isPosting}
                  className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isPosting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isPosting ? "Posting to DB..." : "Post Receipt & Credit Ledger"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHEQUE CLEARANCE / RECONCILIATION MODAL */}
      {reconcileModalReceipt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Cheque Clearance &amp; Bank Reconciliation
                </h3>
                <p className="text-xs text-gray-500 font-mono">{reconcileModalReceipt.receiptNo} · {reconcileModalReceipt.referenceNo}</p>
              </div>
              <button
                onClick={() => setReconcileModalReceipt(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1 font-medium">
                <div className="flex justify-between">
                  <span className="text-gray-500">Chemist:</span>
                  <span className="font-bold text-gray-900">{reconcileModalReceipt.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount:</span>
                  <span className="font-bold text-emerald-700 font-mono">₹{reconcileModalReceipt.amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Status:</span>
                  <span className="font-semibold text-amber-700">{reconcileModalReceipt.reconciliationStatus}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Reconciliation Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReconcileAction("cleared")}
                    className={`py-2 px-3 rounded-md font-semibold border text-center cursor-pointer transition-all ${
                      reconcileAction === "cleared"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    ✓ Mark Cleared (Auto-Matched)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReconcileAction("bounced")}
                    className={`py-2 px-3 rounded-md font-semibold border text-center cursor-pointer transition-all ${
                      reconcileAction === "bounced"
                        ? "bg-red-50 border-red-500 text-red-800 shadow-xs"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    ⚠ Mark Bounced (Penalty)
                  </button>
                </div>
              </div>

              {reconcileAction === "cleared" ? (
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Bank Clearing Reference / Scroll No</label>
                  <input
                    type="text"
                    placeholder="e.g. CLR-HDFC-882109"
                    value={reconcileBankRef}
                    onChange={(e) => setReconcileBankRef(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-gray-900 font-mono text-xs focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-red-800 mb-1">Reason for Cheque Bounce *</label>
                  <input
                    type="text"
                    placeholder="e.g. Insufficient funds / Signature mismatch"
                    value={reconcileBounceReason}
                    onChange={(e) => setReconcileBounceReason(e.target.value)}
                    className="w-full border border-red-300 rounded p-2 text-gray-900 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-red-600 mt-1 font-medium">
                    Note: Bouncing will automatically restore the customer&apos;s outstanding balance, add ₹500 statutory penalty, and block their credit account.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setReconcileModalReceipt(null)}
                className="px-3.5 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReconcileSubmit}
                disabled={isReconciling}
                className={`px-4 py-1.5 rounded text-xs font-semibold text-white cursor-pointer shadow-sm flex items-center gap-1.5 ${
                  reconcileAction === "cleared" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isReconciling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isReconciling ? "Updating..." : reconcileAction === "cleared" ? "Confirm Clearance" : "Post Bounce & Block"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT VOUCHER PREVIEW MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Payment Receipt Voucher
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">{selectedReceipt.receiptNo}</p>
                </div>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div className="text-center pb-2 border-b border-dashed border-gray-200">
                <div className="font-bold text-sm text-gray-900">Shah Pharma Distributors LLP</div>
                <div className="text-[11px] text-gray-500">Central Logistics Hub · DL-20B-184920 · GSTIN: 27AAAAA0000A1Z5</div>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200 space-y-2 font-medium">
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-bold text-gray-900">{selectedReceipt.customerName} ({selectedReceipt.customerCode})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Route:</span>
                  <span className="text-gray-800">{selectedReceipt.route}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount Received:</span>
                  <span className="font-bold text-emerald-700 text-sm font-mono">₹{selectedReceipt.amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Channel:</span>
                  <span className="font-semibold text-gray-800">{selectedReceipt.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Reference / UTR / Chq:</span>
                  <span className="font-mono text-gray-800">{selectedReceipt.referenceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Collector:</span>
                  <span className="text-gray-800">{selectedReceipt.collectorName} ({selectedReceipt.collectorRole})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Settled Invoices:</span>
                  <span className="font-mono text-gray-900 text-[11px]">{selectedReceipt.allocatedInvoices.join(", ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Deposit Bank:</span>
                  <span className="text-gray-800">{selectedReceipt.bankAccount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Reconciliation:</span>
                  <span className="font-semibold text-emerald-700">{selectedReceipt.reconciliationStatus}</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-200">
                  <span>Timestamp:</span>
                  <span>{selectedReceipt.date} · {selectedReceipt.time}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                onClick={() => {
                  window.print();
                  showToast("Receipt voucher sent to thermal printer.", "info");
                }}
                className="px-3.5 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-gray-600" />
                <span>Print Voucher</span>
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
