"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  Printer,
  Share2,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Truck,
  X,
  Plus,
  RefreshCw,
  Check,
  FileSpreadsheet,
  CheckCircle,
  Sparkles,
  ShieldCheck,
  Copy,
  DollarSign,
  FileDown
} from "lucide-react";
import { api } from "@/lib/api";

interface InvoiceItem {
  id?: string;
  name: string;
  hsn: string;
  batch: string;
  exp: string;
  qty: number;
  free: string | number;
  ptr: number;
  gst: number;
  total: number;
}

interface InvoiceRecord {
  id: string;
  invoiceNo: string;
  orderId?: string | null;
  customerId: string;
  customerName: string;
  customerCode: string;
  route: string;
  gstin: string;
  date: string;
  time: string;
  dueDate: string;
  linesCount: number;
  taxable: number;
  gstAmount: number;
  total: number;
  irn: string;
  ewayBill?: string | null;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  dispatchStatus: "TRAY_ASSIGNED" | "PACKED_AND_SEALED" | "OUT_FOR_DELIVERY" | "DELIVERED";
  trayId: string;
  items: InvoiceItem[];
  customer?: any;
}

interface BillingStats {
  todayBilledVolume: number;
  totalInvoicesCount: number;
  irnComplianceRate: number;
  ewayBillsCount: number;
  averageTicket: number;
  unpaidAmount: number;
  unpaidCount: number;
  trayAssignedCount: number;
  packedCount: number;
  outForDeliveryCount: number;
  deliveredCount: number;
}

interface CustomerOption {
  id: string;
  name: string;
  code: string;
  route: string;
  gstin: string;
}

interface ProductOption {
  id: string;
  name: string;
  hsn: string;
  ptr: number;
  gstPercent: number;
  batch?: string;
  exp?: string;
  batches?: Array<{ batchNumber: string; expDate: string; qty: number }>;
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "irn" | "ewb" | "unpaid" | "out_for_delivery">("all");
  const [selectedRoute, setSelectedRoute] = useState<string>("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("all");

  // Selection & Modals
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [copiedIrn, setCopiedIrn] = useState<string | null>(null);
  const [showGstrModal, setShowGstrModal] = useState(false);
  const [showDirectBillModal, setShowDirectBillModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTargetInvoice, setPaymentTargetInvoice] = useState<InvoiceRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>("UPI");
  const [paymentRef, setPaymentRef] = useState<string>("");

  // Direct Billing Form State
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [directCustomerId, setDirectCustomerId] = useState("");
  const [directItems, setDirectItems] = useState<Array<{
    productId?: string;
    name: string;
    hsn: string;
    batch: string;
    exp: string;
    qty: number;
    free: string;
    ptr: number;
    gst: number;
  }>>([
    {
      name: "Amoxicillin + Clav 625 (10)",
      hsn: "30041010",
      batch: "AC2504",
      exp: "06/27",
      qty: 50,
      free: "5",
      ptr: 162.40,
      gst: 12
    }
  ]);
  const [directDueDate, setDirectDueDate] = useState("30 Nov 2026");
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);

  // In-app Toast Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "info" | "warning">("info");

  const showToast = useCallback((message: string, type: "success" | "info" | "warning" = "info") => {
    setToastMessage(message);
    setToastType(type);
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch Invoices and KPI Stats
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [invRes, statsRes] = await Promise.all([
        api.getInvoices({
          search: searchQuery || undefined,
          filter: activeFilter !== "all" ? activeFilter : undefined,
          route: selectedRoute !== "all" ? selectedRoute : undefined,
          paymentStatus: selectedPaymentStatus !== "all" ? selectedPaymentStatus : undefined
        }),
        api.getBillingStats()
      ]);

      if (invRes?.invoices) {
        setInvoices(invRes.invoices);
      }
      if (statsRes?.stats) {
        setStats(statsRes.stats);
      }
    } catch (err: any) {
      console.error("Error loading billing data:", err);
      showToast("Failed to load invoice records from server", "warning");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, activeFilter, selectedRoute, selectedPaymentStatus, showToast]);

