"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  Snowflake,
  ShieldCheck,
  Check,
  X,
  Sparkles,
  Printer,
  Barcode,
  Search,
  ScanLine,
  Plus,
  Download,
  Loader2,
  PackageCheck
} from "lucide-react";
import { pharmaApi } from "@/lib/api";

interface PickWaveItem {
  id: string;
  binLocation: string;
  productName: string;
  pack: string;
  billedBatch: string;
  expiryDate: string;
  qty: number;
  freeQty: number | string;
  isColdChain?: boolean;
  status: "picked" | "pending" | "mismatch";
  scannedBatch?: string | null;
  mismatchNote?: string | null;
}

interface PickWave {
  id: string;
  trayId: string;
  invoiceNo: string;
  customerName: string;
  linesCount: number;
  totalUnits: number;
  route: string;
  vanAssigned: string;
  weightKg: number;
  boxesCount: number;
  status: "picking" | "checking" | "sealed" | "dispatched";
  isColdChainRequired?: boolean;
  items: PickWaveItem[];
  createdAt?: string;
}

interface WarehouseStats {
  orderToDispatchMedian: string;
  slaTargetMinutes: number;
  pickAccuracyPercent: number;
  totalActiveWaves: number;
  pickingCount: number;
  checkingCount: number;
  sealedCount: number;
  dispatchedCount: number;
  coldChainStagedBoxes: number;
  totalItemsCount: number;
  verifiedItemsCount: number;
  pendingItemsCount: number;
  mismatchItemsCount: number;
}

