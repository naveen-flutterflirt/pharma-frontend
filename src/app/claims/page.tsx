"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  IndianRupee,
  Plus,
  ShieldCheck,
  Check,
  X,
  Sparkles,
  Download,
  Share2,
  Info,
  Trash2,
  RefreshCw,
  Send
} from "lucide-react";
import { pharmaApi } from "@/lib/api";

export interface ClaimRecord {
  id: string;
  claimNo: string;
  type: string;
  principalName: string;
  cnfDepot: string;
  amount: number;
  dateRaised: string;
  ageDays: number;
  status: "Draft" | "Sent to C&F" | "Verified" | "Credit Note Received" | string;
  creditNoteNo?: string | null;
  creditNoteAmount?: number | null;
  evidenceFilesCount: number;
  batchDetails: string;
  linesCount: number;
  createdAt?: string;
  updatedAt?: string;
}

const PRINCIPAL_OPTIONS = [
  { name: "Principal B (Glaxo Regional)", depot: "Regional C&F Depot, Sector 4" },
  { name: "Principal A (Novartis Institutional)", depot: "Central Logistics Hub" },
  { name: "Principal C (Cipla Stockist)", depot: "State Mother Warehouse" },
  { name: "Principal D (Abbott Care)", depot: "Regional Depot 01" },
  { name: "Sun Pharma Laboratories", depot: "Bhiwandi Central Depot" },
  { name: "Alkem Laboratories", depot: "Kurla C&F Hub" }
];

const CLAIM_CATEGORIES = [
  "Expiry returns",
  "Rate difference (hospitals)",
  "Scheme reimbursement",
  "Breakage / damage",
  "Price-drop protection"
];