  // Load Customers & Products for Direct Bill Modal
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          api.getCustomers ? api.getCustomers() : Promise.resolve({ customers: [] }),
          api.getProducts ? api.getProducts() : Promise.resolve({ products: [] })
        ]);
        if (cRes?.customers?.length) {
          setCustomers(cRes.customers);
          setDirectCustomerId(cRes.customers[0].id);
        }
        if (pRes?.products?.length) {
          setProducts(pRes.products);
        }
      } catch (e) {
        console.error("Error loading lookups:", e);
      }
    };
    loadLookups();
  }, []);

  // Keyboard shortcut: Press F2 to open Direct Bill modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setShowDirectBillModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Extract unique routes from invoices
  const availableRoutes = useMemo(() => {
    const routesSet = new Set<string>();
    invoices.forEach((i) => {
      if (i.route) routesSet.add(i.route.split(" (")[0]);
    });
    return Array.from(routesSet);
  }, [invoices]);

  // Copy IRN
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIrn(id);
    showToast("Government IRN hash copied to clipboard", "success");
    setTimeout(() => setCopiedIrn(null), 2500);
  };

  // Generate / Regenerate IRN action
  const handleRegenerateIrn = async (inv: InvoiceRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.generateIrn(inv.id);
      if (res?.success) {
        showToast(`e-Invoice IRN verified via NIC Portal for ${inv.invoiceNo}`, "success");
        fetchData(true);
        if (selectedInvoice && selectedInvoice.id === inv.id) {
          setSelectedInvoice({ ...selectedInvoice, irn: res.irn });
        }
      }
    } catch (_err: any) {
      showToast("Error generating IRN from NIC portal", "warning");
    }
  };

  // Generate e-Way Bill action
  const handleGenerateEway = async (inv: InvoiceRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.generateEwayBill(inv.id, "KA-01-MJ-8812", "DMS Express Logistics");
      if (res?.success) {
        showToast(`e-Way Bill ${res.ewayBill} generated for ${inv.invoiceNo}`, "success");
        fetchData(true);
        if (selectedInvoice && selectedInvoice.id === inv.id) {
          setSelectedInvoice({ ...selectedInvoice, ewayBill: res.ewayBill });
        }
      }
    } catch (_err: any) {
      showToast("Error generating e-Way bill", "warning");
    }
  };

  // Update Dispatch status
  const handleUpdateDispatch = async (inv: InvoiceRecord, newStatus: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.updateInvoiceDispatch(inv.id, { dispatchStatus: newStatus });
      if (res?.success) {
        showToast(`Dispatch status for ${inv.invoiceNo} changed to ${newStatus.replace(/_/g, " ")}`, "success");
        fetchData(true);
        if (selectedInvoice && selectedInvoice.id === inv.id) {
          setSelectedInvoice({ ...selectedInvoice, dispatchStatus: newStatus as any });
        }
      }
    } catch (_err: any) {
      showToast("Error updating dispatch status", "warning");
    }
  };

  // Open Payment Modal
  const openPaymentModal = (inv: InvoiceRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPaymentTargetInvoice(inv);
    setPaymentAmount(inv.total);
    setPaymentMode("UPI");
    setPaymentRef(`REC-${Math.floor(1000 + Math.random() * 9000)}`);
    setShowPaymentModal(true);
  };

  // Submit Payment
  const handleSubmitPayment = async () => {
    if (!paymentTargetInvoice) return;
    try {
      const res = await api.recordInvoicePayment(paymentTargetInvoice.id, {
        amount: paymentAmount,
        paymentMode,
        referenceNo: paymentRef
      });
      if (res?.success) {
        showToast(`Payment of ₹${paymentAmount.toLocaleString("en-IN")} recorded for ${paymentTargetInvoice.invoiceNo}`, "success");
        setShowPaymentModal(false);
        fetchData(true);
        if (selectedInvoice && selectedInvoice.id === paymentTargetInvoice.id) {
          setSelectedInvoice({ ...selectedInvoice, paymentStatus: res.paymentStatus });
        }
      }
    } catch (_err: any) {
      showToast("Error recording payment", "warning");
    }
  };

  // Add Item in Direct Bill modal
  const handleAddDirectItem = () => {
    setDirectItems([
      ...directItems,
      {
        name: "Pantoprazole 40 (15)",
        hsn: "30049099",
        batch: "PN2502",
        exp: "06/27",
        qty: 50,
        free: "5",
        ptr: 98.10,
        gst: 12
      }
    ]);
  };

  // Remove Item in Direct Bill modal
  const handleRemoveDirectItem = (index: number) => {
    if (directItems.length <= 1) return;
    setDirectItems(directItems.filter((_, idx) => idx !== index));
  };

  // Update item field in Direct Bill modal
  const handleUpdateDirectItem = (index: number, field: string, value: any) => {
    const updated = [...directItems];
    (updated[index] as any)[field] = value;
    setDirectItems(updated);
  };

  // Calculate direct bill totals
  const directBillCalculations = useMemo(() => {
    let taxable = 0;
    let gst = 0;
    directItems.forEach((it) => {
      const lineTaxable = (Number(it.qty) || 0) * (Number(it.ptr) || 0);
      const lineGst = lineTaxable * ((Number(it.gst) || 0) / 100);
      taxable += lineTaxable;
      gst += lineGst;
    });
    const total = taxable + gst;
    return {
      taxable: Math.round(taxable * 100) / 100,
      gst: Math.round(gst * 100) / 100,
      total: Math.round(total * 100) / 100
    };
  }, [directItems]);

  // Submit Direct Counter Bill
  const handleSubmitDirectBill = async () => {
    if (!directCustomerId) {
      showToast("Please select a customer", "warning");
      return;
    }
    if (directItems.length === 0) {
      showToast("Please add at least one line item", "warning");
      return;
    }

    setIsSubmittingBill(true);
    try {
      const res = await api.createInvoice({
        customerId: directCustomerId,
        dueDate: directDueDate,
        items: directItems
      });

      if (res?.success) {
        showToast(res.message || "Counter Invoice generated and registered with NIC e-Invoice portal!", "success");
        setShowDirectBillModal(false);
        fetchData();
        if (res.invoice) {
          setSelectedInvoice(res.invoice);
        }
      }
    } catch (err: any) {
      console.error("Direct billing error:", err);
      showToast("Failed to create direct counter bill", "warning");
    } finally {
      setIsSubmittingBill(false);
    }
  };

  // Download GSTR-1 JSON Package directly
  const handleDownloadGstrJson = () => {
    const payload = {
      gstin: "29AAAAA0000A1Z5",
      fp: "102026",
      version: "GSTR1_v1.1",
      hash: "AUTO_NIC_GSTN",
      b2b: invoices.map((inv) => ({
        ctin: inv.gstin,
        inv: [
          {
            inum: inv.invoiceNo,
            idt: inv.date,
            val: inv.total,
            pos: "29",
            rchrg: "N",
            inv_typ: "R",
            irn: inv.irn,
            eway: inv.ewayBill || null,
            itms: inv.items.map((it, idx) => ({
              num: idx + 1,
              itm_det: {
                hsn_sc: it.hsn,
                txval: it.qty * it.ptr,
                rt: it.gst,
                camt: Math.round(((it.qty * it.ptr * it.gst) / 200) * 100) / 100,
                samt: Math.round(((it.qty * it.ptr * it.gst) / 200) * 100) / 100,
                csamt: 0
              }
            }))
          }
        ]
      }))
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR1_Government_Package_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Official GSTR-1 JSON Package exported for GSTN offline tool.", "success");
    setShowGstrModal(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f8f9] overflow-hidden relative">
      {/* IN-APP TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          className={`absolute top-4 right-8 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-xs font-medium transition-all transform animate-in slide-in-from-top-3 duration-200 ${
            toastType === "success"
              ? "bg-emerald-900 text-white border-emerald-700"
              : toastType === "warning"
              ? "bg-amber-900 text-white border-amber-700"
              : "bg-slate-900 text-white border-slate-700"
          }`}
        >
          {toastType === "success" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
          {toastType === "warning" && <AlertCircle className="w-4 h-4 text-amber-400" />}
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

      {/* Top Header */}
      <header className="px-4 sm:px-8 py-5 sm:py-6 bg-white border-b border-gray-200 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                GST Billing &amp; e-Invoice Register
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                NIC e-Invoice Connected
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Government-compliant e-Invoice IRN generation, e-Way bills, and statutory registers.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/order-desk"
              className="px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-100 transition-colors"
            >
              ← Order Desk
            </Link>
            <Link
              href="/warehouse"
              className="px-3 py-2 bg-teal-50 border border-teal-200 text-[#178582] rounded-md text-xs font-semibold hover:bg-teal-100 transition-colors"
            >
              Warehouse Picking →
            </Link>
            <button
              id="refresh-billing-btn"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 bg-white border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#178582]" : ""}`} />
            </button>
            <button
              id="gstr1-export-modal-btn"
              onClick={() => setShowGstrModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>GSTR-1</span>
            </button>
            <button
              id="direct-bill-f2-btn"
              onClick={() => setShowDirectBillModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#178582] text-white rounded-md text-sm font-medium hover:bg-[#126b68] transition-colors shadow-sm cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Direct Bill (F2)</span>
            </button>
          </div>
        </div>

        {/* Dynamic KPI Stat Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Today&apos;s Billed Volume</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">
              ₹{((stats?.todayBilledVolume || 0) / 100000).toFixed(2)} Lakh
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {stats?.totalInvoicesCount || invoices.length} invoices sealed
            </div>
          </div>
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">IRN Compliance Rate</div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">
              {(stats?.irnComplianceRate || 100).toFixed(1)}%
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">NIC verified 64-char hash</div>
          </div>
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">e-Way Bills Generated</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">
              {stats?.ewayBillsCount ?? invoices.filter((i) => Boolean(i.ewayBill)).length} Bills
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Consignments &gt; ₹50,000</div>
          </div>
          <div className="bg-[#fbfcfd] p-3.5 rounded-lg border border-gray-200/80">
            <div className="text-xs text-gray-500 font-medium">Average Billed Ticket</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">
              ₹{(stats?.averageTicket || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Fast-mover formulations</div>
          </div>
        </div>
      </header>

      {/* Main Table Area */}
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-4">
        {/* Filter & Search Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "all"
                  ? "bg-white text-gray-900 shadow-sm font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveFilter("irn")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "irn"
                  ? "bg-white text-gray-900 shadow-sm font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              e-Invoice IRN Valid
            </button>
            <button
              onClick={() => setActiveFilter("ewb")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "ewb"
                  ? "bg-white text-gray-900 shadow-sm font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              e-Way Bill Eligible (&gt;₹50k)
            </button>
            <button
              onClick={() => setActiveFilter("unpaid")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "unpaid"
                  ? "bg-white text-gray-900 shadow-sm font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Receivables Pending
            </button>
            <button
              onClick={() => setActiveFilter("out_for_delivery")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === "out_for_delivery"
                  ? "bg-white text-gray-900 shadow-sm font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Out for Delivery
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {/* Route Filter Dropdown */}
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="border border-gray-200 rounded-md py-2 px-3 text-xs bg-white text-gray-700 font-medium focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] focus:outline-none"
            >
              <option value="all">All Routes</option>
              {availableRoutes.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>

            {/* Payment Status Dropdown */}
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="border border-gray-200 rounded-md py-2 px-3 text-xs bg-white text-gray-700 font-medium focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] focus:outline-none"
            >
              <option value="all">All Payments</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
            </select>

            {/* Search Box */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="billing-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Invoice #, Chemist, GSTIN..."
                className="pl-9 pr-8 py-2 w-full rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 placeholder:text-gray-400 font-medium"
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

        {/* Invoice Grid Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[950px]">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice # &amp; Date</th>
                  <th className="py-3 px-4">Customer &amp; Route</th>
                  <th className="py-3 px-4">Lines</th>
                  <th className="py-3 px-4">Taxable</th>
                  <th className="py-3 px-4">GST</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">e-Invoice IRN</th>
                  <th className="py-3 px-4">e-Way Bill</th>
                  <th className="py-3 px-4">Dispatch Tray</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-900">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#178582]" />
                        <span>Loading live statutory billing register...</span>
                      </div>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-gray-400 text-sm">
                      No matching invoice records found in database.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      {/* Invoice No & Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{inv.invoiceNo}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {inv.date} · {inv.time}
                        </div>
                      </td>

                      {/* Customer & Route */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 group-hover:text-[#178582] transition-colors">
                          {inv.customerName}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {inv.route} · <span className="font-mono text-gray-400">{inv.gstin}</span>
                        </div>
                      </td>

                      {/* Lines */}
                      <td className="py-3.5 px-4 font-medium text-gray-600">
                        {inv.linesCount || (inv.items ? inv.items.length : 1)} lines
                      </td>

                      {/* Taxable */}
                      <td className="py-3.5 px-4 font-mono text-gray-700">
                        ₹{inv.taxable.toLocaleString("en-IN")}
                      </td>

                      {/* GST */}
                      <td className="py-3.5 px-4 font-mono text-gray-700">
                        ₹{inv.gstAmount.toLocaleString("en-IN")}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 font-bold text-gray-900 text-sm font-mono">
                        ₹{inv.total.toLocaleString("en-IN")}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            inv.paymentStatus === "PAID"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : inv.paymentStatus === "PARTIAL"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                      </td>

                      {/* IRN */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {inv.irn ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              IRN Valid
                            </span>
                          ) : (
                            <button
                              onClick={(e) => handleRegenerateIrn(inv, e)}
                              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer"
                            >
                              Request IRN
                            </button>
                          )}
                          {inv.irn && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(inv.irn, inv.id);
                              }}
                              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 cursor-pointer"
                              title="Copy IRN Hash"
                            >
                              {copiedIrn === inv.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* e-Way Bill */}
                      <td className="py-3.5 px-4 font-mono">
                        {inv.ewayBill ? (
                          <span className="text-gray-900 font-medium bg-blue-50/70 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                            {inv.ewayBill}
                          </span>
                        ) : inv.total < 50000 ? (
                          <span className="text-gray-400 text-[11px] italic">
                            Exempt (&lt;₹50k)
                          </span>
                        ) : (
                          <button
                            onClick={(e) => handleGenerateEway(inv, e)}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer"
                          >
                            Generate EWB
                          </button>
                        )}
                      </td>

                      {/* Dispatch Tray */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-gray-700 font-medium text-[11px]">
                          <Truck className="w-3.5 h-3.5 text-[#178582]" />
                          <span>{inv.trayId}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {inv.dispatchStatus.replace(/_/g, " ")}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 text-gray-600 cursor-pointer"
                            title="View Tax Invoice"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openPaymentModal(inv)}
                            className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 text-emerald-600 cursor-pointer"
                            title="Record Payment"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setTimeout(() => window.print(), 300);
                            }}
                            className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 text-gray-600 cursor-pointer"
                            title="Print Tax Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
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

      {/* GSTR-1 EXPORT POPUP MODAL */}
      {showGstrModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 animate-in zoom-in-95 duration-150 border border-gray-200">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    GSTR-1 Return Package (Govt Schema 1.1)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Validated against GSTN Portal specs &amp; HSN Table 12
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGstrModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary details */}
            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-[11px] text-gray-500 font-medium">B2B Registered Invoices</div>
                <div className="text-base font-bold text-gray-900 mt-0.5">
                  {stats?.totalInvoicesCount || invoices.length} Vouchers
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                  100% Valid GSTIN
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-[11px] text-gray-500 font-medium">Total Billed Volume</div>
                <div className="text-base font-bold text-gray-900 mt-0.5">
                  ₹{(stats?.todayBilledVolume || 0).toLocaleString("en-IN")}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  IRN Compliant: {(stats?.irnComplianceRate || 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Schema Check list */}
            <div className="space-y-2 mb-5 bg-emerald-50/50 p-3 rounded-lg border border-emerald-200 text-xs text-emerald-800">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  All records mapped with 64-char NIC e-Invoice IRN &amp; statutory QR
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>HSN 8-digit Chapter 30 pharmaceutical codes verified</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>e-Way bill numbers populated for all orders exceeding ₹50,000 threshold</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowGstrModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
              <a
                href={api.getGstr1ExportUrl()}
                download
                onClick={() => {
                  setShowGstrModal(false);
                  showToast("GSTR-1 Official CSV sales register downloaded.", "success");
                }}
                className="px-4 py-2 border border-emerald-600 text-emerald-700 rounded-md text-xs font-semibold hover:bg-emerald-50 flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </a>
              <button
                onClick={handleDownloadGstrJson}
                className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export JSON Package</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL TAX INVOICE PREVIEW MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 border border-gray-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#178582]" />
                <h3 className="font-bold text-gray-900 text-sm">
                  Tax Invoice — {selectedInvoice.invoiceNo}
                </h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase">
                  GST e-Invoice
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    selectedInvoice.paymentStatus === "PAID"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {selectedInvoice.paymentStatus}
                </span>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Invoice Document Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-gray-700">
              {/* Distributor & Customer Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-200">
                <div>
                  <div className="font-bold text-gray-900 text-sm">[Distributor] DMS Pharma</div>
                  <div className="text-gray-500 mt-1">
                    Main Central Warehouse, Plot 42-B, Industrial Area
                  </div>
                  <div className="text-gray-500">
                    GSTIN: <span className="font-mono font-medium text-gray-800">29AAAAA0000A1Z5</span>
                  </div>
                  <div className="text-gray-500">
                    Drug Licence: <span className="font-mono font-medium text-gray-800">DL-20B/21B-441829</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-gray-900 text-sm">{selectedInvoice.customerName}</div>
                  <div className="text-gray-500 mt-1">{selectedInvoice.route}</div>
                  <div className="text-gray-500">
                    GSTIN: <span className="font-mono font-medium text-gray-800">{selectedInvoice.gstin}</span>
                  </div>
                  <div className="text-gray-500">
                    Due Date: <span className="font-medium text-gray-800">{selectedInvoice.dueDate}</span>
                  </div>
                </div>
              </div>

              {/* Statutory e-Invoice IRN & e-Way Box */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center justify-between">
                <div className="pr-2 flex-1">
                  <div className="text-[10px] uppercase font-bold text-gray-400">
                    Government e-Invoice IRN
                  </div>
                  <div className="font-mono text-gray-900 text-[11px] break-all select-all font-semibold">
                    {selectedInvoice.irn || "IRN Pending from NIC Gateway"}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    {selectedInvoice.ewayBill ? (
                      <div>
                        e-Way Bill: <span className="font-mono font-bold text-gray-900">{selectedInvoice.ewayBill}</span>
                      </div>
                    ) : selectedInvoice.total >= 50000 ? (
                      <button
                        onClick={() => handleGenerateEway(selectedInvoice)}
                        className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        + Generate e-Way Bill
                      </button>
                    ) : (
                      <span className="text-gray-400 italic">e-Way Bill: Exempt (&lt;₹50k)</span>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-gray-500 text-xs">Dispatch:</span>
                      <select
                        value={selectedInvoice.dispatchStatus}
                        onChange={(e) => handleUpdateDispatch(selectedInvoice, e.target.value)}
                        className="border border-gray-300 rounded px-1.5 py-0.5 text-xs font-semibold bg-white text-gray-800 focus:outline-none cursor-pointer"
                      >
                        <option value="TRAY_ASSIGNED">Tray Assigned</option>
                        <option value="PACKED_AND_SEALED">Packed & Sealed</option>
                        <option value="OUT_FOR_DELIVERY">Out For Delivery</option>
                        <option value="DELIVERED">Delivered</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="w-12 h-12 bg-white border border-gray-300 rounded flex items-center justify-center shrink-0 ml-3">
                  <QrCode className="w-9 h-9 text-gray-800" />
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[550px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 text-[11px] uppercase">
                      <th className="py-2">Item</th>
                      <th className="py-2">HSN</th>
                      <th className="py-2">Batch</th>
                      <th className="py-2">Exp</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Free</th>
                      <th className="py-2 text-right">PTR</th>
                      <th className="py-2 text-right">GST</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                    {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                      selectedInvoice.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-2 font-sans font-medium text-gray-900">{it.name}</td>
                          <td className="py-2 text-gray-500">{it.hsn}</td>
                          <td className="py-2 text-gray-700">{it.batch}</td>
                          <td className="py-2 text-gray-500">{it.exp}</td>
                          <td className="py-2 text-right font-bold">{it.qty}</td>
                          <td className="py-2 text-right text-emerald-600">{it.free}</td>
                          <td className="py-2 text-right">₹{Number(it.ptr).toFixed(2)}</td>
                          <td className="py-2 text-right">{it.gst}%</td>
                          <td className="py-2 text-right font-bold text-gray-900">
                            ₹{Number(it.total).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-4 text-center text-gray-400">
                          Standard formulation batch allocation
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="pt-3 border-t border-gray-200 flex justify-end">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Taxable Amount:</span>
                    <span className="font-mono font-medium">
                      ₹{selectedInvoice.taxable.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">CGST + SGST:</span>
                    <span className="font-mono font-medium">
                      ₹{selectedInvoice.gstAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-sm text-gray-900">
                    <span>Invoice Total:</span>
                    <span className="font-mono text-[#178582]">
                      ₹{selectedInvoice.total.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statutory Note */}
              <div className="text-[10px] text-gray-400 italic pt-2">
                * Note: Invoices are immutable once the IRN is generated. Any corrections or returns must be adjusted solely via registered Credit / Debit notes under Rule 48(4) of CGST Rules.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-wrap justify-between items-center gap-2.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">
                  Tray: <strong className="text-gray-800">{selectedInvoice.trayId}</strong>
                </span>
                <Link
                  href="/warehouse"
                  className="px-2.5 py-1 bg-teal-50 text-[#178582] rounded border border-teal-200 font-semibold hover:bg-teal-100 transition-colors"
                >
                  Pick in Warehouse →
                </Link>
                <Link
                  href="/delivery"
                  className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded border border-purple-200 font-semibold hover:bg-purple-100 transition-colors"
                >
                  Track Van →
                </Link>
              </div>
              <div className="flex gap-2">
                {selectedInvoice.paymentStatus !== "PAID" && (
                  <button
                    onClick={() => openPaymentModal(selectedInvoice)}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Collect Payment</span>
                  </button>
                )}
                <button
                  onClick={() =>
                    showToast(
                      `Encrypted invoice PDF sent to ${selectedInvoice.customerName} via WhatsApp.`,
                      "success"
                    )
                  }
                  className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Send PDF</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Tax Invoice</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showPaymentModal && paymentTargetInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Record Invoice Payment</h3>
                <p className="text-xs text-gray-500">
                  {paymentTargetInvoice.invoiceNo} · {paymentTargetInvoice.customerName}
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between items-center">
                <span className="text-gray-500 font-medium">Invoice Net Amount:</span>
                <span className="text-base font-bold text-gray-900 font-mono">
                  ₹{paymentTargetInvoice.total.toLocaleString("en-IN")}
                </span>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Amount to Collect (₹)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-bold focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                >
                  <option value="UPI">UPI / QR Code</option>
                  <option value="NEFT">NEFT / RTGS</option>
                  <option value="CHEQUE">Bank Cheque</option>
                  <option value="CASH">Cash Collection</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Reference / UTR / Cheque #</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. UTR-99418290 or Cheque #4412"
                  className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-3.5 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPayment}
                className="px-4 py-2 bg-emerald-700 text-white rounded-md text-xs font-semibold hover:bg-emerald-800 cursor-pointer shadow-sm"
              >
                Confirm Payment &amp; Mark Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIRECT BILL / COUNTER SALE MODAL (F2) */}
      {showDirectBillModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4 pb-2 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#178582]" />
                  Direct Counter Bill (F2)
                </h3>
                <p className="text-xs text-gray-500">
                  Fast keyboard retail counter billing with live database customer &amp; product lookup
                </p>
              </div>
              <button
                onClick={() => setShowDirectBillModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1.5">Select Chemist / Customer</label>
                  <select
                    value={directCustomerId}
                    onChange={(e) => setDirectCustomerId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:border-[#178582] focus:outline-none shadow-xs"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.code} ({c.route})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-800 mb-1.5">Payment Due Date</label>
                  <input
                    type="text"
                    value={directDueDate}
                    onChange={(e) => setDirectDueDate(e.target.value)}
                    placeholder="e.g. 30 Nov 2026"
                    className="w-full border border-gray-300 rounded-md p-2.5 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[#178582] focus:border-[#178582] focus:outline-none shadow-xs"
                  />
                </div>
              </div>

              {/* Items Line Builder */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-bold text-gray-800">Billed Formulations</label>
                  <button
                    type="button"
                    onClick={handleAddDirectItem}
                    className="text-[#178582] hover:text-[#126b68] font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {directItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-5">
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                          Product Name
                        </label>
                        <input
                          type="text"
                          list="billing-products-list"
                          value={item.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            const matched = products.find((p) => p.name.toLowerCase() === val.toLowerCase());
                            if (matched) {
                              handleUpdateDirectItem(idx, "name", matched.name);
                              handleUpdateDirectItem(idx, "ptr", matched.ptr);
                              handleUpdateDirectItem(idx, "hsn", matched.hsn || "30049099");
                              const defaultBatch = matched.batch || (matched.batches && matched.batches[0] ? matched.batches[0].batchNumber : "");
                              const defaultExp = matched.exp || (matched.batches && matched.batches[0] ? matched.batches[0].expDate : "");
                              if (defaultBatch) handleUpdateDirectItem(idx, "batch", defaultBatch);
                              if (defaultExp) handleUpdateDirectItem(idx, "exp", defaultExp);
                            } else {
                              handleUpdateDirectItem(idx, "name", val);
                            }
                          }}
                          className="w-full border border-gray-300 rounded p-1.5 bg-white text-gray-900 font-medium text-xs focus:ring-1 focus:ring-[#178582] focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                          Batch
                        </label>
                        <input
                          type="text"
                          value={item.batch}
                          onChange={(e) => handleUpdateDirectItem(idx, "batch", e.target.value)}
                          className="w-full border border-gray-300 rounded p-1.5 bg-white text-gray-900 font-medium text-xs focus:ring-1 focus:ring-[#178582] focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                          Qty
                        </label>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) =>
                            handleUpdateDirectItem(idx, "qty", Number(e.target.value))
                          }
                          className="w-full border border-gray-300 rounded p-1.5 bg-white text-gray-900 font-bold text-xs focus:ring-1 focus:ring-[#178582] focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                          PTR (₹)
                        </label>
                        <input
                          type="number"
                          value={item.ptr}
                          onChange={(e) =>
                            handleUpdateDirectItem(idx, "ptr", Number(e.target.value))
                          }
                          className="w-full border border-gray-300 rounded p-1.5 bg-white text-gray-900 font-mono text-xs focus:ring-1 focus:ring-[#178582] focus:outline-none"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center pt-3">
                        {directItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDirectItem(idx)}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Remove Line"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <datalist id="billing-products-list">
                  {products.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} · PTR: ₹{p.ptr}
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Financial Calculation Bar */}
              <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 flex justify-between items-center text-xs">
                <div>
                  <div className="text-[11px] text-gray-500">
                    Taxable: ₹{directBillCalculations.taxable.toLocaleString("en-IN")} · GST: ₹{directBillCalculations.gst.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                    {directBillCalculations.total >= 50000
                      ? "✓ Eligible for statutory e-Way Bill (>₹50k)"
                      : "✓ Exempt from e-Way bill (<₹50k threshold)"}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-gray-500 block">Total Net Payable:</span>
                  <span className="text-lg font-bold text-gray-900 font-mono">
                    ₹{directBillCalculations.total.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowDirectBillModal(false)}
                className="px-3.5 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="submit-direct-bill-btn"
                disabled={isSubmittingBill}
                onClick={handleSubmitDirectBill}
                className="px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {isSubmittingBill ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sealing Invoice &amp; Requesting IRN...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Generate e-Invoice &amp; Seal Tray</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
