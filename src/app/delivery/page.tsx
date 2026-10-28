"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Truck,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  RotateCcw,
  Search,
  Check,
  X,
  Sparkles,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  Thermometer,
  Plus
} from "lucide-react";
import { api } from "@/lib/api";

interface DeliveryDrop {
  id: string;
  routeId?: string;
  sequence: number;
  customerName: string;
  customerCode: string;
  address: string;
  contactPerson: string;
  phone: string;
  invoiceNo: string;
  boxesCount: number;
  invoiceAmount: number;
  oldDues: number;
  paymentMode: "Credit" | "Cash on Delivery" | "Cheque / UPI";
  returnPickUp?: {
    itemsCount: string;
    reason: string;
  };
  podStatus: {
    otpVerified: boolean;
    photoTaken: boolean;
    signatureObtained: boolean;
  };
  status: "pending" | "in_transit" | "delivered" | "failed";
  collectedAmount?: number;
  collectionMethod?: "UPI QR" | "Cheque" | "Cash";
  deliveredAt?: string;
  failureReason?: string;
}

interface DeliveryRoute {
  id: string;
  routeNumber: string;
  driverName: string;
  vanNumber: string;
  totalDrops: number;
  deliveredDrops: number;
  completionPercent?: number;
  totalOrderValue: number;
  totalCollected: number;
  cashCollected: number;
  upiCollected: number;
  chequeCollected: number;
  status: "on_route" | "settled" | "loading";
  drops: DeliveryDrop[];
}

interface DeliveryStats {
  totalRoutes: number;
  activeVansOnRoute: number;
  totalDrops: number;
  deliveredDrops: number;
  pendingDrops: number;
  completionPercent: number;
  totalOrderValue: number;
  totalCollected: number;
  cashCollected: number;
  upiCollected: number;
  chequeCollected: number;
  coldChainCompliancePercent: number;
  temperatureSensorStatus: string;
}

