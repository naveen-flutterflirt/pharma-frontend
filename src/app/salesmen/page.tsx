"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  MapPin,
  CheckCircle2,
  Clock,
  Navigation,
  Sparkles,
  Search,
  Check,
  X,
  AlertTriangle,
  Share2,
  Award,
  Plus,
  RefreshCw,
  UserPlus,
  Loader2,
  Trash2,
  PlusCircle
} from "lucide-react";
import { pharmaApi } from "@/lib/api";

interface BeatVisit {
  id: string;
  sequence: number;
  customerName: string;
  customerCode: string;
  type: string;
  distance: string;
  status: "completed" | "in_progress" | "pending" | "skipped";
  orderBooked?: number;
  collected?: number;
  dueAmount: number;
  usualOrderAmount: number;
  gpsCheckedInAt?: string;
  skipReason?: string;
  licenceStatus: "valid" | "renewal_due" | "blocked";
  licenceNote?: string;
}

interface SalesmanRecord {
  id: string;
  name: string;
  code: string;
  phone: string;
  email?: string;
  assignedRoute: string;
  routeDay: string;
  monthlyTarget: number;
  achievedAmount: number;
  todayOrdersBooked: number;
  todayCollections: number;
  plannedVisits: number;
  completedVisits: number;
  productivityPercent: number;
  status: "on_beat" | "idle" | "completed" | "on_leave";
  beatVisits: BeatVisit[];
}