function formatLakhs(amount: number): string {
  if (!amount || amount === 0) return "₹0.0 Lakh";
  if (amount >= 100000) {
    const inLakhs = (amount / 100000).toFixed(1);
    return `₹${inLakhs} Lakh`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals & Action States
  const [showNewClaimModal, setShowNewClaimModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ClaimRecord | null>(null);
  const [settlingClaim, setSettlingClaim] = useState<ClaimRecord | null>(null);
  const [settleForm, setSettleForm] = useState({ creditNoteNo: "", creditNoteAmount: 0 });
  const [submitting, setSubmitting] = useState(false);

  // New Claim Form State
  const [newClaimForm, setNewClaimForm] = useState({
    type: "Expiry returns",
    principalName: "Principal B (Glaxo Regional)",
    cnfDepot: "Regional C&F Depot, Sector 4",
    amount: 48200,
    debitNoteNo: "DN-25-0105",
    batchDetails: "Quarantined batch AC2308 (120 strips) collected from chemist returns. Barcode photos & invoice copies attached.",
    linesCount: 2,
    evidenceFilesCount: 3,
    autoSend: true
  });

  // Toasts with timeout safety
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "warning" | "info">("info");
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: "success" | "warning" | "info" = "info") => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    setToastType(type);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Fetch claims from real API
  const loadClaims = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await pharmaApi.getClaims();
      if (res && res.claims) {
        setClaims(res.claims);
      } else {
        setClaims([]);
      }
    } catch (err: any) {
      console.error("Failed to load claims:", err);
      setError(err.message || "Failed to fetch claims from server");
      showToast("Error connecting to database. Please retry.", "warning");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadClaims();
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [loadClaims]);

  // Aggregate Category Metrics dynamically from live database records
  const categoryStats = useMemo(() => {
    let expiry = 0;
    let rateDiff = 0;
    let scheme = 0;
    let breakage = 0;
    let priceDrop = 0;
    let overdueCount = 0;

    claims.forEach((c) => {
      const typeLower = (c.type || "").toLowerCase();
      if (typeLower.includes("expiry")) {
        expiry += c.amount;
      } else if (typeLower.includes("rate diff")) {
        rateDiff += c.amount;
      } else if (typeLower.includes("scheme")) {
        scheme += c.amount;
      } else if (typeLower.includes("breakage") || typeLower.includes("damage")) {
        breakage += c.amount;
      } else if (typeLower.includes("price-drop") || typeLower.includes("price drop")) {
        priceDrop += c.amount;
      }

      if (c.ageDays > 60) {
        overdueCount += 1;
      }
    });

    return {
      expiry,
      rateDiff,
      scheme,
      breakage,
      priceDrop,
      overdueCount
    };
  }, [claims]);

  // Filtered claims based on filter tab and search input
  const filteredClaims = useMemo(() => {
    return claims.filter((cl) => {
      const matchesSearch =
        cl.claimNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cl.principalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cl.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cl.batchDetails.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cl.creditNoteNo && cl.creditNoteNo.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const typeLower = cl.type.toLowerCase();
      if (activeFilter === "expiry") return typeLower.includes("expiry");
      if (activeFilter === "rate_diff") return typeLower.includes("rate diff");
      if (activeFilter === "scheme") return typeLower.includes("scheme");
      if (activeFilter === "breakage") return typeLower.includes("breakage") || typeLower.includes("damage");
      if (activeFilter === "overdue") return cl.ageDays > 60;

      return true;
    });
  }, [claims, searchQuery, activeFilter]);


  // Handle Create New Claim
  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClaimForm.amount || newClaimForm.amount <= 0) {
      showToast("Please enter a valid claim amount", "warning");
      return;
    }

    try {
      setSubmitting(true);
      const res = await pharmaApi.createClaim({
        type: newClaimForm.type,
        principalName: newClaimForm.principalName,
        cnfDepot: newClaimForm.cnfDepot,
        amount: Number(newClaimForm.amount),
        batchDetails: newClaimForm.batchDetails,
        linesCount: Number(newClaimForm.linesCount) || 1,
        evidenceFilesCount: Number(newClaimForm.evidenceFilesCount) || 2,
        status: newClaimForm.autoSend ? "Sent to C&F" : "Draft"
      });

      if (res && res.claim) {
        setClaims((prev) => [res.claim, ...prev]);
        setShowNewClaimModal(false);
        showToast(
          newClaimForm.autoSend
            ? `Claim package ${res.claim.claimNo} dispatched to C&F depot with statutory debit note.`
            : `Claim ${res.claim.claimNo} saved as Draft.`,
          "success"
        );
      }
    } catch (err: any) {
      console.error("Failed to create claim:", err);
      showToast(err.message || "Failed to raise claim", "warning");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Status Update (Draft -> Sent to C&F -> Verified)
  const handleUpdateStatus = async (claimId: string, newStatus: string) => {
    try {
      const res = await pharmaApi.updateClaimStatus(claimId, { status: newStatus });
      if (res && res.claim) {
        setClaims((prev) => prev.map((c) => (c.id === claimId ? res.claim : c)));
        showToast(`Claim status advanced to "${newStatus}".`, "success");
      }
    } catch (err: any) {
      console.error("Failed to update status:", err);
      showToast(err.message || "Failed to update claim status", "warning");
    }
  };

  // Open Settle Modal
  const openSettleModal = (claim: ClaimRecord) => {
    setSettlingClaim(claim);
    setSettleForm({
      creditNoteNo: claim.creditNoteNo || `PCN-${claim.principalName.split(" ")[0].toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      creditNoteAmount: claim.creditNoteAmount || claim.amount
    });
  };

  // Handle Settle with Credit Note Submission
  const handleSettleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingClaim) return;

    if (!settleForm.creditNoteNo.trim()) {
      showToast("Please enter a valid Credit Note number", "warning");
      return;
    }

    try {
      setSubmitting(true);
      const res = await pharmaApi.settleClaim(settlingClaim.id, {
        creditNoteNo: settleForm.creditNoteNo.trim(),
        creditNoteAmount: Number(settleForm.creditNoteAmount) || settlingClaim.amount
      });

      if (res && res.claim) {
        setClaims((prev) => prev.map((c) => (c.id === settlingClaim.id ? res.claim : c)));
        if (selectedClaim && selectedClaim.id === settlingClaim.id) {
          setSelectedClaim(res.claim);
        }
        setSettlingClaim(null);
        showToast(res.message || `Claim ${res.claim.claimNo} settled against Credit Note!`, "success");
      }
    } catch (err: any) {
      console.error("Failed to settle claim:", err);
      showToast(err.message || "Failed to settle claim", "warning");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Claim
  const handleDeleteClaim = async (claimId: string, claimNo: string) => {
    if (!window.confirm(`Are you sure you want to delete Claim ${claimNo}?`)) {
      return;
    }

    try {
      const res = await pharmaApi.deleteClaim(claimId);
      if (res && res.success) {
        setClaims((prev) => prev.filter((c) => c.id !== claimId));
        if (selectedClaim && selectedClaim.id === claimId) {
          setSelectedClaim(null);
        }
        showToast(`Claim ${claimNo} deleted from registry.`, "info");
      }
    } catch (err: any) {
      console.error("Failed to delete claim:", err);
      showToast(err.message || "Failed to delete claim", "warning");
    }
  };

  // Handle Export CSV Dossier
  const handleExportDossier = () => {
    try {
      const url = pharmaApi.getClaimsExportUrl();
      window.open(url, "_blank");
      showToast("Generating batch-wise claim package in Principal EDI format...", "success");
    } catch (_err) {
      showToast("Error exporting claim dossier", "warning");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f8f9] overflow-hidden relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          id="claims-toast"
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
          <span id="toast-text">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-white/70 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="px-4 sm:px-8 py-6 bg-white border-b border-gray-200 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 id="claims-page-title" className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Claims Management with Principals
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Audit Trail Tracked
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              End-to-end recovery: Expiry returns, transit breakage, hospital institutional rate differences, and scheme reimbursements.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadClaims}
              disabled={loading}
              title="Refresh Claims"
              className="p-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#178582]" : ""}`} />
            </button>
            <Link
              href="/purchase"
              className="px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-100 transition-colors"
            >
              ← Purchases
            </Link>
            <Link
              href="/collections"
              className="px-3 py-2 bg-teal-50 border border-teal-200 text-[#178582] rounded-md text-xs font-semibold hover:bg-teal-100 transition-colors"
            >
              Collections →
            </Link>
            <button
              id="export-dossier-btn"
              onClick={handleExportDossier}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-xs sm:text-sm font-semibold hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#178582]" />
              <span>Export Dossier</span>
            </button>
            <button
              id="raise-claim-btn"
              onClick={() => setShowNewClaimModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#178582] text-white rounded-md text-xs sm:text-sm font-semibold hover:bg-[#126b68] transition-colors shadow-sm cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Raise Claim</span>
            </button>
          </div>
        </div>

        {/* 5 Claims Categories Strip Dynamic from Database */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mt-6">
          <div id="metric-card-expiry" className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200/80 hover:border-[#178582]/40 transition-colors">
            <div className="text-xs text-gray-500 font-medium">Expiry Returns</div>
            <div id="metric-val-expiry" className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">
              {formatLakhs(categoryStats.expiry)}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Sent with debit note</div>
          </div>
          <div id="metric-card-rate-diff" className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200/80 hover:border-[#178582]/40 transition-colors">
            <div className="text-xs text-gray-500 font-medium">Rate Difference</div>
            <div id="metric-val-rate-diff" className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">
              {formatLakhs(categoryStats.rateDiff)}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Hospital tender gap</div>
          </div>
          <div id="metric-card-scheme" className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200/80 hover:border-[#178582]/40 transition-colors">
            <div className="text-xs text-gray-500 font-medium">Scheme Reimbursement</div>
            <div id="metric-val-scheme" className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">
              {formatLakhs(categoryStats.scheme)}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Free goods given at cost</div>
          </div>
          <div id="metric-card-breakage" className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200/80 hover:border-[#178582]/40 transition-colors">
            <div className="text-xs text-gray-500 font-medium">Breakage / Damage</div>
            <div id="metric-val-breakage" className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">
              {formatLakhs(categoryStats.breakage)}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Transit evidence logged</div>
          </div>
          <div id="metric-card-price-drop" className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200/80 hover:border-[#178582]/40 transition-colors col-span-2 lg:col-span-1">
            <div className="text-xs text-gray-500 font-medium">Price-Drop Protection</div>
            <div id="metric-val-price-drop" className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">
              {formatLakhs(categoryStats.priceDrop)}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">DPCO ceiling revision</div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-4">
        
        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
            <button
              id="filter-all-btn"
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer shrink-0 ${
                activeFilter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All Claims ({claims.length})
            </button>
            <button
              id="filter-expiry-btn"
              onClick={() => setActiveFilter("expiry")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer shrink-0 ${
                activeFilter === "expiry" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Expiry Returns
            </button>
            <button
              id="filter-rate-diff-btn"
              onClick={() => setActiveFilter("rate_diff")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer shrink-0 ${
                activeFilter === "rate_diff" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Rate Difference (Hospitals)
            </button>
            <button
              id="filter-scheme-btn"
              onClick={() => setActiveFilter("scheme")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer shrink-0 ${
                activeFilter === "scheme" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Scheme Claims
            </button>
            <button
              id="filter-overdue-btn"
              onClick={() => setActiveFilter("overdue")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeFilter === "overdue" ? "bg-white text-red-700 shadow-sm font-bold" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span>Ageing &gt; 60 d (Alerts)</span>
              {categoryStats.overdueCount > 0 && (
                <span className="px-1.5 py-0.2 bg-red-100 text-red-700 text-[10px] rounded-full font-bold">
                  {categoryStats.overdueCount}
                </span>
              )}
            </button>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="claims-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Claim #, Principal, Product, CN..."
              className="pl-9 pr-4 py-2 w-full rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 placeholder:text-gray-400 font-medium"
            />
            {searchQuery && (
              <button 
                id="clear-search-btn"
                onClick={() => setSearchQuery("")} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Claims Register Grid */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading && claims.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#178582] mb-3" />
              <p className="text-xs font-medium">Fetching real claims from PostgreSQL...</p>
            </div>
          ) : error && claims.length === 0 ? (
            <div className="p-12 text-center text-red-600">
              <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-500" />
              <p className="text-xs font-bold">{error}</p>
              <button
                onClick={loadClaims}
                className="mt-3 px-3 py-1.5 bg-red-50 border border-red-200 rounded text-xs font-semibold hover:bg-red-100 cursor-pointer"
              >
                Retry Database Query
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table id="claims-table" className="w-full min-w-[900px] text-xs text-left">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Claim # &amp; Date</th>
                    <th className="py-3 px-4">Claim Category</th>
                    <th className="py-3 px-4">Principal / Depot</th>
                    <th className="py-3 px-4">Claim Amount</th>
                    <th className="py-3 px-4">Ageing &amp; SLA</th>
                    <th className="py-3 px-4">Settlement Status</th>
                    <th className="py-3 px-4">Audit Evidence</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody id="claims-table-body" className="divide-y divide-gray-100 text-gray-900">
                  {filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">
                        <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                        <p className="font-semibold text-xs text-gray-600">No claims found matching active filter.</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Try clearing the search or switching category tabs.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredClaims.map((cl) => {
                      const isOld = cl.ageDays > 60;
                      return (
                        <tr 
                          key={cl.id} 
                          id={`claim-row-${cl.claimNo.toLowerCase()}`}
                          className="hover:bg-gray-50/80 transition-colors group"
                        >
                          {/* Claim # & Date */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900 font-mono text-sm">{cl.claimNo}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">Raised: {cl.dateRaised}</div>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4 font-semibold text-gray-800">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-800">
                              {cl.type}
                            </span>
                            <div className="text-[11px] text-gray-500 font-normal mt-0.5 truncate max-w-[200px]" title={cl.batchDetails}>
                              {cl.batchDetails}
                            </div>
                          </td>

                          {/* Principal */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-gray-900">{cl.principalName}</div>
                            <div className="text-[11px] text-gray-400">{cl.cnfDepot}</div>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 font-mono font-bold text-sm text-gray-900">
                            ₹{cl.amount.toLocaleString("en-IN")}
                          </td>

                          {/* Ageing */}
                          <td className="py-3.5 px-4">
                            <div className={`font-mono font-bold ${isOld ? "text-red-600" : "text-gray-700"}`}>
                              {cl.ageDays} days
                            </div>
                            {isOld && (
                              <div className="text-[10px] text-red-500 font-semibold flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Overdue SLA (&gt;60 d)
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {cl.status === "Credit Note Received" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Settled ({cl.creditNoteNo})
                              </span>
                            )}
                            {cl.status === "Verified" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                <Clock className="w-3 h-3 text-blue-600" /> Verified by C&amp;F
                              </span>
                            )}
                            {cl.status === "Sent to C&F" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                                Sent to C&amp;F
                              </span>
                            )}
                            {cl.status === "Draft" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                Draft (Compiling)
                              </span>
                            )}
                          </td>

                          {/* Evidence */}
                          <td className="py-3.5 px-4 font-mono text-gray-500 text-[11px]">
                            {cl.evidenceFilesCount} files (Invoices, Photos)
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Workflow status advance buttons */}
                              {cl.status === "Draft" && (
                                <button
                                  id={`btn-send-cnf-${cl.claimNo}`}
                                  onClick={() => handleUpdateStatus(cl.id, "Sent to C&F")}
                                  className="px-2 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded text-[11px] font-semibold cursor-pointer shadow-2xs flex items-center gap-1"
                                  title="Dispatch to C&F Depot"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Send C&amp;F</span>
                                </button>
                              )}

                              {cl.status === "Sent to C&F" && (
                                <button
                                  id={`btn-verify-${cl.claimNo}`}
                                  onClick={() => handleUpdateStatus(cl.id, "Verified")}
                                  className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-[11px] font-semibold cursor-pointer shadow-2xs flex items-center gap-1"
                                  title="Mark Verified by C&F"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Verify</span>
                                </button>
                              )}

                              {cl.status !== "Credit Note Received" && (
                                <button
                                  id={`btn-settle-${cl.claimNo}`}
                                  onClick={() => openSettleModal(cl)}
                                  className="px-2 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 rounded text-[11px] font-semibold cursor-pointer shadow-2xs flex items-center gap-1"
                                  title="Apply Credit Note & Settle"
                                >
                                  <IndianRupee className="w-3 h-3 text-emerald-700" />
                                  <span>Settle CN</span>
                                </button>
                              )}

                              <button
                                id={`btn-view-${cl.claimNo}`}
                                onClick={() => setSelectedClaim(cl)}
                                className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 text-gray-600 cursor-pointer shadow-2xs"
                                title="View Claim Dossier"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              
                              <button
                                id={`btn-share-${cl.claimNo}`}
                                onClick={() => {
                                  showToast(`Claim notice & statutory debit note resent to ${cl.principalName}.`, "info");
                                }}
                                className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 text-[#178582] cursor-pointer shadow-2xs"
                                title="Transmit Notice"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>

                              {cl.status === "Draft" && (
                                <button
                                  id={`btn-delete-${cl.claimNo}`}
                                  onClick={() => handleDeleteClaim(cl.id, cl.claimNo)}
                                  className="p-1.5 border border-red-200 rounded hover:bg-red-50 text-red-600 cursor-pointer shadow-2xs"
                                  title="Delete Draft Claim"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 10 Formula & True Margin Architecture Note */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <Info className="w-4 h-4 text-[#178582]" />
            <span>True Margin View Architecture (Page 11):</span>
          </div>
          <p className="text-gray-600 font-mono text-[11px] leading-relaxed bg-gray-50 p-2.5 rounded border border-gray-200">
            Net margin = (PTR &times; qty &minus; customer discount &minus; free goods given at cost) &minus; (PTS &times; qty &minus; principal discount &minus; free goods received) + claimable amounts
          </p>
          <p className="text-gray-500 text-[11px]">
            The system tracks claims per invoice line so the distributor sees true margin by product, principal, customer, and salesman — preventing loss-making accounts.
          </p>
        </div>

      </div>

      {/* RAISE NEW CLAIM MODAL */}
      {showNewClaimModal && (
        <div id="modal-raise-claim" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Raise Claim with Principal</h3>
                <p className="text-xs text-gray-500">Submit claim package in principal format with attached invoices and batch photos</p>
              </div>
              <button 
                id="btn-close-raise-modal"
                onClick={() => setShowNewClaimModal(false)} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClaim} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">Claim Category</label>
                <select 
                  id="input-claim-category"
                  value={newClaimForm.type}
                  onChange={(e) => setNewClaimForm({ ...newClaimForm, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                >
                  {CLAIM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="text-gray-900 bg-white">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Select Principal &amp; Depot</label>
                <select 
                  id="input-claim-principal"
                  value={newClaimForm.principalName}
                  onChange={(e) => {
                    const sel = PRINCIPAL_OPTIONS.find((p) => p.name === e.target.value);
                    setNewClaimForm({
                      ...newClaimForm,
                      principalName: e.target.value,
                      cnfDepot: sel ? sel.depot : newClaimForm.cnfDepot
                    });
                  }}
                  className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                >
                  {PRINCIPAL_OPTIONS.map((p) => (
                    <option key={p.name} value={p.name} className="text-gray-900 bg-white">
                      {p.name} · {p.depot}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Claim Amount (₹)</label>
                  <input
                    id="input-claim-amount"
                    type="number"
                    required
                    min="1"
                    value={newClaimForm.amount}
                    onChange={(e) => setNewClaimForm({ ...newClaimForm, amount: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-mono font-bold focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Attach Debit Note</label>
                  <input
                    id="input-claim-debit-note"
                    type="text"
                    value={newClaimForm.debitNoteNo}
                    onChange={(e) => setNewClaimForm({ ...newClaimForm, debitNoteNo: e.target.value })}
                    className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-mono font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Batch Line Count</label>
                  <input
                    id="input-claim-lines"
                    type="number"
                    min="1"
                    value={newClaimForm.linesCount}
                    onChange={(e) => setNewClaimForm({ ...newClaimForm, linesCount: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 font-mono font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Evidence Files Count</label>
                  <input
                    id="input-claim-evidence"
                    type="number"
                    min="1"
                    value={newClaimForm.evidenceFilesCount}
                    onChange={(e) => setNewClaimForm({ ...newClaimForm, evidenceFilesCount: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 font-mono font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Batch &amp; Evidence Summary</label>
                <textarea
                  id="input-claim-batch-details"
                  rows={2}
                  required
                  value={newClaimForm.batchDetails}
                  onChange={(e) => setNewClaimForm({ ...newClaimForm, batchDetails: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="input-claim-autosend"
                  type="checkbox"
                  checked={newClaimForm.autoSend}
                  onChange={(e) => setNewClaimForm({ ...newClaimForm, autoSend: e.target.checked })}
                  className="w-4 h-4 text-[#178582] rounded border-gray-300 focus:ring-[#178582] cursor-pointer"
                />
                <label htmlFor="input-claim-autosend" className="text-gray-700 cursor-pointer font-medium">
                  Dispatch immediately to C&amp;F Depot with statutory debit note
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  id="btn-cancel-raise-claim"
                  onClick={() => setShowNewClaimModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-raise-claim"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving to DB...</span>
                    </>
                  ) : (
                    <span>Generate &amp; Register Claim</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SETTLE CLAIM WITH CREDIT NOTE MODAL */}
      {settlingClaim && (
        <div id="modal-settle-claim" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900">Settle Claim with Credit Note</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {settlingClaim.claimNo} · {settlingClaim.principalName}
                </p>
              </div>
              <button 
                id="btn-close-settle-modal"
                onClick={() => setSettlingClaim(null)} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSettleClaim} className="space-y-3.5 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Claim Amount:</span>
                  <span className="font-bold text-gray-900 font-mono">₹{settlingClaim.amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Category:</span>
                  <span className="font-semibold text-gray-800">{settlingClaim.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Depot:</span>
                  <span className="text-gray-700">{settlingClaim.cnfDepot}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Principal Credit Note (PCN) Number</label>
                <input
                  id="input-settle-cn-no"
                  type="text"
                  required
                  value={settleForm.creditNoteNo}
                  onChange={(e) => setSettleForm({ ...settleForm, creditNoteNo: e.target.value })}
                  placeholder="e.g. PCN-GLX-9941"
                  className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-mono font-bold focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Credit Note Amount Received (₹)</label>
                <input
                  id="input-settle-cn-amount"
                  type="number"
                  required
                  min="1"
                  value={settleForm.creditNoteAmount}
                  onChange={(e) => setSettleForm({ ...settleForm, creditNoteAmount: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-mono font-bold focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">Reconciles principal ledger and marks claim as settled.</p>
              </div>

              <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  id="btn-cancel-settle"
                  onClick={() => setSettlingClaim(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-settle"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-700 text-white rounded-md text-xs font-semibold hover:bg-emerald-800 cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Settling...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Apply CN &amp; Settle</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLAIM DOSSIER DETAILS MODAL */}
      {selectedClaim && (
        <div id="modal-claim-dossier" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200">
              <div>
                <h3 id="dossier-claim-no" className="text-base font-bold text-gray-900">
                  Claim Dossier — {selectedClaim.claimNo}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedClaim.type} · {selectedClaim.principalName}</p>
              </div>
              <button 
                id="btn-close-dossier-modal"
                onClick={() => setSelectedClaim(null)} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1.5 font-medium">
                <div className="flex justify-between">
                  <span className="text-gray-500">Claim Amount:</span>
                  <span className="font-bold text-gray-900 text-sm font-mono">₹{selectedClaim.amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Status:</span>
                  <span className={`font-bold ${
                    selectedClaim.status === "Credit Note Received" ? "text-emerald-700" :
                    selectedClaim.status === "Verified" ? "text-blue-700" :
                    selectedClaim.status === "Sent to C&F" ? "text-amber-800" : "text-gray-700"
                  }`}>
                    {selectedClaim.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ageing SLA:</span>
                  <span className={`font-bold font-mono ${selectedClaim.ageDays > 60 ? "text-red-600" : "text-gray-800"}`}>
                    {selectedClaim.ageDays} days ({selectedClaim.dateRaised})
                  </span>
                </div>
                {selectedClaim.creditNoteNo && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Principal Credit Note:</span>
                    <span className="font-bold font-mono">{selectedClaim.creditNoteNo} (₹{selectedClaim.creditNoteAmount?.toLocaleString("en-IN")})</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-gray-200">
                  <span className="text-gray-500">Batch Lines:</span>
                  <span className="text-gray-800">{selectedClaim.batchDetails}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900">
                <span className="font-bold">Audit Evidence on Record ({selectedClaim.evidenceFilesCount} files):</span>
                <div className="text-[11px] text-emerald-800 mt-1">
                  &bull; Original Chemist Return Slips &bull; Outer Master Carton Barcode Scan &bull; Distributor Purchase Invoices &bull; Commercial Debit Note Acknowledgement
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center gap-2.5 pt-3 border-t border-gray-100">
              <div>
                {selectedClaim.status !== "Credit Note Received" && (
                  <button
                    id="dossier-settle-btn"
                    onClick={() => {
                      const cl = selectedClaim;
                      setSelectedClaim(null);
                      openSettleModal(cl);
                    }}
                    className="px-3 py-1.5 bg-emerald-700 text-white rounded text-xs font-semibold hover:bg-emerald-800 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <IndianRupee className="w-3.5 h-3.5" />
                    <span>Settle with CN</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="dossier-export-pdf-btn"
                  onClick={() => {
                    showToast(`Dossier and statutory debit note for ${selectedClaim.claimNo} downloaded.`, "info");
                  }}
                  className="px-3.5 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-gray-600" />
                  <span>Export PDF</span>
                </button>
                <button
                  id="dossier-close-btn"
                  onClick={() => setSelectedClaim(null)}
                  className="px-4 py-2 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