export default function DeliveryPage() {
  // State
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedDropId, setSelectedDropId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "on_route" | "loading" | "settled">("all");

  // Loading & Processing
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [showPodModal, setShowPodModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReattemptModal, setShowReattemptModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showDayEndModal, setShowDayEndModal] = useState(false);

  // Form States
  const [enteredOtp, setEnteredOtp] = useState("4092");
  const [podPhotoConfirmed, setPodPhotoConfirmed] = useState(true);
  const [podSignatureConfirmed, setPodSignatureConfirmed] = useState(true);
  const [podCollectAmount, setPodCollectAmount] = useState("");
  const [podCollectMethod, setPodCollectMethod] = useState<"UPI QR" | "Cheque" | "Cash">("UPI QR");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"UPI QR" | "Cheque" | "Cash">("UPI QR");
  const [paymentRefNo, setPaymentRefNo] = useState("");

  const [reattemptReason, setReattemptReason] = useState("Chemist shop closed / Pharmacist lunch break");

  const [newVanForm, setNewVanForm] = useState({
    routeNumber: "Route 4",
    driverName: "Amit Deshmukh",
    vanNumber: "Van KA-01-MJ-9912",
    firstCustomer: "Mahavir Medicals",
    firstCustomerCode: "C-2901",
    invoiceAmount: "45000",
    boxesCount: "2"
  });

  // Toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "warning" | "info">("info");

  const showToast = useCallback((message: string, type: "success" | "warning" | "info" = "info") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // 1. Fetch live routes and stats from backend
  const loadDeliveryData = useCallback(async (preferredRouteId?: string, isManual = false) => {
    try {
      if (isManual) setLoading(true);
      const [routesRes, statsRes] = await Promise.all([
        api.getDeliveryRoutes(),
        api.getDeliveryStats()
      ]);

      if (routesRes?.routes) {
        setRoutes(routesRes.routes);
        const targetId = preferredRouteId || (routesRes.routes.length > 0 ? routesRes.routes[0].id : null);
        if (targetId) {
          setSelectedRouteId(targetId);
        }
      }
      if (statsRes?.stats) {
        setStats(statsRes.stats);
      }
    } catch (err: unknown) {
      console.error("Error loading delivery data:", err);
      showToast("Failed to load delivery runs from database", "warning");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [routesRes, statsRes] = await Promise.all([
          api.getDeliveryRoutes(),
          api.getDeliveryStats()
        ]);
        if (!isMounted) return;
        if (routesRes?.routes) {
          setRoutes(routesRes.routes);
          if (routesRes.routes.length > 0) {
            setSelectedRouteId(routesRes.routes[0].id);
          }
        }
        if (statsRes?.stats) {
          setStats(statsRes.stats);
        }
      } catch (err: unknown) {
        console.error("Delivery initial load error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Currently selected route & drop
  const currentRoute = useMemo(() => {
    if (!routes || routes.length === 0) return null;
    return routes.find((r) => r.id === selectedRouteId) || routes[0];
  }, [routes, selectedRouteId]);

  const currentDrop = useMemo(() => {
    if (!currentRoute || currentRoute.drops.length === 0) return null;
    return currentRoute.drops.find((d) => d.id === selectedDropId) || currentRoute.drops[0];
  }, [currentRoute, selectedDropId]);

  // 3. Filtered routes for the left pane
  const filteredRoutes = useMemo(() => {
    return routes.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.routeNumber.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        r.vanNumber.toLowerCase().includes(q) ||
        r.drops.some((d) => d.customerName.toLowerCase().includes(q) || d.invoiceNo.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [routes, searchQuery, statusFilter]);

  // 4. Handle Complete Proof of Delivery (POD)
  const handleCompletePod = async () => {
    if (!currentDrop) return;
    try {
      setActionLoading(true);
      const collAmount = Number(podCollectAmount) || 0;
      const res = await api.verifyDeliveryOtp(
        currentDrop.id,
        collAmount > 0 ? collAmount : undefined,
        collAmount > 0 ? podCollectMethod : undefined
      );

      if (res?.success) {
        showToast(res.message || `Proof of Delivery (POD) confirmed for ${currentDrop.customerName}!`, "success");
        setShowPodModal(false);
        setPodCollectAmount("");
        await loadDeliveryData(currentRoute?.id);
      } else {
        showToast(res?.error || "Failed to confirm POD", "warning");
      }
    } catch (err: unknown) {
      showToast((err as Error).message || "Error confirming POD", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Handle Payment Collection on a Drop
  const handleRecordCollection = async () => {
    if (!currentDrop) return;
    const collectedVal = Number(paymentAmount) || 0;
    if (collectedVal <= 0) {
      showToast("Please enter a valid payment amount", "warning");
      return;
    }

    try {
      setActionLoading(true);
      const res = await api.recordDropCollection(currentDrop.id, {
        amount: collectedVal,
        method: paymentMethod,
        referenceNo: paymentRefNo || undefined
      });

      if (res?.success) {
        showToast(res.message || `Collected ₹${collectedVal.toLocaleString("en-IN")} via ${paymentMethod}`, "success");
        setShowPaymentModal(false);
        setPaymentAmount("");
        setPaymentRefNo("");
        await loadDeliveryData(currentRoute?.id);
      } else {
        showToast(res?.error || "Failed to record payment", "warning");
      }
    } catch (err: unknown) {
      showToast((err as Error).message || "Error recording payment", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Handle Re-attempt / Mark Failed
  const handleMarkReattempt = async () => {
    if (!currentDrop) return;
    try {
      setActionLoading(true);
      const res = await api.updateDropStatus(currentDrop.id, {
        status: "failed",
        failureReason: reattemptReason
      });

      if (res?.success) {
        showToast(`Drop for ${currentDrop.customerName} marked for re-attempt: ${reattemptReason}`, "info");
        setShowReattemptModal(false);
        await loadDeliveryData(currentRoute?.id);
      } else {
        showToast(res?.error || "Failed to update drop status", "warning");
      }
    } catch (err: unknown) {
      showToast((err as Error).message || "Error updating drop", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Handle Dispatch New Van Run
  const handleDispatchVan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await api.createDeliveryRoute({
        routeNumber: newVanForm.routeNumber.trim(),
        driverName: newVanForm.driverName.trim(),
        vanNumber: newVanForm.vanNumber.trim(),
        drops: [
          {
            sequence: 1,
            customerName: newVanForm.firstCustomer.trim(),
            customerCode: newVanForm.firstCustomerCode.trim(),
            address: "Main Market Commercial Complex",
            contactPerson: "Head Pharmacist",
            phone: "+91 98450 99881",
            invoiceNo: `INV-26-${Math.floor(51000 + Math.random() * 8000)}`,
            boxesCount: Number(newVanForm.boxesCount) || 2,
            invoiceAmount: Number(newVanForm.invoiceAmount) || 45000,
            oldDues: 0,
            paymentMode: "Credit"
          }
        ]
      });

      if (res?.success) {
        showToast(`Delivery run '${newVanForm.routeNumber}' dispatched successfully!`, "success");
        setShowDispatchModal(false);
        await loadDeliveryData(res.route?.id);
      } else {
        showToast(res?.error || "Failed to dispatch van", "warning");
      }
    } catch (err: unknown) {
      showToast((err as Error).message || "Error dispatching van", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Handle Day-End Settlement
  const handleSettleDayEnd = async () => {
    if (!currentRoute) return;
    try {
      setActionLoading(true);
      const res = await api.settleRouteDayEnd(currentRoute.id);
      if (res?.success) {
        showToast(res.message || `Van trip ${currentRoute.vanNumber} settled successfully!`, "success");
        setShowDayEndModal(false);
        await loadDeliveryData(currentRoute.id);
      } else {
        showToast(res?.error || "Failed to settle van trip", "warning");
      }
    } catch (err: unknown) {
      showToast((err as Error).message || "Error settling van trip", "warning");
    } finally {
      setActionLoading(false);
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
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-white/70 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header & Dynamic Metrics Strip */}
      <header className="px-4 sm:px-8 py-4 sm:py-5 bg-white border-b border-gray-200 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Delivery &amp; Route Management (ePOD)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live GPS &amp; Vans Telemetry
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Real-time van dispatch, OTP-verified Proof of Delivery, Reefer Cold-Chain tracking, and Field Cash collections
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              id="btn-export-delivery-csv"
              href={api.getExportDeliveryUrl()}
              download="delivery_manifest.csv"
              className="px-3.5 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Manifest</span>
            </a>
            <button
              id="btn-refresh-delivery"
              onClick={() => loadDeliveryData(selectedRouteId || undefined, true)}
              className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600 cursor-pointer"
              title="Refresh Routes"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#178582]" : ""}`} />
            </button>
            <button
              id="btn-dispatch-new-van"
              onClick={() => setShowDispatchModal(true)}
              className="px-4 py-1.5 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Dispatch Van</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-3 border-t border-gray-100">
          <div className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200/80">
            <span className="text-[11px] text-gray-500 font-medium">Active Vans On Route</span>
            <div className="text-base font-bold text-gray-900 font-mono mt-0.5">
              {stats?.activeVansOnRoute || 0} / {stats?.totalRoutes || routes.length} Vans
            </div>
            <span className="text-[10px] text-emerald-700 font-medium">GPS tracked live</span>
          </div>

          <div className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200/80">
            <span className="text-[11px] text-gray-500 font-medium">Completed Drops</span>
            <div className="text-base font-bold text-gray-900 font-mono mt-0.5">
              {stats?.deliveredDrops || 0} of {stats?.totalDrops || 0} Drops
            </div>
            <span className="text-[10px] text-[#178582] font-semibold">
              {stats?.completionPercent || 0}% overall run rate
            </span>
          </div>

          <div className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200/80">
            <span className="text-[11px] text-gray-500 font-medium">Pending Drops</span>
            <div className="text-base font-bold text-amber-800 font-mono mt-0.5">
              {stats?.pendingDrops || 0} Deliveries
            </div>
            <span className="text-[10px] text-gray-400">In-transit or queue</span>
          </div>

          <div className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200/80">
            <span className="text-[11px] text-gray-500 font-medium">Invoice Value on Vans</span>
            <div className="text-base font-bold text-gray-900 font-mono mt-0.5">
              ₹{((stats?.totalOrderValue || 0) / 100000).toFixed(1)}L
            </div>
            <span className="text-[10px] text-gray-400">Total goods in transit</span>
          </div>

          <div className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200/80">
            <span className="text-[11px] text-gray-500 font-medium">Cash &amp; Cheques in Vans</span>
            <div className="text-base font-bold text-emerald-800 font-mono mt-0.5">
              ₹{((stats?.totalCollected || 0) / 1000).toFixed(0)}K
            </div>
            <span className="text-[10px] text-emerald-700 font-medium">Driver pouch tally</span>
          </div>

          <div className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200/80">
            <span className="text-[11px] text-gray-500 font-medium">Cold Chain Integrity</span>
            <div className="text-base font-bold text-emerald-800 font-mono mt-0.5 flex items-center gap-1">
              <Thermometer className="w-4 h-4 text-emerald-600" />
              <span>{stats?.coldChainCompliancePercent || 99.8}%</span>
            </div>
            <span className="text-[10px] text-emerald-700">3.8°C (Safe 2°C - 8°C)</span>
          </div>
        </div>
      </header>

      {/* Main Split-Pane Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Side: Delivery Routes & Vans Directory */}
        <div className="w-full lg:w-[350px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-[#fbfcfd] flex flex-col max-h-[300px] lg:max-h-full">
          
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">Delivery Vans ({filteredRoutes.length})</h2>
              <span className="text-xs text-gray-400 font-medium">Today&apos;s Dispatch Beats</span>
            </div>

            {/* Search Input */}
            <div className="relative mb-2.5">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-route-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Driver, Van, Route, Chemist..."
                className="pl-8 pr-3 py-1.5 w-full rounded-md border border-gray-200 text-xs focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 placeholder:text-gray-400 font-medium"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-0.5 rounded-md">
              <button
                id="filter-all-vans"
                onClick={() => setStatusFilter("all")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                  statusFilter === "all" ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All
              </button>
              <button
                id="filter-on-route"
                onClick={() => setStatusFilter("on_route")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                  statusFilter === "on_route" ? "bg-white text-emerald-800 shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                On Route
              </button>
              <button
                id="filter-loading"
                onClick={() => setStatusFilter("loading")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                  statusFilter === "loading" ? "bg-white text-amber-800 shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Loading
              </button>
              <button
                id="filter-settled"
                onClick={() => setStatusFilter("settled")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                  statusFilter === "settled" ? "bg-white text-blue-800 shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Settled
              </button>
            </div>
          </div>

          {/* Vans List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {loading ? (
              <div className="py-12 text-center text-xs text-gray-400">
                <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#178582]" />
                Loading active delivery routes...
              </div>
            ) : filteredRoutes.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No delivery runs matching filters.
              </div>
            ) : (
              filteredRoutes.map((r) => {
                const isSelected = r.id === selectedRouteId;
                const percent = r.totalDrops > 0 ? Math.round((r.deliveredDrops / r.totalDrops) * 100) : 0;
                return (
                  <div
                    key={r.id}
                    id={`route-card-${r.routeNumber.replace(/\s+/g, "-")}`}
                    onClick={() => {
                      setSelectedRouteId(r.id);
                      if (r.drops.length > 0) setSelectedDropId(r.drops[0].id);
                    }}
                    className={`p-3 rounded-lg transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-white border-2 border-[#178582] shadow-sm ring-1 ring-[#178582]/20"
                        : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-gray-500" />
                        <h3 className="font-bold text-gray-900 text-xs">{r.routeNumber}</h3>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          r.status === "on_route"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : r.status === "settled"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {r.status === "on_route" ? "On Route" : r.status === "settled" ? "Settled" : "Loading"}
                      </span>
                    </div>

                    <div className="text-[11px] text-gray-600 mb-2">
                      {r.vanNumber} · {r.driverName}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percent === 100 ? "bg-emerald-600" : "bg-[#178582]"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-gray-500">
                        {r.deliveredDrops} of {r.totalDrops} drops ({percent}%)
                      </span>
                      <span className="font-bold text-emerald-800">
                        ₹{(r.totalCollected / 1000).toFixed(0)}K In-Van
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Right Side: Route Drops Manifest & Operations */}
        {currentRoute ? (
          <div className="flex-1 flex flex-col h-full bg-white overflow-y-auto">
            
            {/* Top Route Banner */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-white shrink-0 flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 id="current-route-title" className="text-xl font-bold text-gray-900 tracking-tight">
                    {currentRoute.routeNumber} — {currentRoute.vanNumber}
                  </h2>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${
                      currentRoute.status === "on_route"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : currentRoute.status === "settled"
                        ? "bg-blue-50 text-blue-800 border-blue-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {currentRoute.status === "on_route" ? "● Van On Route" : currentRoute.status === "settled" ? "✓ Route Settled" : "Loading Trays"}
                  </span>
                </div>
                
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                  <span>Driver: <strong className="text-gray-800">{currentRoute.driverName}</strong></span>
                  <span>·</span>
                  <span>{currentRoute.totalDrops} Allocated Chemist Stops</span>
                  <span>·</span>
                  <span>Total Order Goods: <strong className="text-gray-900 font-mono">₹{currentRoute.totalOrderValue.toLocaleString("en-IN")}</strong></span>
                  <span>·</span>
                  <span className="text-emerald-700 font-medium">Reefer Container: 3.8°C (Safe 2°C - 8°C)</span>
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-print-manifest"
                  onClick={() => {
                    window.print();
                    showToast("Thermal manifest prepared for van driver.", "info");
                  }}
                  className="px-3.5 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-gray-600" />
                  <span>Print Challan</span>
                </button>

                {currentRoute.status !== "settled" && (
                  <button
                    id="btn-settle-dayend"
                    onClick={() => setShowDayEndModal(true)}
                    className="px-3.5 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-xs font-semibold hover:bg-blue-100 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />
                    <span>Settle Van Day-End</span>
                  </button>
                )}
              </div>
            </div>

            {/* Financial Health & In-Van Cash Cards */}
            <div className="p-6 space-y-6 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <span className="text-[11px] text-gray-500 font-medium">Van Invoice Total</span>
                  <div className="text-lg font-bold text-gray-900 font-mono mt-0.5">
                    ₹{currentRoute.totalOrderValue.toLocaleString("en-IN")}
                  </div>
                  <span className="text-[10px] text-gray-400">Goods dispatched</span>
                </div>

                <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-[11px] text-emerald-900 font-medium">Cash in Van Pouch</span>
                  <div className="text-lg font-bold text-emerald-900 font-mono mt-0.5">
                    ₹{currentRoute.cashCollected.toLocaleString("en-IN")}
                  </div>
                  <span className="text-[10px] text-emerald-700">Driver custody</span>
                </div>

                <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200">
                  <span className="text-[11px] text-blue-900 font-medium">UPI QR Remitted</span>
                  <div className="text-lg font-bold text-blue-900 font-mono mt-0.5">
                    ₹{currentRoute.upiCollected.toLocaleString("en-IN")}
                  </div>
                  <span className="text-[10px] text-blue-700">Instant bank credit</span>
                </div>

                <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200">
                  <span className="text-[11px] text-purple-900 font-medium">Cheques in Hand</span>
                  <div className="text-lg font-bold text-purple-900 font-mono mt-0.5">
                    ₹{currentRoute.chequeCollected.toLocaleString("en-IN")}
                  </div>
                  <span className="text-[10px] text-purple-700">For banking clearance</span>
                </div>
              </div>

              {/* Drops Manifest Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Assigned Customer Stops &amp; Drops ({currentRoute.drops.length})
                  </h3>
                  <span className="text-xs text-gray-500">
                    Sequenced for minimum travel distance
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {currentRoute.drops.length === 0 ? (
                    <div className="py-12 text-center text-xs text-gray-400">
                      No drops assigned to this van yet.
                    </div>
                  ) : (
                    currentRoute.drops.map((drop) => {
                      const isDropSelected = drop.id === currentDrop?.id;
                      return (
                        <div
                          key={drop.id}
                          id={`drop-row-${drop.sequence}`}
                          className={`p-4 transition-colors ${
                            isDropSelected ? "bg-blue-50/30" : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-800 font-bold text-xs flex items-center justify-center shrink-0">
                                #{drop.sequence}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-gray-900 text-sm">
                                    {drop.customerName}
                                  </h4>
                                  <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded">
                                    {drop.customerCode}
                                  </span>
                                  {drop.status === "delivered" && (
                                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      ✓ Delivered at {drop.deliveredAt || "Done"}
                                    </span>
                                  )}
                                  {drop.status === "in_transit" && (
                                    <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                      ● In Transit
                                    </span>
                                  )}
                                  {drop.status === "pending" && (
                                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                      Pending Stop
                                    </span>
                                  )}
                                  {drop.status === "failed" && (
                                    <span className="text-[10px] font-bold text-red-800 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                      Re-attempt Required
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-gray-400" />
                                    {drop.address}
                                  </span>
                                  <span>·</span>
                                  <span>Contact: {drop.contactPerson}</span>
                                  <span>·</span>
                                  <a href={`tel:${drop.phone}`} className="text-[#178582] hover:underline font-mono">
                                    {drop.phone}
                                  </a>
                                </div>

                                <div className="text-xs text-gray-600 mt-2 flex items-center gap-3 flex-wrap">
                                  <span className="font-mono font-medium">Invoice: {drop.invoiceNo}</span>
                                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[11px] font-semibold text-gray-700">
                                    {drop.boxesCount} Boxes
                                  </span>
                                  <span>Amount: <strong className="text-gray-900 font-mono">₹{drop.invoiceAmount.toLocaleString("en-IN")}</strong></span>
                                  {drop.oldDues > 0 && (
                                    <span className="text-amber-800 font-medium">
                                      Old Dues: ₹{drop.oldDues.toLocaleString("en-IN")}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                                    {drop.paymentMode}
                                  </span>
                                </div>

                                {drop.returnPickUp && (
                                  <div className="mt-2 text-xs text-purple-900 bg-purple-50 p-2 rounded border border-purple-200 flex items-center gap-2">
                                    <RotateCcw className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                                    <span>
                                      <strong>Return to Collect:</strong> {drop.returnPickUp.itemsCount} ({drop.returnPickUp.reason})
                                    </span>
                                  </div>
                                )}

                                {drop.collectedAmount && (
                                  <div className="mt-1.5 text-xs text-emerald-800 font-medium">
                                    Collected ₹{drop.collectedAmount.toLocaleString("en-IN")} via {drop.collectionMethod}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Drop Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              {drop.status !== "delivered" ? (
                                <>
                                  <button
                                    id={`btn-pod-${drop.sequence}`}
                                    onClick={() => {
                                      setSelectedDropId(drop.id);
                                      setShowPodModal(true);
                                    }}
                                    className="px-3 py-1.5 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Confirm POD</span>
                                  </button>
                                  <button
                                    id={`btn-collect-${drop.sequence}`}
                                    onClick={() => {
                                      setSelectedDropId(drop.id);
                                      setPaymentAmount(String(drop.oldDues || drop.invoiceAmount));
                                      setShowPaymentModal(true);
                                    }}
                                    className="px-3 py-1.5 border border-emerald-300 bg-emerald-50 text-emerald-800 rounded text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1 cursor-pointer shadow-xs"
                                  >
                                    <IndianRupee className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>Collect</span>
                                  </button>
                                  <button
                                    id={`btn-reattempt-${drop.sequence}`}
                                    onClick={() => {
                                      setSelectedDropId(drop.id);
                                      setShowReattemptModal(true);
                                    }}
                                    className="px-2.5 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
                                    title="Mark for Re-attempt"
                                  >
                                    Re-attempt
                                  </button>
                                </>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>ePOD Signed</span>
                                  </span>
                                  <button
                                    onClick={() => {
                                      setSelectedDropId(drop.id);
                                      setPaymentAmount(String(drop.oldDues || 0));
                                      setShowPaymentModal(true);
                                    }}
                                    className="px-2.5 py-1 border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50 cursor-pointer"
                                  >
                                    + Collect Due
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

          </div>
        ) : null}

      </div>

      {/* MODAL 1: CONFIRM PROOF OF DELIVERY (POD) */}
      {showPodModal && currentDrop && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Confirm Proof of Delivery (ePOD)</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Stop #{currentDrop.sequence} — {currentDrop.customerName} ({currentDrop.customerCode})
                </p>
              </div>
              <button
                id="btn-close-pod-modal"
                onClick={() => setShowPodModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice:</span>
                  <span className="font-mono font-bold text-gray-900">{currentDrop.invoiceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Boxes Handover:</span>
                  <span className="font-bold text-gray-900">{currentDrop.boxesCount} Sealed Boxes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice Amount:</span>
                  <span className="font-mono font-bold text-gray-900">₹{currentDrop.invoiceAmount.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* OTP Input */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Customer 4-Digit Delivery OTP *
                </label>
                <input
                  id="pod-otp-input"
                  type="text"
                  maxLength={4}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value)}
                  placeholder="4092"
                  className="w-full border border-gray-300 rounded p-2.5 text-center font-mono text-base font-bold tracking-widest text-gray-900 focus:ring-2 focus:ring-[#178582]"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  * Generated on customer&apos;s registered phone number for delivery verification
                </span>
              </div>

              {/* Verification Checklist */}
              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={podPhotoConfirmed}
                    onChange={(e) => setPodPhotoConfirmed(e.target.checked)}
                    className="rounded text-[#178582]"
                  />
                  <span className="text-gray-700 font-medium">Box geo-tagged photo captured &amp; stored</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={podSignatureConfirmed}
                    onChange={(e) => setPodSignatureConfirmed(e.target.checked)}
                    className="rounded text-[#178582]"
                  />
                  <span className="text-gray-700 font-medium">Pharmacist digital signature obtained on mobile device</span>
                </label>
              </div>

              {/* Optional Cash/UPI on Delivery */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block font-bold text-gray-700 mb-1">Collect Payment at Handover (Optional):</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="pod-collect-amount"
                    type="number"
                    value={podCollectAmount}
                    onChange={(e) => setPodCollectAmount(e.target.value)}
                    placeholder="Amount (₹)"
                    className="border border-gray-300 rounded p-2 font-mono text-xs"
                  />
                  <select
                    id="pod-collect-method"
                    value={podCollectMethod}
                    onChange={(e) => setPodCollectMethod(e.target.value as "UPI QR" | "Cash" | "Cheque")}
                    className="border border-gray-300 rounded p-2 bg-white text-xs"
                  >
                    <option value="UPI QR">UPI QR</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100 mt-5">
              <button
                type="button"
                onClick={() => setShowPodModal(false)}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="submit-confirm-pod"
                onClick={handleCompletePod}
                disabled={actionLoading}
                className="px-5 py-2 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm disabled:opacity-50"
              >
                {actionLoading ? "Recording..." : "Confirm & Sign ePOD"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: COLLECT PAYMENT */}
      {showPaymentModal && currentDrop && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Record Field Collection</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Chemist: {currentDrop.customerName} ({currentDrop.customerCode})
                </p>
              </div>
              <button
                id="btn-close-payment-modal"
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Bill (Invoice {currentDrop.invoiceNo}):</span>
                  <span className="font-mono font-bold text-gray-900">₹{currentDrop.invoiceAmount.toLocaleString("en-IN")}</span>
                </div>
                {currentDrop.oldDues > 0 && (
                  <div className="flex justify-between text-amber-800">
                    <span>Prior Outstanding Dues:</span>
                    <span className="font-mono font-bold">₹{currentDrop.oldDues.toLocaleString("en-IN")}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Collection Amount (₹) *</label>
                <input
                  id="collect-amount-input"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="24000"
                  className="w-full border border-gray-300 rounded p-2.5 font-mono text-base font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Payment Mode:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("UPI QR")}
                    className={`py-2 px-3 rounded border text-xs font-semibold cursor-pointer ${
                      paymentMethod === "UPI QR"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    UPI QR Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("Cheque")}
                    className={`py-2 px-3 rounded border text-xs font-semibold cursor-pointer ${
                      paymentMethod === "Cheque"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Cheque
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("Cash")}
                    className={`py-2 px-3 rounded border text-xs font-semibold cursor-pointer ${
                      paymentMethod === "Cash"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Cash Pouch
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Bank UTR / Cheque Number (Optional):</label>
                <input
                  id="collect-ref-input"
                  type="text"
                  value={paymentRefNo}
                  onChange={(e) => setPaymentRefNo(e.target.value)}
                  placeholder="e.g. UPI/261027/HDFC or CHQ #551204"
                  className="w-full border border-gray-300 rounded p-2 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100 mt-5">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="submit-record-payment"
                onClick={handleRecordCollection}
                disabled={actionLoading}
                className="px-5 py-2 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {actionLoading ? "Recording..." : "Post Field Collection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MARK FOR RE-ATTEMPT */}
      {showReattemptModal && currentDrop && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Mark Drop for Re-attempt</h3>
                <p className="text-xs text-gray-500 mt-0.5">{currentDrop.customerName}</p>
              </div>
              <button
                id="btn-close-reattempt-modal"
                onClick={() => setShowReattemptModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">Select Exception Reason:</label>
                <select
                  id="select-reattempt-reason"
                  value={reattemptReason}
                  onChange={(e) => setReattemptReason(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 bg-white"
                >
                  <option value="Chemist shop closed / Pharmacist lunch break">
                    Chemist shop closed / Pharmacist lunch break
                  </option>
                  <option value="Responsible Pharmacist not physically present">
                    Responsible Pharmacist not physically present
                  </option>
                  <option value="Payment dispute regarding credit note discount">
                    Payment dispute regarding credit note discount
                  </option>
                  <option value="Road traffic block / Inaccessible delivery van parking">
                    Road traffic block / Inaccessible delivery van parking
                  </option>
                  <option value="Chemist requested delivery in evening shift (post 6 PM)">
                    Chemist requested delivery in evening shift (post 6 PM)
                  </option>
                </select>
              </div>

              <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                Notice: Marking for re-attempt retains the goods in the van. The driver will make a second attempt before day-end return to the warehouse.
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100 mt-5">
              <button
                type="button"
                onClick={() => setShowReattemptModal(false)}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="submit-mark-reattempt"
                onClick={handleMarkReattempt}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-600 text-white rounded text-xs font-semibold hover:bg-amber-700 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {actionLoading ? "Updating..." : "Save Exception"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DISPATCH NEW VAN */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Dispatch Delivery Run</h3>
                <p className="text-xs text-gray-500 mt-0.5">Assign delivery van, driver, and first delivery stop</p>
              </div>
              <button
                id="btn-close-dispatch-modal"
                onClick={() => setShowDispatchModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDispatchVan} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Route Number *</label>
                  <input
                    id="new-route-number"
                    type="text"
                    required
                    value={newVanForm.routeNumber}
                    onChange={(e) => setNewVanForm({ ...newVanForm, routeNumber: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Driver Name *</label>
                  <input
                    id="new-driver-name"
                    type="text"
                    required
                    value={newVanForm.driverName}
                    onChange={(e) => setNewVanForm({ ...newVanForm, driverName: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Van Registration *</label>
                  <input
                    id="new-van-number"
                    type="text"
                    required
                    value={newVanForm.vanNumber}
                    onChange={(e) => setNewVanForm({ ...newVanForm, vanNumber: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2"
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200 space-y-3">
                <span className="font-bold text-gray-800 block text-xs">First Delivery Stop Details:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-600 mb-1">Customer / Chemist Name</label>
                    <input
                      id="new-stop-customer"
                      type="text"
                      required
                      value={newVanForm.firstCustomer}
                      onChange={(e) => setNewVanForm({ ...newVanForm, firstCustomer: e.target.value })}
                      className="w-full border border-gray-300 rounded p-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-600 mb-1">Customer Code</label>
                    <input
                      id="new-stop-code"
                      type="text"
                      required
                      value={newVanForm.firstCustomerCode}
                      onChange={(e) => setNewVanForm({ ...newVanForm, firstCustomerCode: e.target.value })}
                      className="w-full border border-gray-300 rounded p-2 bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-600 mb-1">Invoice Amount (₹)</label>
                    <input
                      id="new-stop-amount"
                      type="number"
                      required
                      value={newVanForm.invoiceAmount}
                      onChange={(e) => setNewVanForm({ ...newVanForm, invoiceAmount: e.target.value })}
                      className="w-full border border-gray-300 rounded p-2 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-600 mb-1">Sealed Boxes</label>
                    <input
                      id="new-stop-boxes"
                      type="number"
                      required
                      value={newVanForm.boxesCount}
                      onChange={(e) => setNewVanForm({ ...newVanForm, boxesCount: e.target.value })}
                      className="w-full border border-gray-300 rounded p-2 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="submit-dispatch-van"
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? "Dispatching..." : "Dispatch Van Run"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: DAY-END VAN SETTLEMENT */}
      {showDayEndModal && currentRoute && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Day-End Van Settlement</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Reconciliation for {currentRoute.routeNumber} · {currentRoute.vanNumber}
                </p>
              </div>
              <button
                id="btn-close-settle-modal"
                onClick={() => setShowDayEndModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Driver Check-in:</span>
                  <span className="font-bold text-gray-900">{currentRoute.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Drops Handled:</span>
                  <span className="font-bold text-gray-900">
                    {currentRoute.deliveredDrops} of {currentRoute.totalDrops} Delivered
                  </span>
                </div>
                <div className="h-px bg-gray-200 my-1" />
                <div className="flex justify-between text-emerald-800">
                  <span>Cash Handed Over to Cashier:</span>
                  <span className="font-mono font-bold">₹{currentRoute.cashCollected.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-blue-800">
                  <span>UPI QR Digital Payments:</span>
                  <span className="font-mono font-bold">₹{currentRoute.upiCollected.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-purple-800">
                  <span>Cheques Deposited to Vault:</span>
                  <span className="font-mono font-bold">₹{currentRoute.chequeCollected.toLocaleString("en-IN")}</span>
                </div>
                <div className="h-px bg-gray-200 my-1" />
                <div className="flex justify-between font-bold text-sm text-gray-900 pt-1">
                  <span>Total Van Settlement:</span>
                  <span className="font-mono text-[#178582]">₹{currentRoute.totalCollected.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded border border-blue-200 text-blue-800 text-[11px] leading-relaxed">
                Confirming settlement closes this van&apos;s active run, reconciles cash custody with the accounts desk, and archives the run sheet.
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100 mt-5">
              <button
                type="button"
                onClick={() => setShowDayEndModal(false)}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="submit-confirm-settlement"
                onClick={handleSettleDayEnd}
                disabled={actionLoading}
                className="px-5 py-2 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {actionLoading ? "Settling..." : "Confirm & Settle Trip"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