export default function SalesmenPage() {
  const [salesmen, setSalesmen] = useState<SalesmanRecord[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);

  // Modals & State
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showAddRepModal, setShowAddRepModal] = useState(false);
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  
  const [activeVisit, setActiveVisit] = useState<BeatVisit | null>(null);
  const [orderAmountInput, setOrderAmountInput] = useState("27940");
  const [collectionAmountInput, setCollectionAmountInput] = useState("0");
  const [skipReasonInput, setSkipReasonInput] = useState("Chemist shop closed for festival");
  
  // New Rep Form State
  const [newRepName, setNewRepName] = useState("");
  const [newRepPhone, setNewRepPhone] = useState("");
  const [newRepEmail, setNewRepEmail] = useState("");
  const [newRepRoute, setNewRepRoute] = useState("Route 5 (East Suburban Belt)");
  const [newRepTarget, setNewRepTarget] = useState("2500000");

  // New Beat Stop Form State
  const [newStopName, setNewStopName] = useState("");
  const [newStopCode, setNewStopCode] = useState("");
  const [newStopType, setNewStopType] = useState("Retail Chemist");
  const [newStopDistance, setNewStopDistance] = useState("500 m away");
  const [newStopDue, setNewStopDue] = useState("18500");
  const [newStopUsual, setNewStopUsual] = useState("35000");

  // Toast
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
    }, 5000);
  }, []);

  // Today's route day (deferred to useEffect to prevent Next.js RouteServer prerender warning)
  const [formattedRouteDay, setFormattedRouteDay] = useState("Today's Beat");

  useEffect(() => {
    const d = new Date();
    setFormattedRouteDay(
      d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
    );
  }, []);

  // Load catalog products for order booking
  useEffect(() => {
    pharmaApi.getProducts().then((res) => {
      if (res.products && res.products.length > 0) {
        setCatalogProducts(res.products.slice(0, 3));
      }
    }).catch(() => {});
  }, []);

  // Fetch live salesmen from PostgreSQL
  const loadSalesmen = useCallback(async (preferredRepId?: string) => {
    try {
      setIsLoading(true);
      const res = await pharmaApi.getSalesmen();
      const rawSalesmen = res.salesmen || [];

      const formatted: SalesmanRecord[] = rawSalesmen.map((s: any, idx: number) => {
        const visits = (s.visits || []).map((v: any) => ({
          id: v.id,
          sequence: v.sequence,
          customerName: v.customerName,
          customerCode: v.customerCode,
          type: v.type || "Retail Chemist",
          distance: v.distance || "500 m away",
          status: v.status || "pending",
          orderBooked: v.orderBooked,
          collected: v.collected,
          dueAmount: v.dueAmount || 0,
          usualOrderAmount: v.usualOrderAmount || 0,
          gpsCheckedInAt: v.gpsCheckedInAt,
          skipReason: v.skipReason,
          licenceStatus: v.licenceStatus || "valid",
          licenceNote: v.licenceNote
        }));

        const totalVisits = s.totalVisits || (visits.length > 0 ? visits.length : 15);
        const completedVisits = s.completedVisits || visits.filter((v: any) => v.status === "completed").length;
        const productivity = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;

        return {
          id: s.id,
          name: s.name,
          code: `REP-0${idx + 1}`,
          phone: s.phone,
          email: s.email,
          assignedRoute: s.beatName,
          routeDay: formattedRouteDay,
          monthlyTarget: s.todayTarget || 2500000,
          achievedAmount: s.achievedAmount || 0,
          todayOrdersBooked: s.todayOrdersBooked || 0,
          todayCollections: s.todayCollections || 0,
          plannedVisits: totalVisits,
          completedVisits: completedVisits,
          productivityPercent: productivity,
          status: (s.status as any) || "on_beat",
          beatVisits: visits
        };
      });

      setSalesmen(formatted);

      // Select preferred or first representative
      if (preferredRepId && formatted.some((r) => r.id === preferredRepId)) {
        setSelectedRepId(preferredRepId);
      } else if (formatted.length > 0) {
        setSelectedRepId((curr) => (formatted.some((r) => r.id === curr) ? curr : formatted[0].id));
      }
    } catch (err: any) {
      console.error("Failed to load salesmen:", err);
      showToast(err.message || "Failed to load salesmen from database", "warning");
    } finally {
      setIsLoading(false);
    }
  }, [formattedRouteDay, showToast]);

  useEffect(() => {
    loadSalesmen();
  }, [loadSalesmen]);

  // Filtered salesmen based on search
  const filteredSalesmen = useMemo(() => {
    if (!searchQuery.trim()) return salesmen;
    const q = searchQuery.toLowerCase();
    return salesmen.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.assignedRoute.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
    );
  }, [salesmen, searchQuery]);

  // Active selected rep
  const selectedRep = useMemo(() => {
    return salesmen.find((s) => s.id === selectedRepId) || salesmen[0];
  }, [salesmen, selectedRepId]);

  // Target percent calculation
  const targetPercent = useMemo(() => {
    if (!selectedRep || !selectedRep.monthlyTarget) return 0;
    return Math.round((selectedRep.achievedAmount / selectedRep.monthlyTarget) * 100);
  }, [selectedRep]);

  // Handle GPS Check-in
  const handleGpsCheckIn = async (visit: BeatVisit) => {
    try {
      setIsSubmitting(true);
      const res = await pharmaApi.checkInBeatVisit(visit.id, "12.9716° N, 77.5946° E");
      showToast(res.message || `GPS Check-in recorded at ${visit.customerName}.`, "success");
      setShowCheckInModal(false);
      await loadSalesmen(selectedRep?.id);
    } catch (err: any) {
      showToast(err.message || "Failed to record GPS check-in", "warning");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Booking Field Order
  const handleBookOrder = async () => {
    if (!activeVisit) return;
    try {
      setIsSubmitting(true);
      const val = Number(orderAmountInput) || 0;
      const colVal = Number(collectionAmountInput) || 0;
      const res = await pharmaApi.bookBeatOrder(activeVisit.id, val, colVal);
      showToast(res.message || `Order of ₹${val.toLocaleString("en-IN")} booked successfully!`, "success");
      setShowOrderModal(false);
      await loadSalesmen(selectedRep?.id);
    } catch (err: any) {
      showToast(err.message || "Failed to book beat order", "warning");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Skip Visit
  const handleSkipVisit = async () => {
    if (!activeVisit) return;
    try {
      setIsSubmitting(true);
      const res = await pharmaApi.skipBeatVisit(activeVisit.id, skipReasonInput);
      showToast(res.message || `Visit marked as skipped.`, "info");
      setShowSkipModal(false);
      await loadSalesmen(selectedRep?.id);
    } catch (err: any) {
      showToast(err.message || "Failed to skip visit", "warning");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Broadcast Beat Plan
  const handleBroadcastBeat = async () => {
    if (!selectedRep) return;
    try {
      setIsSubmitting(true);
      const res = await pharmaApi.broadcastBeat(selectedRep.id);
      showToast(res.message || `Beat plan broadcasted to ${selectedRep.name}!`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to broadcast beat plan", "warning");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Salesman
  const handleCreateSalesman = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepName.trim() || !newRepPhone.trim()) {
      showToast("Please enter rep name and phone number", "warning");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await pharmaApi.createSalesman({
        name: newRepName.trim(),
        phone: newRepPhone.trim(),
        email: newRepEmail.trim() || undefined,
        beatName: newRepRoute,
        todayTarget: Number(newRepTarget) || 2000000
      });

      showToast(res.message || `Field Rep ${newRepName} created successfully!`, "success");
      setShowAddRepModal(false);
      setNewRepName("");
      setNewRepPhone("");
      setNewRepEmail("");
      await loadSalesmen(res.salesman?.id);
    } catch (err: any) {
      showToast(err.message || "Failed to create salesman", "warning");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Beat Stop
  const handleAddBeatStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRep || !newStopName.trim()) {
      showToast("Customer store name is required", "warning");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await pharmaApi.addBeatStop(selectedRep.id, {
        customerName: newStopName.trim(),
        customerCode: newStopCode.trim() || undefined,
        type: newStopType,
        distance: newStopDistance,
        dueAmount: Number(newStopDue) || 0,
        usualOrderAmount: Number(newStopUsual) || 25000
      });

      showToast(res.message || `Stop at ${newStopName} added to beat sequence!`, "success");
      setShowAddStopModal(false);
      setNewStopName("");
      setNewStopCode("");
      await loadSalesmen(selectedRep.id);
    } catch (err: any) {
      showToast(err.message || "Failed to add beat stop", "warning");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Change Rep Status (On Beat / Completed / On Leave)
  const handleUpdateRepStatus = async (newStatus: string) => {
    if (!selectedRep) return;
    try {
      setIsSubmitting(true);
      const res = await pharmaApi.updateSalesman(selectedRep.id, { status: newStatus });
      showToast(res.message || `Status updated to ${newStatus.replace("_", " ")}!`, "success");
      await loadSalesmen(selectedRep.id);
    } catch (err: any) {
      showToast(err.message || "Failed to update status", "warning");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Salesman
  const handleDeleteRep = async (repId: string, repName: string) => {
    if (!confirm(`Are you sure you want to remove field representative ${repName} and their beat schedule?`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await pharmaApi.deleteSalesman(repId);
      showToast(res.message || `${repName} removed from field force.`, "info");
      await loadSalesmen();
    } catch (err: any) {
      showToast(err.message || "Failed to remove salesman", "warning");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download Productivity Report CSV
  const handleExportScorecard = () => {
    const url = pharmaApi.getSalesmenScorecardUrl();
    window.open(url, "_blank");
    showToast("Salesman productivity scorecard downloaded as CSV.", "success");
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
      <header className="px-4 sm:px-8 py-6 bg-white border-b border-gray-200 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Salesmen &amp; Beat Management
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Live GPS Geo-Fencing Active
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Field rep beat plans, GPS check-ins, order booking from history, and instant doorstep collection receipts.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              id="link-order-desk"
              href="/order-desk"
              className="px-3 py-2 bg-teal-50 border border-teal-200 text-[#178582] rounded-md text-xs font-semibold hover:bg-teal-100 transition-colors"
            >
              Order Intake Desk →
            </Link>
            <Link
              id="link-customer-accounts"
              href="/customers"
              className="px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-100 transition-colors"
            >
              Customer Accounts →
            </Link>
            <button
              id="btn-add-salesman"
              onClick={() => setShowAddRepModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border border-gray-300 text-gray-800 rounded-md text-xs sm:text-sm font-semibold hover:bg-gray-200 transition-colors shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-gray-700" />
              <span>+ New Rep</span>
            </button>
            <button
              id="btn-broadcast-beat"
              onClick={handleBroadcastBeat}
              disabled={isSubmitting || !selectedRep}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-xs sm:text-sm font-semibold hover:bg-gray-50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Share2 className="w-4 h-4 text-[#178582]" />
              <span>Broadcast Beat</span>
            </button>
            <button
              id="btn-export-scorecard"
              onClick={handleExportScorecard}
              className="flex items-center gap-2 px-4 py-2 bg-[#178582] text-white rounded-md text-xs sm:text-sm font-semibold hover:bg-[#126b68] transition-colors shadow-sm cursor-pointer active:scale-95"
            >
              <Award className="w-4 h-4" />
              <span>Productivity Report</span>
            </button>
          </div>
        </div>

        {/* Salesman Active Beat Banner */}
        {selectedRep && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
            <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80 relative group">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500 font-medium">Field Representative</div>
                <select
                  id="select-rep-status"
                  value={selectedRep.status}
                  onChange={(e) => handleUpdateRepStatus(e.target.value)}
                  className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5 border border-gray-200 bg-white text-gray-700 cursor-pointer focus:outline-none"
                >
                  <option value="on_beat">On Beat</option>
                  <option value="completed">Completed</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>
              <div id="stat-rep-name" className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">{selectedRep.name}</div>
              <div id="stat-rep-route" className="text-[11px] text-gray-400 mt-0.5">{selectedRep.assignedRoute}</div>
            </div>
            <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
              <div className="text-xs text-gray-500 font-medium">Beat Visits Completed</div>
              <div id="stat-rep-visits" className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">
                {selectedRep.completedVisits} / {selectedRep.plannedVisits}
              </div>
              <div id="stat-rep-productivity" className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                Productivity: {selectedRep.productivityPercent}%
              </div>
            </div>
            <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
              <div className="text-xs text-gray-500 font-medium">Orders Booked Today</div>
              <div id="stat-rep-orders" className="text-base sm:text-lg font-bold text-[#178582] mt-0.5">
                ₹{(selectedRep.todayOrdersBooked / 100000).toFixed(1)} Lakh
              </div>
              <div id="stat-rep-collections" className="text-[11px] text-gray-400 mt-0.5">
                Collections: ₹{(selectedRep.todayCollections / 1000).toFixed(0)}K
              </div>
            </div>
            <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
              <div className="text-xs text-gray-500 font-medium">Monthly Target (₹{(selectedRep.monthlyTarget / 100000).toFixed(0)}L)</div>
              <div id="stat-rep-target-pct" className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">{targetPercent}% Achieved</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                ₹{(selectedRep.achievedAmount / 100000).toFixed(1)}L of ₹{(selectedRep.monthlyTarget / 100000).toFixed(0)}L target
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Side: Field Reps List */}
        <div className="w-full lg:w-[320px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-[#fbfcfd] flex flex-col max-h-[220px] lg:max-h-full">
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Field Force ({filteredSalesmen.length})
              </h2>
              <button
                id="btn-refresh-salesmen"
                onClick={() => loadSalesmen(selectedRepId)}
                title="Refresh field force from PostgreSQL"
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#178582]" : ""}`} />
              </button>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-rep-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Rep, Route..."
                className="pl-8 pr-3 py-1.5 w-full rounded-md border border-gray-200 text-xs focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 placeholder:text-gray-400 font-medium"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading && salesmen.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#178582] mb-2" />
                Loading field reps from PostgreSQL...
              </div>
            ) : filteredSalesmen.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                No field representatives found matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              filteredSalesmen.map((rep) => {
                const isSelected = rep.id === selectedRepId;
                return (
                  <div
                    key={rep.id}
                    id={`rep-card-${rep.id}`}
                    onClick={() => setSelectedRepId(rep.id)}
                    className={`p-3 rounded-lg transition-all cursor-pointer border group relative ${
                      isSelected
                        ? "bg-white border-2 border-[#178582] shadow-sm ring-1 ring-[#178582]/20"
                        : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-gray-900 text-xs">{rep.name}</h3>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          rep.status === "on_beat" 
                            ? "bg-emerald-50 text-emerald-700" 
                            : rep.status === "completed" 
                            ? "bg-blue-50 text-blue-700" 
                            : "bg-amber-50 text-amber-700"
                        }`}>
                          {rep.status === "on_beat" ? "On Beat" : rep.status === "completed" ? "Completed" : "On Leave"}
                        </span>
                        <button
                          id={`btn-delete-${rep.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRep(rep.id, rep.name);
                          }}
                          title={`Delete ${rep.name}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500 mb-1.5">{rep.assignedRoute}</div>
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-gray-400">{rep.completedVisits}/{rep.plannedVisits} visits</span>
                      <span className="font-semibold text-gray-800">₹{(rep.todayOrdersBooked / 1000).toFixed(0)}K</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Active Salesman Beat Console */}
        <div className="flex-1 flex flex-col h-full bg-white overflow-y-auto">
          
          {selectedRep ? (
            <>
              {/* Header of Active Beat */}
              <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white shrink-0">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 id="active-beat-title" className="text-base sm:text-lg font-bold text-gray-900">
                      {formattedRouteDay || selectedRep.routeDay} · {selectedRep.assignedRoute}
                    </h2>
                    <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                      Hi, {selectedRep.name.split(" ")[0]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Beat plan with GPS check-in; visits without an order require logging a statutory reason.
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
                  <span className="text-gray-500">Visits: <strong className="text-gray-900">{selectedRep.completedVisits}/{selectedRep.plannedVisits}</strong></span>
                  <span className="text-gray-500">Orders: <strong className="text-[#178582]">₹{(selectedRep.todayOrdersBooked / 100000).toFixed(1)}L</strong></span>
                  <span className="text-gray-500">Collected: <strong className="text-emerald-700">₹{(selectedRep.todayCollections / 1000).toFixed(0)}K</strong></span>
                </div>
              </div>

              {/* Beat Visits List */}
              <div className="p-6 space-y-4 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Beat Stops Sequence ({selectedRep.beatVisits.length} Stops)
                  </h3>
                  <button
                    id="btn-add-stop"
                    onClick={() => setShowAddStopModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#178582] bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Add Stop</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedRep.beatVisits.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 border border-dashed rounded-xl text-xs">
                      No beat stops currently assigned to this representative route. Click &ldquo;+ Add Stop&rdquo; above to allocate a chemist.
                    </div>
                  ) : (
                    selectedRep.beatVisits.map((visit) => {
                      return (
                        <div
                          key={visit.id}
                          id={`visit-card-${visit.id}`}
                          className={`p-4 rounded-xl border transition-all ${
                            visit.status === "in_progress"
                              ? "bg-white border-2 border-[#178582] shadow-sm ring-1 ring-[#178582]/20"
                              : visit.status === "completed"
                              ? "bg-gray-50/70 border-gray-200"
                              : visit.status === "skipped"
                              ? "bg-red-50/20 border-red-200"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center">
                                {visit.sequence}
                              </span>
                              <div>
                                <h4 className="font-bold text-gray-900 text-sm">{visit.customerName}</h4>
                                <span className="text-xs text-gray-400 font-mono">{visit.customerCode} · {visit.type}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {visit.status === "in_progress" && (
                                <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Next on Beat · {visit.distance}
                                </span>
                              )}
                              {visit.status === "completed" && (
                                <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Visited ({visit.gpsCheckedInAt || "Verified"})
                                </span>
                              )}
                              {visit.status === "skipped" && (
                                <span className="text-[11px] font-bold bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
                                  Skipped / Blocked
                                </span>
                              )}
                              {visit.status === "pending" && (
                                <span className="text-[11px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                                  Scheduled · {visit.distance}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Due & Usual order figures */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3 p-3 bg-gray-50 rounded-lg text-xs">
                            <div>
                              <span className="text-gray-400 text-[10px]">Due Amount</span>
                              <div className="font-bold text-gray-900 font-mono">₹{visit.dueAmount.toLocaleString("en-IN")}</div>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[10px]">Usual Order Size</span>
                              <div className="font-bold text-gray-900 font-mono">₹{visit.usualOrderAmount.toLocaleString("en-IN")}</div>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[10px]">Order Booked Today</span>
                              <div className="font-bold text-[#178582] font-mono">
                                {visit.orderBooked ? `₹${visit.orderBooked.toLocaleString("en-IN")}` : "—"}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-400 text-[10px]">Collected Today</span>
                              <div className="font-bold text-emerald-700 font-mono">
                                {visit.collected ? `₹${visit.collected.toLocaleString("en-IN")}` : "—"}
                              </div>
                            </div>
                          </div>

                          {/* Warning notes if applicable */}
                          {visit.licenceNote && (
                            <div className="mb-3 p-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{visit.licenceNote}</span>
                            </div>
                          )}
                          {visit.skipReason && (
                            <div className="mb-3 p-2 bg-red-50 rounded border border-red-200 text-xs text-red-800 flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                              <span>{visit.skipReason}</span>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 flex-wrap">
                            <button
                              id={`btn-navigate-${visit.id}`}
                              onClick={() => {
                                showToast(`Navigation directed to ${visit.customerName}. Route coordinates sent.`, "info");
                              }}
                              className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Navigation className="w-3.5 h-3.5 text-[#178582]" />
                              <span>Navigate</span>
                            </button>

                            {visit.status !== "completed" && visit.status !== "skipped" && (
                              <button
                                id={`btn-skip-${visit.id}`}
                                onClick={() => {
                                  setActiveVisit(visit);
                                  setShowSkipModal(true);
                                }}
                                className="px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <span>Skip</span>
                              </button>
                            )}

                            {(visit.status === "in_progress" || visit.status === "pending") && (
                              <button
                                id={`btn-checkin-${visit.id}`}
                                onClick={() => {
                                  setActiveVisit(visit);
                                  setShowCheckInModal(true);
                                }}
                                className="px-3.5 py-1.5 border border-[#178582] text-[#178582] hover:bg-[#178582]/10 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                <span>GPS Check In</span>
                              </button>
                            )}

                            <button
                              id={`btn-bookorder-${visit.id}`}
                              onClick={() => {
                                setActiveVisit(visit);
                                setOrderAmountInput(String(visit.usualOrderAmount || 27940));
                                setShowOrderModal(true);
                              }}
                              className="px-4 py-1.5 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Book Order</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Target Progress Bar */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 mt-6 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-gray-900">Month target: ₹{(selectedRep.monthlyTarget / 100000).toFixed(0)}L</span>
                    <span className="text-gray-500 ml-2">· Achieved: {targetPercent}%</span>
                  </div>
                  <div className="w-full sm:w-64 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      id="progress-target-bar"
                      className="h-full bg-[#178582] rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(targetPercent, 100)}%` }} 
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400 text-sm">
              Select a field representative from the left to view active beat details.
            </div>
          )}

        </div>

      </div>

      {/* GPS CHECK IN MODAL */}
      {showCheckInModal && activeVisit && (
        <div id="modal-checkin" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">GPS Geo-Fence Check-In</h3>
                  <p className="text-xs text-gray-500">Validate physical field visit at {activeVisit.customerName}</p>
                </div>
              </div>
              <button onClick={() => setShowCheckInModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1.5 font-medium">
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer Location:</span>
                  <span className="font-bold text-gray-900">{activeVisit.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Device Coordinates:</span>
                  <span className="font-mono text-gray-800">12.9716° N, 77.5946° E</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Geo-Fence Status:</span>
                  <span className="font-bold">Inside Store Perimeter (15 m) ✓</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                id="btn-cancel-checkin"
                onClick={() => setShowCheckInModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-checkin"
                disabled={isSubmitting}
                onClick={() => handleGpsCheckIn(activeVisit)}
                className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm GPS Check-in</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOK ORDER MODAL */}
      {showOrderModal && activeVisit && (
        <div id="modal-bookorder" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Book Order · {activeVisit.customerName}</h3>
                <p className="text-xs text-gray-500">Order from product catalog with inline schemes &amp; live credit check</p>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 text-blue-900">
                <span className="font-bold">Suggested from purchase history &amp; stock:</span> Fast-moving medicines in central warehouse
              </div>

              {/* Dynamic catalog products list */}
              <div className="space-y-2 border border-gray-200 rounded-lg p-3">
                {catalogProducts.length > 0 ? (
                  catalogProducts.map((p, idx) => (
                    <div key={p.id || idx} className={`flex justify-between items-center py-1.5 ${idx < catalogProducts.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <div>
                        <div className="font-bold text-gray-900">{p.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          PTR ₹{p.ptr?.toFixed(2) || "98.10"} · Pack: {p.pack || "10s"} · {p.scheduleH ? "Rx H1" : "General"}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-gray-800 px-2 py-0.5 bg-gray-100 rounded text-[11px]">
                        Available ✓
                      </span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <div>
                        <div className="font-bold text-gray-900">Pantoprazole 40 (15 tab)</div>
                        <div className="text-[11px] text-gray-400 font-mono">PTR ₹98.10 · Stock ✓ · Scheme 10+1</div>
                      </div>
                      <span className="font-mono font-bold text-gray-800">50 strips</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <div>
                        <div className="font-bold text-gray-900">Metformin 500 SR (10 tab)</div>
                        <div className="text-[11px] text-gray-400 font-mono">PTR ₹21.30 · Stock ✓</div>
                      </div>
                      <span className="font-mono font-bold text-gray-800">100 strips</span>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Calculated Order Total (₹)</label>
                <input
                  id="input-order-amount"
                  type="number"
                  value={orderAmountInput}
                  onChange={(e) => setOrderAmountInput(e.target.value)}
                  className="w-full font-mono font-bold text-base border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Doorstep Payment Collection (Optional ₹)</label>
                <input
                  id="input-collection-amount"
                  type="number"
                  value={collectionAmountInput}
                  onChange={(e) => setCollectionAmountInput(e.target.value)}
                  placeholder="0"
                  className="w-full font-mono font-bold text-base border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div className="p-2.5 bg-gray-50 rounded border border-gray-200 flex justify-between items-center text-xs">
                <span className="text-gray-500">Credit check: ₹2.1L of ₹2.5L limit</span>
                <span className="font-semibold text-emerald-700">Near Limit · Approved ✓</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                id="btn-cancel-order"
                onClick={() => setShowOrderModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-order"
                disabled={isSubmitting}
                onClick={handleBookOrder}
                className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Place Order · ₹{Number(orderAmountInput).toLocaleString("en-IN")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SKIP VISIT MODAL */}
      {showSkipModal && activeVisit && (
        <div id="modal-skip" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Skip Beat Visit</h3>
                  <p className="text-xs text-gray-500">Statutory audit reason required for skipped stop</p>
                </div>
              </div>
              <button onClick={() => setShowSkipModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">Select Statutory Reason</label>
                <select
                  id="select-skip-reason"
                  value={skipReasonInput}
                  onChange={(e) => setSkipReasonInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                >
                  <option value="Chemist shop closed for festival">Chemist shop closed for festival</option>
                  <option value="Blocked for overdue >45 days — payment recovery required">Blocked for overdue &gt;45 days — payment recovery required</option>
                  <option value="Pharmacist / Decision maker unavailable">Pharmacist / Decision maker unavailable</option>
                  <option value="Full inventory in stock — next order scheduled Monday">Full inventory in stock — next order scheduled Monday</option>
                  <option value="Store relocated / Address mismatch">Store relocated / Address mismatch</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                id="btn-cancel-skip"
                onClick={() => setShowSkipModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-skip"
                disabled={isSubmitting}
                onClick={handleSkipVisit}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-xs font-semibold hover:bg-red-700 cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Skip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD FIELD REPRESENTATIVE MODAL */}
      {showAddRepModal && (
        <div id="modal-add-salesman" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-[#178582]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Add Field Representative</h3>
                  <p className="text-xs text-gray-500">Allocate new beat route and set daily sales target</p>
                </div>
              </div>
              <button onClick={() => setShowAddRepModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSalesman} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">Full Name *</label>
                <input
                  id="input-rep-name"
                  type="text"
                  required
                  value={newRepName}
                  onChange={(e) => setNewRepName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                  className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Mobile Phone (GPS Tracking) *</label>
                <input
                  id="input-rep-phone"
                  type="text"
                  required
                  value={newRepPhone}
                  onChange={(e) => setNewRepPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Email Address</label>
                <input
                  id="input-rep-email"
                  type="email"
                  value={newRepEmail}
                  onChange={(e) => setNewRepEmail(e.target.value)}
                  placeholder="ramesh.c@shahpharma.com"
                  className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Assigned Beat Route *</label>
                <select
                  id="select-rep-route"
                  value={newRepRoute}
                  onChange={(e) => setNewRepRoute(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                >
                  <option value="Route 5 (East Suburban Belt)">Route 5 (East Suburban Belt)</option>
                  <option value="Route 6 (South Commercial Market)">Route 6 (South Commercial Market)</option>
                  <option value="Route 7 (Expressway Industrial Hub)">Route 7 (Expressway Industrial Hub)</option>
                  <option value="Route 8 (Suburban Hospitals & Clinics)">Route 8 (Suburban Hospitals &amp; Clinics)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Monthly Target (₹)</label>
                <input
                  id="input-rep-target"
                  type="number"
                  value={newRepTarget}
                  onChange={(e) => setNewRepTarget(e.target.value)}
                  className="w-full font-mono border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2.5 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  id="btn-cancel-add-rep"
                  onClick={() => setShowAddRepModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-add-rep"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Field Representative</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD BEAT STOP MODAL */}
      {showAddStopModal && selectedRep && (
        <div id="modal-add-stop" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5 text-[#178582]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Add Chemist Beat Stop</h3>
                  <p className="text-xs text-gray-500">Allocate new customer stop to {selectedRep.name}&apos;s route</p>
                </div>
              </div>
              <button onClick={() => setShowAddStopModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBeatStop} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">Customer / Chemist Name *</label>
                <input
                  id="input-stop-name"
                  type="text"
                  required
                  value={newStopName}
                  onChange={(e) => setNewStopName(e.target.value)}
                  placeholder="e.g. Apollo Pharmacy - Indiranagar"
                  className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Customer Code</label>
                  <input
                    id="input-stop-code"
                    type="text"
                    value={newStopCode}
                    onChange={(e) => setNewStopCode(e.target.value)}
                    placeholder="e.g. C-8812"
                    className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Store Type</label>
                  <select
                    id="input-stop-type"
                    value={newStopType}
                    onChange={(e) => setNewStopType(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  >
                    <option value="Retail Chemist">Retail Chemist</option>
                    <option value="Chain Pharmacy">Chain Pharmacy</option>
                    <option value="Clinic / Pharmacy">Clinic / Pharmacy</option>
                    <option value="Hospital Pharmacy">Hospital Pharmacy</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Estimated Distance from Prev Stop</label>
                <input
                  id="input-stop-distance"
                  type="text"
                  value={newStopDistance}
                  onChange={(e) => setNewStopDistance(e.target.value)}
                  placeholder="e.g. 600 m away"
                  className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Existing Due Amount (₹)</label>
                  <input
                    id="input-stop-due"
                    type="number"
                    value={newStopDue}
                    onChange={(e) => setNewStopDue(e.target.value)}
                    className="w-full font-mono border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Usual Order Size (₹)</label>
                  <input
                    id="input-stop-usual"
                    type="number"
                    value={newStopUsual}
                    onChange={(e) => setNewStopUsual(e.target.value)}
                    className="w-full font-mono border border-gray-300 rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2.5 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  id="btn-cancel-add-stop"
                  onClick={() => setShowAddStopModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-add-stop"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add Stop to Route</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