export default function WarehousePage() {
  const [waves, setWaves] = useState<PickWave[]>([]);
  const [stats, setStats] = useState<WarehouseStats | null>(null);
  const [selectedWaveId, setSelectedWaveId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [activeFilter, setActiveFilter] = useState<"all" | "picking" | "checking" | "sealed" | "dispatched">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showNewWaveModal, setShowNewWaveModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedScanItem, setSelectedScanItem] = useState<PickWaveItem | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // New Wave Form State
  const [formInvoiceNo, setFormInvoiceNo] = useState("");
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formRoute, setFormRoute] = useState("Route 3");
  const [formVan, setFormVan] = useState("Van KA-01-MJ-4410");
  const [formWeight, setFormWeight] = useState("12.5");
  const [formBoxes, setFormBoxes] = useState("2");
  const [formColdChain, setFormColdChain] = useState(false);
  const [formItemProduct, setFormItemProduct] = useState("Augmentin 625 Duo");
  const [formItemBatch, setFormItemBatch] = useState("AG2508");
  const [formItemQty, setFormItemQty] = useState("60");
  const [isCreatingWave, setIsCreatingWave] = useState(false);

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

  // Fetch live warehouse data from PostgreSQL
  const refreshWarehouseData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [wavesRes, statsRes] = await Promise.all([
        pharmaApi.getWaves(),
        pharmaApi.getWarehouseStats()
      ]);

      if (wavesRes?.waves) {
        setWaves(wavesRes.waves);
      }
      if (statsRes?.stats) {
        setStats(statsRes.stats);
      }
    } catch (err: unknown) {
      console.error("Error loading warehouse data:", err);
      const msg = err instanceof Error ? err.message : "Failed to fetch warehouse waves from server.";
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
        const [wavesRes, statsRes] = await Promise.all([
          pharmaApi.getWaves(),
          pharmaApi.getWarehouseStats()
        ]);
        if (!isMounted) return;
        if (wavesRes?.waves) {
          setWaves(wavesRes.waves);
          setSelectedWaveId((curr) => curr || wavesRes.waves[0]?.id || "");
        }
        if (statsRes?.stats) {
          setStats(statsRes.stats);
        }
      } catch (err: unknown) {
        console.error("Initial warehouse load error:", err);
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

  // Selected Wave (derived)
  const selectedWave = useMemo(() => {
    return waves.find((w) => w.id === selectedWaveId) || waves[0] || null;
  }, [waves, selectedWaveId]);

  // Filtered Waves
  const filteredWaves = useMemo(() => {
    return waves.filter((w) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        w.trayId.toLowerCase().includes(q) ||
        w.invoiceNo.toLowerCase().includes(q) ||
        w.customerName.toLowerCase().includes(q) ||
        w.route.toLowerCase().includes(q) ||
        w.vanAssigned.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (activeFilter === "picking") return w.status === "picking";
      if (activeFilter === "checking") return w.status === "checking";
      if (activeFilter === "sealed") return w.status === "sealed";
      if (activeFilter === "dispatched") return w.status === "dispatched";

      return true;
    });
  }, [waves, searchQuery, activeFilter]);

  // Tab Counts
  const tabCounts = useMemo(() => {
    return {
      all: waves.length,
      checking: waves.filter((w) => w.status === "checking").length,
      picking: waves.filter((w) => w.status === "picking").length,
      sealed: waves.filter((w) => w.status === "sealed").length,
      dispatched: waves.filter((w) => w.status === "dispatched").length
    };
  }, [waves]);

  // Barcode Scan Handler
  const handleSimulateScan = async () => {
    if (!barcodeInput.trim()) {
      showToast("Please enter a batch number or barcode string to scan.", "warning");
      return;
    }

    try {
      setIsProcessingScan(true);
      const res = await pharmaApi.scanBarcode({
        itemId: selectedScanItem ? selectedScanItem.id : undefined,
        waveId: selectedWave?.id,
        scannedBatch: barcodeInput.trim()
      });

      if (res?.success) {
        if (res.match) {
          showToast(res.message || `Batch ${barcodeInput} verified successfully!`, "success");
        } else {
          showToast(res.message || `Batch mismatch: Scanned ${barcodeInput} differs from billed batch.`, "warning");
        }
        setShowScannerModal(false);
        setBarcodeInput("");
        setSelectedScanItem(null);
        await refreshWarehouseData();
      } else {
        showToast(res?.error || "Barcode verification failed.", "warning");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error processing barcode scan.";
      showToast(msg, "warning");
    } finally {
      setIsProcessingScan(false);
    }
  };

  // Seal Box & Print e-Way Bill Label
  const handleSealAndPrint = async (force: boolean = false) => {
    if (!selectedWave) return;

    try {
      setIsSealing(true);
      const res = await pharmaApi.sealWaveTote(selectedWave.id, force);

      if (res?.success) {
        showToast(
          res.message || `Boxes sealed for ${selectedWave.customerName}! Outer shipping label and e-Way barcode printed.`,
          "success"
        );
        await refreshWarehouseData();
      } else {
        showToast(res?.error || "Failed to seal tote.", "warning");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Server error while sealing tote.";
      showToast(msg, "warning");
    } finally {
      setIsSealing(false);
    }
  };

  // Dispatch Wave to Delivery Van
  const handleDispatchToVan = async () => {
    if (!selectedWave) return;

    try {
      setIsDispatching(true);
      const res = await pharmaApi.dispatchWaveToVan(selectedWave.id);

      if (res?.success) {
        showToast(
          res.message || `Tray ${selectedWave.trayId} dispatched to ${selectedWave.vanAssigned}!`,
          "success"
        );
        await refreshWarehouseData();
      } else {
        showToast(res?.error || "Failed to dispatch wave to van.", "warning");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Server error dispatching wave.";
      showToast(msg, "warning");
    } finally {
      setIsDispatching(false);
    }
  };

  // Create New Pick Wave
  const handleCreateWave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formInvoiceNo.trim() || !formCustomerName.trim()) {
      showToast("Invoice No and Customer Name are required.", "warning");
      return;
    }

    try {
      setIsCreatingWave(true);
      const randomTrayNum = Math.floor(15 + Math.random() * 80);
      const res = await pharmaApi.createPickWave({
        trayId: `Tray ${randomTrayNum} · Bin A-01-2`,
        invoiceNo: formInvoiceNo.trim(),
        customerName: formCustomerName.trim(),
        route: formRoute,
        vanAssigned: formVan,
        weightKg: Number(formWeight) || 12.0,
        boxesCount: Number(formBoxes) || 2,
        isColdChainRequired: formColdChain,
        items: [
          {
            binLocation: formColdChain ? "Cold-Room-C1" : "A-01-2",
            productName: formItemProduct.trim() || "Amoxicillin 500mg",
            pack: "10 tab",
            billedBatch: formItemBatch.trim() || "AG2508",
            expiryDate: "08/27",
            qty: Number(formItemQty) || 50,
            freeQty: "5",
            isColdChain: formColdChain,
            status: "pending"
          }
        ]
      });

      if (res?.success) {
        showToast(res.message || "New pick wave generated and queued for picking!", "success");
        setShowNewWaveModal(false);
        setFormInvoiceNo("");
        setFormCustomerName("");
        if (res.wave?.id) {
          setSelectedWaveId(res.wave.id);
        }
        await refreshWarehouseData();
      } else {
        showToast(res?.error || "Failed to create pick wave.", "warning");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Server error creating pick wave.";
      showToast(msg, "warning");
    } finally {
      setIsCreatingWave(false);
    }
  };

  // Download Manifest CSV
  const handleDownloadCsv = () => {
    try {
      const url = pharmaApi.getExportWarehouseUrl();
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "warehouse_dispatch_manifest_2026.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Warehouse dispatch manifest downloaded as CSV.", "info");
    } catch {
      showToast("Failed to download warehouse manifest CSV.", "warning");
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
                Warehouse Dispatch, Picking &amp; Checking
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <Barcode className="w-3.5 h-3.5 text-blue-600" />
                Live PostgreSQL Warehouse Synced
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Bin-sorted pick paths, batch-wise barcode scanning, cold-room box staging, and 2-hour order-to-dispatch SLA.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/billing"
              className="px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-100 transition-colors"
            >
              ← Billed Invoices
            </Link>
            <Link
              href="/delivery"
              className="px-3 py-2 bg-purple-50 border border-purple-200 text-purple-700 rounded-md text-xs font-semibold hover:bg-purple-100 transition-colors"
            >
              Van Delivery Manifest →
            </Link>
            <button
              id="export-warehouse-btn"
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
              title="Download CSV Manifest"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span>Export CSV</span>
            </button>
            <button
              id="btn-new-wave"
              onClick={() => setShowNewWaveModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-xs sm:text-sm font-semibold hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#178582]" />
              <span>New Pick Wave</span>
            </button>
            <button
              id="btn-barcode-check"
              onClick={() => {
                setSelectedScanItem(null);
                setBarcodeInput("");
                setShowScannerModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-xs sm:text-sm font-semibold hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
            >
              <ScanLine className="w-4 h-4 text-[#178582]" />
              <span>Barcode Check</span>
            </button>
            <button
              id="btn-verify-seal"
              onClick={() => handleSealAndPrint(false)}
              disabled={isSealing || !selectedWave || selectedWave.status === "sealed" || selectedWave.status === "dispatched"}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors shadow-sm cursor-pointer ${
                !selectedWave || selectedWave.status === "sealed" || selectedWave.status === "dispatched"
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-[#178582] text-white hover:bg-[#126b68] active:scale-95"
              }`}
            >
              {isSealing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              <span>Verify &amp; Seal ({selectedWave?.boxesCount || 0} Boxes)</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Stat Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Order-to-Dispatch Median</div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5" id="metric-order-dispatch-time">
              {stats?.orderToDispatchMedian || "1h 14m"}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">SLA Target: &le; 2.0 hours</div>
          </div>
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Pick Accuracy (Scanning)</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5" id="metric-pick-accuracy">
              {stats?.pickAccuracyPercent ? `${stats.pickAccuracyPercent}%` : "99.88%"}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Zero wrong-batch dispatch</div>
          </div>
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Active Pick Trays</div>
            <div className="text-lg font-bold text-amber-700 mt-0.5" id="metric-active-trays">
              {stats?.totalActiveWaves ? `${stats.totalActiveWaves} Trays` : "5 Trays"}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {stats?.pickingCount || 0} picking · {stats?.checkingCount || 0} checking · {stats?.sealedCount || 0} sealed
            </div>
          </div>
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Cold-Chain Staging</div>
            <div className="text-lg font-bold text-blue-700 mt-0.5" id="metric-cold-chain-boxes">
              {stats?.coldChainStagedBoxes ? `${stats.coldChainStagedBoxes} Insulated Boxes` : "4 Insulated Boxes"}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Packed last with ice-gel packs</div>
          </div>
        </div>
      </header>

      {/* Main Split Layout: Left Trays Queue, Right Tray Checker */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Trays & Waves List */}
        <div className="w-full lg:w-[370px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-[#fbfcfd] flex flex-col max-h-[300px] lg:max-h-full">
          <div className="p-3.5 border-b border-gray-200 bg-white space-y-2.5">
            {/* Filter Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
              <button
                id="filter-tab-all"
                onClick={() => setActiveFilter("all")}
                className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded transition-all cursor-pointer text-center whitespace-nowrap ${
                  activeFilter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All ({tabCounts.all})
              </button>
              <button
                id="filter-tab-checking"
                onClick={() => setActiveFilter("checking")}
                className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded transition-all cursor-pointer text-center whitespace-nowrap ${
                  activeFilter === "checking" ? "bg-white text-amber-800 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Checking ({tabCounts.checking})
              </button>
              <button
                id="filter-tab-picking"
                onClick={() => setActiveFilter("picking")}
                className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded transition-all cursor-pointer text-center whitespace-nowrap ${
                  activeFilter === "picking" ? "bg-white text-blue-800 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Picking ({tabCounts.picking})
              </button>
              <button
                id="filter-tab-sealed"
                onClick={() => setActiveFilter("sealed")}
                className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded transition-all cursor-pointer text-center whitespace-nowrap ${
                  activeFilter === "sealed" ? "bg-white text-emerald-800 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Sealed ({tabCounts.sealed})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                id="warehouse-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Tray, Invoice, Chemist, Route..."
                className="pl-8 pr-3 py-1.5 w-full rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#178582] bg-white text-gray-900 font-medium"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5" id="waves-list-container">
            {isLoading && waves.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#178582] mb-2" />
                Loading pick waves from PostgreSQL...
              </div>
            ) : filteredWaves.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-xs">
                No warehouse pick waves found matching the selected filters.
              </div>
            ) : (
              filteredWaves.map((wave) => {
                const isSelected = wave.id === selectedWave?.id;
                return (
                  <div
                    key={wave.id}
                    id={`wave-card-${wave.id}`}
                    onClick={() => setSelectedWaveId(wave.id)}
                    className={`p-3.5 rounded-lg transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-white border-2 border-[#178582] shadow-md ring-1 ring-[#178582]/20"
                        : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-gray-900 text-xs sm:text-sm">{wave.trayId}</h3>
                        <span className="font-mono text-[11px] text-gray-400">· {wave.invoiceNo}</span>
                      </div>
                      {wave.status === "checking" && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase">
                          Checking
                        </span>
                      )}
                      {wave.status === "picking" && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded uppercase">
                          Picking
                        </span>
                      )}
                      {wave.status === "sealed" && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded uppercase">
                          Sealed ✓
                        </span>
                      )}
                      {wave.status === "dispatched" && (
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded uppercase">
                          On Van 🚚
                        </span>
                      )}
                    </div>

                    <p className="font-semibold text-gray-800 text-xs mb-0.5">{wave.customerName}</p>
                    <p className="text-[11px] text-gray-500 mb-2">
                      {wave.route} · {wave.vanAssigned}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-600 font-medium">
                      <span>
                        {wave.linesCount} lines · {wave.totalUnits} units
                      </span>
                      <span>
                        {wave.boxesCount} boxes · {wave.weightKg} kg
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Tray Verification & Pick Path Workspace */}
        <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
          {selectedWave ? (
            <>
              {/* Active Tray Summary Header */}
              <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900" id="active-tray-title">
                      Checking &amp; Verification — {selectedWave.trayId}
                    </h2>
                    <span className="font-mono text-xs sm:text-sm font-semibold text-gray-500">
                      {selectedWave.invoiceNo} · {selectedWave.customerName}
                    </span>
                    {selectedWave.isColdChainRequired && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                        <Snowflake className="w-3 h-3 text-blue-600" /> Cold-Room Box Required
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Scan every SKU barcode before sealing. Pick path optimized by rack hierarchy: Aisle &rarr; Rack &rarr; Bin.
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <div className="text-xs text-gray-400">Consignment Weight</div>
                  <div className="text-base sm:text-lg font-bold text-gray-900 font-mono">
                    {selectedWave.weightKg} kg · {selectedWave.boxesCount} Boxes
                  </div>
                </div>
              </div>

              {/* Alert if Mismatch Found */}
              {selectedWave.items.some((it) => it.status === "mismatch") && (
                <div
                  id="batch-mismatch-alert"
                  className="bg-red-50 border-b border-red-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-red-700 font-medium"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>
                      <strong>Batch Mismatch Warning:</strong> Physical tray contains mismatched stock.
                      Correct batches before outer carton sealing.
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const mismatchItem = selectedWave.items.find((it) => it.status === "mismatch");
                      if (mismatchItem) {
                        setSelectedScanItem(mismatchItem);
                        setBarcodeInput(mismatchItem.billedBatch);
                      }
                      setShowScannerModal(true);
                    }}
                    className="underline text-red-800 hover:text-red-950 font-bold cursor-pointer shrink-0"
                  >
                    Scan Correct Billed Batch
                  </button>
                </div>
              )}

              {/* Verification Table */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[700px]" id="verification-table">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-200 uppercase font-semibold text-[11px]">
                        <th className="pb-3 pr-3">Pick Bin</th>
                        <th className="pb-3 px-3">Product Description</th>
                        <th className="pb-3 px-3">Billed Batch</th>
                        <th className="pb-3 px-3">Expiry</th>
                        <th className="pb-3 px-3">Billed Qty</th>
                        <th className="pb-3 px-3">Free Qty</th>
                        <th className="pb-3 px-3">Verification Scan</th>
                        <th className="pb-3 px-3 text-center">Status</th>
                        <th className="pb-3 pl-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-900 font-medium">
                      {selectedWave.items.map((item) => {
                        return (
                          <tr key={item.id} id={`item-row-${item.id}`} className="hover:bg-gray-50/70 transition-colors">
                            {/* Pick Bin */}
                            <td className="py-3 font-mono font-bold text-gray-900">
                              <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-800">{item.binLocation}</span>
                            </td>

                            {/* Product */}
                            <td className="py-3">
                              <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                                <span>{item.productName}</span>
                                {item.isColdChain && <Snowflake className="w-3 h-3 text-blue-600" />}
                              </div>
                              <div className="text-[11px] text-gray-400 font-normal">Pack: {item.pack}</div>
                            </td>

                            {/* Billed Batch */}
                            <td className="py-3 font-mono font-bold text-gray-900">{item.billedBatch}</td>

                            {/* Expiry */}
                            <td className="py-3 font-mono text-gray-600">{item.expiryDate}</td>

                            {/* Qty */}
                            <td className="py-3 font-mono font-bold text-gray-900">{item.qty}</td>

                            {/* Free */}
                            <td className="py-3 font-mono text-emerald-700">{item.freeQty}</td>

                            {/* Scanned Batch */}
                            <td className="py-3 font-mono">
                              {item.scannedBatch ? (
                                <span
                                  className={
                                    item.status === "mismatch"
                                      ? "text-red-600 font-bold"
                                      : "text-emerald-700 font-semibold"
                                  }
                                >
                                  {item.scannedBatch}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">Pending scan</span>
                              )}
                              {item.mismatchNote && (
                                <div className="text-[10px] text-red-500 font-sans mt-0.5">{item.mismatchNote}</div>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3 text-center">
                              {item.status === "picked" && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-600" /> Verified
                                </span>
                              )}
                              {item.status === "mismatch" && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-300">
                                  Wrong Batch
                                </span>
                              )}
                              {item.status === "pending" && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  Pending Scan
                                </span>
                              )}
                            </td>

                            {/* Action */}
                            <td className="py-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedScanItem(item);
                                  setBarcodeInput(item.billedBatch);
                                  setShowScannerModal(true);
                                }}
                                className="px-2 py-1 text-[11px] font-semibold border border-gray-200 rounded text-[#178582] hover:bg-teal-50 cursor-pointer transition-colors"
                              >
                                Scan SKU
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Bar: Boxes, Weight & Outer Consignment Label */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 text-gray-600 flex-wrap">
                  <span>
                    Boxes: <strong className="text-gray-900">{selectedWave.boxesCount}</strong>
                  </span>
                  <span>
                    Weight: <strong className="text-gray-900">{selectedWave.weightKg} kg</strong>
                  </span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Shipping label + e-Way bill ready for printer
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {selectedWave.status !== "dispatched" && (
                    <button
                      id="btn-dispatch-van"
                      onClick={handleDispatchToVan}
                      disabled={isDispatching}
                      className="px-3.5 py-1.5 bg-[#0c2427] text-white hover:bg-[#153a3e] rounded font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isDispatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5 text-teal-400" />}
                      <span>Dispatch to Van →</span>
                    </button>
                  )}
                  <button
                    id="btn-print-label"
                    onClick={() => setShowLabelModal(true)}
                    className="px-3.5 py-1.5 border border-gray-300 rounded font-semibold text-gray-700 hover:bg-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Box Label</span>
                  </button>
                  <button
                    onClick={() => handleSealAndPrint(false)}
                    disabled={isSealing || selectedWave.status === "sealed" || selectedWave.status === "dispatched"}
                    className={`px-4 py-1.5 rounded font-semibold flex items-center gap-1.5 shadow-sm ${
                      selectedWave.status === "sealed" || selectedWave.status === "dispatched"
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-[#178582] text-white hover:bg-[#126b68] cursor-pointer active:scale-95"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Seal Tray &amp; Stage</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
              Select a pick wave from the left to begin checking &amp; verification.
            </div>
          )}
        </div>
      </div>

      {/* BARCODE SCANNER MODAL */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <ScanLine className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Scan Product / Batch Barcode</h3>
                  <p className="text-xs text-gray-500">Warehouse scanner integration emulator</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowScannerModal(false);
                  setSelectedScanItem(null);
                }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {selectedScanItem && (
                <div className="bg-teal-50/70 p-3 rounded-lg border border-teal-200 text-teal-900">
                  <div className="font-bold text-xs">{selectedScanItem.productName}</div>
                  <div className="text-[11px] text-teal-700 mt-0.5">
                    Bin: <span className="font-mono font-bold">{selectedScanItem.binLocation}</span> · Expected Batch:{" "}
                    <span className="font-mono font-bold">{selectedScanItem.billedBatch}</span> (Exp:{" "}
                    {selectedScanItem.expiryDate})
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-800 mb-1">Enter Barcode or Batch String *</label>
                <input
                  id="modal-barcode-input"
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="e.g. AZ2412 or 890104388129"
                  className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-mono font-bold focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-gray-600">
                <div className="font-semibold text-gray-800 mb-1.5">Quick Emulator Presets:</div>
                <div className="flex gap-2 flex-wrap">
                  {selectedScanItem ? (
                    <>
                      <button
                        onClick={() => setBarcodeInput(selectedScanItem.billedBatch)}
                        className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 rounded text-[11px] font-mono hover:bg-emerald-50 cursor-pointer font-bold"
                      >
                        ✓ Correct: {selectedScanItem.billedBatch}
                      </button>
                      <button
                        onClick={() => setBarcodeInput(`WRONG-${selectedScanItem.billedBatch}`)}
                        className="px-2.5 py-1 bg-white border border-red-300 text-red-800 rounded text-[11px] font-mono hover:bg-red-50 cursor-pointer font-bold"
                      >
                        ⚠ Wrong Batch
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setBarcodeInput("AZ2412")}
                        className="px-2.5 py-1 bg-white border border-gray-300 rounded text-[11px] font-mono text-gray-800 hover:bg-gray-100 cursor-pointer"
                      >
                        Set: AZ2412 (Azithromycin)
                      </button>
                      <button
                        onClick={() => setBarcodeInput("PN2502")}
                        className="px-2.5 py-1 bg-white border border-gray-300 rounded text-[11px] font-mono text-gray-800 hover:bg-gray-100 cursor-pointer"
                      >
                        Set: PN2502 (Pantoprazole)
                      </button>
                      <button
                        onClick={() => setBarcodeInput("MF2511")}
                        className="px-2.5 py-1 bg-white border border-gray-300 rounded text-[11px] font-mono text-gray-800 hover:bg-gray-100 cursor-pointer"
                      >
                        Set: MF2511 (Metformin)
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setShowScannerModal(false);
                  setSelectedScanItem(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="modal-process-scan-btn"
                onClick={handleSimulateScan}
                disabled={isProcessingScan}
                className="px-4 py-2 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingScan && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Process Barcode Scan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW PICK WAVE MODAL */}
      {showNewWaveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-[#178582]" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Generate Warehouse Pick Wave</h3>
                  <p className="text-xs text-gray-500">Initiate tray assignment &amp; bin-sorted pick sequence</p>
                </div>
              </div>
              <button onClick={() => setShowNewWaveModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Invoice Number *</label>
                  <input
                    id="modal-input-invoice"
                    type="text"
                    required
                    placeholder="e.g. INV-26-58910"
                    value={formInvoiceNo}
                    onChange={(e) => setFormInvoiceNo(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-gray-900 font-mono text-xs focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Customer / Chemist *</label>
                  <input
                    id="modal-input-customer"
                    type="text"
                    required
                    placeholder="e.g. Sri Sai Medicals"
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-gray-900 text-xs focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Delivery Route</label>
                  <select
                    value={formRoute}
                    onChange={(e) => setFormRoute(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-gray-900 text-xs bg-white focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  >
                    <option value="Route 1">Route 1 (Central CBD)</option>
                    <option value="Route 2">Route 2 (Whitefield)</option>
                    <option value="Route 3">Route 3 (Indiranagar / Koramangala)</option>
                    <option value="Hospital Express Beat">Hospital Express Beat</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Assigned Delivery Van</label>
                  <select
                    value={formVan}
                    onChange={(e) => setFormVan(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-gray-900 text-xs bg-white focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  >
                    <option value="Van KA-01-MJ-4410">Van KA-01-MJ-4410 · Ramesh Kumar</option>
                    <option value="Van KA-02-AB-3391">Van KA-02-AB-3391 · Mahesh Rao</option>
                    <option value="Reefer Van KA-04-MH-2009">Reefer Van KA-04-MH-2009 · Suresh V</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Consignment Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-gray-900 font-mono text-xs focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Outer Cartons (Boxes)</label>
                  <input
                    type="number"
                    min="1"
                    value={formBoxes}
                    onChange={(e) => setFormBoxes(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-gray-900 font-mono text-xs focus:ring-2 focus:ring-[#178582] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="modal-coldchain-check"
                  checked={formColdChain}
                  onChange={(e) => setFormColdChain(e.target.checked)}
                  className="rounded text-[#178582] focus:ring-[#178582]"
                />
                <label htmlFor="modal-coldchain-check" className="font-semibold text-gray-800 cursor-pointer">
                  Requires 2°C–8°C Cold-Chain Insulated Box Staging
                </label>
              </div>

              <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-2">
                <div className="font-bold text-gray-800">Sample SKU Line to Pick</div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Product Name"
                    value={formItemProduct}
                    onChange={(e) => setFormItemProduct(e.target.value)}
                    className="border border-gray-300 rounded p-1.5 bg-white text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Billed Batch"
                    value={formItemBatch}
                    onChange={(e) => setFormItemBatch(e.target.value)}
                    className="border border-gray-300 rounded p-1.5 bg-white text-xs font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={formItemQty}
                    onChange={(e) => setFormItemQty(e.target.value)}
                    className="border border-gray-300 rounded p-1.5 bg-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowNewWaveModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="modal-submit-wave-btn"
                  type="submit"
                  disabled={isCreatingWave}
                  className="px-4 py-2 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isCreatingWave && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate Pick Wave</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* THERMAL CARTON LABEL PREVIEW MODAL */}
      {showLabelModal && selectedWave && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-2 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">Thermal Shipping Label (4x6&quot;)</h3>
              <button onClick={() => setShowLabelModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 p-4 border-2 border-black rounded font-mono text-xs bg-white text-black space-y-2">
              <div className="text-center font-bold text-sm border-b border-black pb-1">
                SHAH PHARMA LOGISTICS
              </div>
              <div className="flex justify-between">
                <span>Tray: <strong>{selectedWave.trayId.split("·")[0]}</strong></span>
                <span>Boxes: <strong>1 of {selectedWave.boxesCount}</strong></span>
              </div>
              <div>Consignee: <strong>{selectedWave.customerName}</strong></div>
              <div>Invoice: <strong>{selectedWave.invoiceNo}</strong></div>
              <div>Route: <strong>{selectedWave.route}</strong></div>
              <div>Van: <strong>{selectedWave.vanAssigned}</strong></div>
              <div>Gross Wt: <strong>{selectedWave.weightKg} kg</strong></div>
              {selectedWave.isColdChainRequired && (
                <div className="p-1 border border-black text-center font-bold">
                  ❄ 2°C - 8°C REEFER COLD CHAIN ❄
                </div>
              )}
              <div className="pt-2 text-center border-t border-dashed border-black">
                <div className="text-[10px] tracking-widest">||||| | |||| ||| |||||| |||||</div>
                <div className="text-[9px] mt-0.5">EWB-2026-9041284-A1</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  window.print();
                  showToast("Carton label sent to thermal printer.", "info");
                  setShowLabelModal(false);
                }}
                className="px-3.5 py-1.5 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Thermal Label</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
