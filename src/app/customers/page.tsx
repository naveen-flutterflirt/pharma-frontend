"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Sparkles,
  Lock,
  Unlock,
  Download,
  FileSpreadsheet,
  Edit,
  X,
  RefreshCw,
  MessageSquare
} from "lucide-react";
import { api } from "@/lib/api";

interface CustomerRecord {
  id: string;
  code: string;
  name: string;
  type: string;
  grade: string;
  route: string;
  salesman: string;
  address?: string;
  phone?: string;
  gstin: string;
  gstinVerified: boolean;
  dlNumber: string;
  dlValidTo: string;
  pharmacistOnRecord: boolean;
  creditLimit: number;
  creditUsed: number;
  creditUsedPercent: number;
  termsDays: number;
  status: "active" | "blocked" | "warning";
  rawStatus?: string;
  blockReason?: string | null;
  monthlyAvg?: number;
  openInvoicesCount?: number;
  openInvoicesSum?: number;
}

interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  blockedCustomers: number;
  warningCustomers: number;
  totalCreditLimit: number;
  totalCreditUsed: number;
  avgCreditDays: number;
  creditUtilizationPercent: number;
  chequeBouncesCount: number;
}

interface CustomerDetail extends CustomerRecord {
  monthlyAveragePurchase: number;
  growthVsLastHalfYear: number;
  oldestDueDays: number;
  avgDaysToPay: number;
  chequeBounces12m: number;
  topProducts: Array<{ name: string; amountPerMonth: number }>;
  notBuyingLately?: { product: string; lastOrderDaysAgo: number };
  openInvoices: Array<{
    id: string;
    invoiceNo: string;
    date: string;
    amount: number;
    dueDate: string;
    paymentStatus: string;
    daysOverdue: number;
  }>;
  documents: Array<{ name: string; status: string; verified: boolean }>;
  returnsAndNotes: Array<{ date: string; amount: number; noteNo: string; type: string }>;
  salesmanTip?: string;
  recentOrders?: Array<{
    id: string;
    orderNumber: string;
    channel: string;
    channelLabel: string;
    orderTotal: number;
    status: string;
    createdAt: string;
    itemsCount: number;
  }>;
  recentCollections?: Array<{
    id: string;
    receiptNo: string;
    amount: number;
    mode: string;
    referenceNo: string;
    date: string;
    reconciliationStatus: string;
  }>;
}

interface LedgerEntry {
  id: string;
  date: string;
  voucherType: "INVOICE" | "COLLECTION" | "CREDIT_NOTE";
  referenceNo: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  mode?: string;
}

interface LedgerData {
  customer: {
    id: string;
    code: string;
    name: string;
    gstin: string;
    creditLimit: number;
    creditUsed: number;
    termsDays: number;
    route: string;
    salesman: string;
    phone?: string;
  };
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  entries: LedgerEntry[];
}

export default function CustomersPage() {
  // Primary State
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "blocked" | "warning">("all");
  const [selectedRoute, setSelectedRoute] = useState("all");
  const [activeTab, setActiveTab] = useState<"invoices" | "orders" | "collections" | "notes">("invoices");

  // Loading States
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Ledger state
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Form States
  const [addForm, setAddForm] = useState({
    name: "",
    code: "",
    type: "Retail Chemist",
    grade: "Grade A",
    route: "Route 3",
    salesman: "Ravi Kumar",
    address: "",
    phone: "",
    gstin: "",
    dlNumber: "",
    dlValidTo: "2028-12-31",
    pharmacistOnRecord: true,
    creditLimit: "300000",
    termsDays: "30",
    monthlyAvg: "150000"
  });

  const [editForm, setEditForm] = useState({
    name: "",
    type: "",
    grade: "",
    route: "",
    salesman: "",
    address: "",
    phone: "",
    gstin: "",
    dlNumber: "",
    dlValidTo: "",
    creditLimit: "",
    termsDays: "",
    monthlyAvg: ""
  });

  const [blockReason, setBlockReason] = useState("Credit limit exceeded and invoices overdue > 45 days");

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "warning" | "info">("info");

  const showToast = useCallback((message: string, type: "success" | "warning" | "info" = "info") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // 1. Initial Load of Customer List & Stats
  const loadCustomersData = useCallback(async (preferredSelectId?: string, isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setLoadingList(true);
      }
      const [listRes, statsRes] = await Promise.all([
        api.getCustomers(),
        api.getCustomerStats()
      ]);

      if (listRes?.customers) {
        setCustomers(listRes.customers);
        const targetId = preferredSelectId || (listRes.customers.length > 0 ? listRes.customers[0].id : null);
        if (targetId) {
          setSelectedCustomerId(targetId);
        }
      }
      if (statsRes?.stats) {
        setStats(statsRes.stats);
      }
    } catch (err: unknown) {
      console.error("Failed to load customers:", err);
      showToast("Failed to load chemists data from database", "warning");
    } finally {
      setLoadingList(false);
    }
  }, [showToast]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [listRes, statsRes] = await Promise.all([
          api.getCustomers(),
          api.getCustomerStats()
        ]);
        if (!isMounted) return;
        if (listRes?.customers) {
          setCustomers(listRes.customers);
          if (listRes.customers.length > 0) {
            setSelectedCustomerId(listRes.customers[0].id);
          }
        }
        if (statsRes?.stats) {
          setStats(statsRes.stats);
        }
      } catch (err: unknown) {
        console.error("Initial load error:", err);
      } finally {
        if (isMounted) setLoadingList(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Load 360° Detail when selectedCustomerId changes
  const loadCustomerDetail = useCallback(async (id: string, isManual = false) => {
    try {
      if (isManual) {
        setLoadingDetail(true);
      }
      const res = await api.getCustomerById(id);
      if (res?.customer) {
        setCustomerDetail(res.customer);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch customer detail:", err);
      showToast("Failed to fetch 360° chemist profile", "warning");
    } finally {
      setLoadingDetail(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!selectedCustomerId) return;
    let isMounted = true;
    (async () => {
      try {
        const res = await api.getCustomerById(selectedCustomerId);
        if (isMounted && res?.customer) {
          setCustomerDetail(res.customer);
        }
      } catch (err: unknown) {
        console.error("Customer detail load error:", err);
      } finally {
        if (isMounted) setLoadingDetail(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [selectedCustomerId]);

  // 3. Filtered Customers for Directory list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.gstin.toLowerCase().includes(q) ||
        c.salesman.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        c.route.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (selectedRoute !== "all" && c.route !== selectedRoute) return false;

      if (activeFilter === "active") return c.status === "active";
      if (activeFilter === "blocked") return c.status === "blocked";
      if (activeFilter === "warning") return c.status === "warning";

      return true;
    });
  }, [customers, searchQuery, activeFilter, selectedRoute]);

  // Unique Routes for filter
  const uniqueRoutes = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.route) set.add(c.route);
    });
    return Array.from(set).sort();
  }, [customers]);

  // Credit Used Percentage
  const creditPercent = useMemo(() => {
    if (!customerDetail || customerDetail.creditLimit <= 0) return 0;
    return Math.min(100, Math.round((customerDetail.creditUsed / customerDetail.creditLimit) * 100));
  }, [customerDetail]);

  // 4. Handle Create New Chemist
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.gstin.trim() || !addForm.dlNumber.trim()) {
      showToast("Please enter Chemist Name, GSTIN, and Drug Licence Number", "warning");
      return;
    }

    try {
      setActionLoading(true);
      const res = await api.createCustomer({
        name: addForm.name.trim(),
        code: addForm.code.trim() || undefined,
        type: addForm.type,
        grade: addForm.grade,
        route: addForm.route,
        salesman: addForm.salesman,
        address: addForm.address.trim(),
        phone: addForm.phone.trim(),
        gstin: addForm.gstin.trim().toUpperCase(),
        dlNumber: addForm.dlNumber.trim().toUpperCase(),
        dlValidTo: addForm.dlValidTo,
        pharmacistOnRecord: addForm.pharmacistOnRecord,
        creditLimit: Number(addForm.creditLimit) || 300000,
        termsDays: Number(addForm.termsDays) || 30,
        monthlyAvg: Number(addForm.monthlyAvg) || 120000
      });

      if (res?.success) {
        showToast(res.message || "Chemist onboarded successfully!", "success");
        setShowAddModal(false);
        setAddForm({
          name: "",
          code: "",
          type: "Retail Chemist",
          grade: "Grade A",
          route: "Route 3",
          salesman: "Ravi Kumar",
          address: "",
          phone: "",
          gstin: "",
          dlNumber: "",
          dlValidTo: "2028-12-31",
          pharmacistOnRecord: true,
          creditLimit: "300000",
          termsDays: "30",
          monthlyAvg: "150000"
        });
        await loadCustomersData(res.customer?.id);
      } else {
        showToast(res?.error || "Failed to onboard chemist", "warning");
      }
    } catch (err: any) {
      showToast(err.message || "Error creating customer", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Open Edit Modal
  const openEditModal = () => {
    if (!customerDetail) return;
    setEditForm({
      name: customerDetail.name,
      type: customerDetail.type,
      grade: customerDetail.grade,
      route: customerDetail.route,
      salesman: customerDetail.salesman,
      address: customerDetail.address || "",
      phone: customerDetail.phone || "",
      gstin: customerDetail.gstin,
      dlNumber: customerDetail.dlNumber,
      dlValidTo: customerDetail.dlValidTo,
      creditLimit: String(customerDetail.creditLimit),
      termsDays: String(customerDetail.termsDays),
      monthlyAvg: String(customerDetail.monthlyAveragePurchase || 150000)
    });
    setShowEditModal(true);
  };

  // 6. Handle Update Customer
  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerDetail) return;

    try {
      setActionLoading(true);
      const res = await api.updateCustomer(customerDetail.id, {
        name: editForm.name.trim(),
        type: editForm.type,
        grade: editForm.grade,
        route: editForm.route,
        salesman: editForm.salesman,
        address: editForm.address.trim(),
        phone: editForm.phone.trim(),
        gstin: editForm.gstin.trim(),
        dlNumber: editForm.dlNumber.trim(),
        dlValidTo: editForm.dlValidTo,
        creditLimit: Number(editForm.creditLimit),
        termsDays: Number(editForm.termsDays),
        monthlyAvg: Number(editForm.monthlyAvg)
      });

      if (res?.success) {
        showToast(`Updated terms for ${res.customer.name}`, "success");
        setShowEditModal(false);
        await Promise.all([
          loadCustomersData(customerDetail.id),
          loadCustomerDetail(customerDetail.id)
        ]);
      } else {
        showToast(res?.error || "Failed to update chemist", "warning");
      }
    } catch (err: any) {
      showToast(err.message || "Error updating customer", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Toggle Block / Unblock
  const handleToggleBlock = async (action: "BLOCK" | "UNBLOCK") => {
    if (!customerDetail) return;

    try {
      setActionLoading(true);
      const res = await api.toggleCustomerStatus(customerDetail.id, {
        status: action === "BLOCK" ? "BLOCKED" : "ACTIVE",
        blockReason: action === "BLOCK" ? blockReason : undefined
      });

      if (res?.success) {
        showToast(res.message, action === "BLOCK" ? "warning" : "success");
        setShowBlockModal(false);
        await Promise.all([
          loadCustomersData(customerDetail.id),
          loadCustomerDetail(customerDetail.id)
        ]);
      } else {
        showToast(res?.error || "Action failed", "warning");
      }
    } catch (err: any) {
      showToast(err.message || "Error updating account status", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Open Ledger Modal & Fetch Live Ledger
  const handleOpenLedger = async () => {
    if (!customerDetail) return;
    setShowLedgerModal(true);
    try {
      setLoadingLedger(true);
      const res = await api.getCustomerLedger(customerDetail.id);
      if (res?.success && res.ledger) {
        setLedgerData(res.ledger);
      }
    } catch (err: any) {
      console.error("Ledger fetch error:", err);
      showToast("Failed to load customer ledger", "warning");
    } finally {
      setLoadingLedger(false);
    }
  };

  // 9. Send Reminder
  const handleSendReminder = async (channel: string) => {
    if (!customerDetail) return;
    try {
      setActionLoading(true);
      const res = await api.sendCustomerReminder(customerDetail.id, {
        channel,
        amount: customerDetail.creditUsed
      });
      if (res?.success) {
        showToast(res.message, "success");
        setShowReminderModal(false);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to dispatch reminder", "warning");
    } finally {
      setActionLoading(false);
    }
  };

  // 10. WhatsApp Statement Link
  const openWhatsAppStatement = () => {
    if (!customerDetail) return;
    const phoneClean = (customerDetail.phone || "919820044102").replace(/[^0-9]/g, "");
    const text = encodeURIComponent(
      `Hello ${customerDetail.name},\n\nThis is an automated ledger statement notice from Distributor DMS.\nOutstanding Receivables: ₹${customerDetail.creditUsed.toLocaleString("en-IN")}\nPayment Terms: ${customerDetail.termsDays} days.\n\nPlease remit via UPI or Net Banking to keep your credit line active.`
    );
    window.open(`https://wa.me/${phoneClean}?text=${text}`, "_blank");
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

      {/* Top Dynamic KPI Metrics Strip */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 overflow-x-auto py-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Chemists:</span>
              <span className="text-sm font-bold text-gray-900 font-mono">
                {stats?.totalCustomers || customers.length}
              </span>
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-700 font-medium">Active:</span>
              <span className="text-sm font-bold text-emerald-800 font-mono">
                {stats?.activeCustomers || 0}
              </span>
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium">Blocked:</span>
              <span className="text-sm font-bold text-red-700 font-mono">
                {stats?.blockedCustomers || 0}
              </span>
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-600 font-medium">Warning:</span>
              <span className="text-sm font-bold text-amber-700 font-mono">
                {stats?.warningCustomers || 0}
              </span>
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Credit Limit:</span>
              <span className="text-sm font-bold text-gray-900 font-mono">
                ₹{((stats?.totalCreditLimit || 0) / 100000).toFixed(1)}L
              </span>
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Outstanding:</span>
              <span className="text-sm font-bold text-[#178582] font-mono">
                ₹{((stats?.totalCreditUsed || 0) / 100000).toFixed(1)}L
              </span>
            </div>
          </div>

          {/* Quick Global Actions */}
          <div className="flex items-center gap-2">
            <a
              id="export-customers-csv"
              href={api.getExportCustomersUrl()}
              download="chemist_directory.csv"
              className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </a>
            <button
              id="refresh-customers-btn"
              onClick={() => loadCustomersData(selectedCustomerId || undefined)}
              className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600 cursor-pointer"
              title="Refresh Customers"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin text-[#178582]" : ""}`} />
            </button>
            <button
              id="btn-onboard-chemist"
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Onboard Chemist</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout Split Pane */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Side: Customers Directory */}
        <div className="w-full lg:w-[350px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-[#fbfcfd] flex flex-col max-h-[300px] lg:max-h-full">
          
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-base font-bold text-gray-900 tracking-tight">
                Customer 360
              </h1>
              <span className="text-xs font-semibold text-gray-400">
                {filteredCustomers.length} of {customers.length} Accounts
              </span>
            </div>

            {/* Search Input */}
            <div className="relative mb-2.5">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-chemist-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Chemist, Code, GSTIN, Route..."
                className="pl-8 pr-3 py-1.5 w-full rounded-md border border-gray-200 text-xs focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 placeholder:text-gray-400 font-medium"
              />
            </div>

            {/* Route Filter Dropdown */}
            <div className="mb-2.5">
              <select
                id="select-route-filter"
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 bg-gray-50 text-gray-700 font-medium focus:ring-1 focus:ring-[#178582]"
              >
                <option value="all">All Delivery Beats &amp; Routes</option>
                {uniqueRoutes.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-0.5 rounded-md">
              <button
                id="filter-tab-all"
                onClick={() => setActiveFilter("all")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                  activeFilter === "all" ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All
              </button>
              <button
                id="filter-tab-active"
                onClick={() => setActiveFilter("active")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                  activeFilter === "active" ? "bg-white text-emerald-800 shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Active
              </button>
              <button
                id="filter-tab-warning"
                onClick={() => setActiveFilter("warning")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                  activeFilter === "warning" ? "bg-white text-amber-800 shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Warning
              </button>
              <button
                id="filter-tab-blocked"
                onClick={() => setActiveFilter("blocked")}
                className={`flex-1 py-1 text-[11px] font-semibold rounded cursor-pointer transition-all ${
                  activeFilter === "blocked" ? "bg-white text-red-800 shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Blocked
              </button>
            </div>
          </div>

          {/* Chemist List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingList ? (
              <div className="py-12 text-center text-xs text-gray-400">
                <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#178582]" />
                Loading chemist directory...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No chemists found matching filters.
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = c.id === selectedCustomerId;
                return (
                  <div
                    key={c.id}
                    id={`chemist-card-${c.code}`}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`p-3 rounded-lg transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-white border-2 border-[#178582] shadow-sm ring-1 ring-[#178582]/20"
                        : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-gray-900 text-xs truncate max-w-[200px]">
                        {c.name}
                      </h3>
                      {c.status === "active" && (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                          {c.grade}
                        </span>
                      )}
                      {c.status === "warning" && (
                        <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200 shrink-0">
                          Warning
                        </span>
                      )}
                      {c.status === "blocked" && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-800 px-1.5 py-0.2 rounded shrink-0">
                          Blocked
                        </span>
                      )}
                    </div>
                    
                    <div className="text-[11px] text-gray-500 mb-2 truncate">
                      {c.code} · {c.route} ({c.salesman})
                    </div>

                    {/* Progress Bar for Credit Limit */}
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full transition-all ${
                          c.status === "blocked" || c.creditUsedPercent >= 90
                            ? "bg-red-500"
                            : c.creditUsedPercent >= 75
                            ? "bg-amber-500"
                            : "bg-[#178582]"
                        }`}
                        style={{ width: `${Math.min(100, c.creditUsedPercent)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-gray-500">
                        Used: ₹{(c.creditUsed / 1000).toFixed(0)}K
                      </span>
                      <span className="font-semibold text-gray-800">
                        Limit: ₹{(c.creditLimit / 1000).toFixed(0)}K
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Right Side: Customer 360 Workspace */}
        {loadingDetail && !customerDetail ? (
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center">
              <RefreshCw className="w-7 h-7 mx-auto mb-2 animate-spin text-[#178582]" />
              <p className="text-xs text-gray-500">Loading 360° Chemist Dossier...</p>
            </div>
          </div>
        ) : customerDetail ? (
          <div className="flex-1 flex flex-col h-full bg-white overflow-y-auto">
            
            {/* Top Customer Banner */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-white shrink-0 flex-wrap gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#178582]/10 text-[#178582] flex items-center justify-center font-bold text-base border border-[#178582]/20 shrink-0">
                  {customerDetail.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 id="chemist-title-name" className="text-xl font-bold text-gray-900 tracking-tight">
                      {customerDetail.name}
                    </h2>
                    
                    {customerDetail.status === "active" && (
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Active · {customerDetail.grade}
                      </span>
                    )}
                    {customerDetail.status === "warning" && (
                      <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Warning · {customerDetail.grade}
                      </span>
                    )}
                    {customerDetail.status === "blocked" && (
                      <span className="text-xs font-semibold text-red-800 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                        BLOCKED · {customerDetail.grade}
                      </span>
                    )}

                    <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {customerDetail.route} · {customerDetail.salesman}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-2 flex-wrap">
                    <span>{customerDetail.type}</span>
                    <span>·</span>
                    <span className="font-mono font-medium">Customer {customerDetail.code}</span>
                    <span>·</span>
                    <span className="text-emerald-700 font-medium">
                      GSTIN {customerDetail.gstin} {customerDetail.gstinVerified ? "✓" : ""}
                    </span>
                    <span>·</span>
                    <span className="text-emerald-700 font-medium">
                      DL 20B/21B ✓ to {customerDetail.dlValidTo}
                    </span>
                    <span>·</span>
                    <span>Pharmacist on record ✓</span>
                    {customerDetail.phone && (
                      <>
                        <span>·</span>
                        <span className="text-gray-700 font-mono">{customerDetail.phone}</span>
                      </>
                    )}
                  </p>

                  {customerDetail.status === "blocked" && customerDetail.blockReason && (
                    <div className="mt-2 text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded border border-red-200 inline-flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-red-600" />
                      <span>Block Reason: {customerDetail.blockReason}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Block / Unblock Toggle */}
                {customerDetail.status === "blocked" ? (
                  <button
                    id="btn-unblock-chemist"
                    onClick={() => handleToggleBlock("UNBLOCK")}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unblock Chemist</span>
                  </button>
                ) : (
                  <button
                    id="btn-block-chemist"
                    onClick={() => setShowBlockModal(true)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-semibold hover:bg-red-100 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Block Chemist</span>
                  </button>
                )}

                {/* Edit Profile */}
                <button
                  id="btn-edit-chemist"
                  onClick={openEditModal}
                  className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit className="w-3.5 h-3.5 text-gray-500" />
                  <span>Edit Terms</span>
                </button>

                {/* WhatsApp Statement */}
                <button
                  id="btn-whatsapp-statement"
                  onClick={openWhatsAppStatement}
                  className="px-3 py-1.5 border border-emerald-300 bg-emerald-50 text-emerald-800 rounded text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="WhatsApp Statement to Chemist"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>

                {/* Record Payment */}
                <Link
                  id="btn-record-payment"
                  href={`/collections`}
                  className="px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-xs font-semibold hover:bg-emerald-100 transition-colors shadow-xs"
                >
                  Record Payment →
                </Link>

                {/* Ledger Modal Trigger */}
                <button
                  id="btn-view-ledger"
                  onClick={handleOpenLedger}
                  className="px-3.5 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer shadow-xs"
                >
                  Ledger
                </button>

                {/* Send Reminder Trigger */}
                <button
                  id="btn-send-reminder"
                  onClick={() => setShowReminderModal(true)}
                  className="px-3.5 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer shadow-xs"
                >
                  Send reminder
                </button>

                {/* New Order */}
                <Link
                  id="btn-new-order"
                  href="/order-desk"
                  className="px-4 py-1.5 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <span>New order →</span>
                </Link>
              </div>
            </div>

            {/* Main Multi-Column Content Area */}
            <div className="p-6 space-y-6 flex-1">
              
              {/* Row 1: Credit Profile, Purchases Trend, Documents */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Credit Profile & Rules */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-bold text-gray-900">Credit &amp; Risk Health</h3>
                      <button
                        onClick={openEditModal}
                        className="text-[11px] text-[#178582] font-semibold hover:underline cursor-pointer"
                      >
                        Adjust Limit
                      </button>
                    </div>
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sanctioned Limit:</span>
                        <span className="font-bold text-gray-900 font-mono">
                          ₹{customerDetail.creditLimit.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Credit Utilized (Receivables):</span>
                        <span className="font-bold text-gray-900 font-mono">
                          ₹{customerDetail.creditUsed.toLocaleString("en-IN")}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden my-2">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            creditPercent >= 90 ? "bg-red-500" : creditPercent >= 75 ? "bg-amber-500" : "bg-[#178582]"
                          }`}
                          style={{ width: `${creditPercent}%` }}
                        />
                      </div>

                      <div className="flex justify-between pt-1">
                        <span className="text-gray-500">Credit Terms:</span>
                        <span className="font-medium text-gray-900">{customerDetail.termsDays} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Oldest due invoice:</span>
                        <span className="font-medium text-gray-900">{customerDetail.oldestDueDays} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Avg days to pay:</span>
                        <span className="font-medium text-gray-900">{customerDetail.avgDaysToPay} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Cheque bounces (12 m):</span>
                        <span className="font-medium text-gray-900 font-mono">
                          {customerDetail.chequeBounces12m}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200/80">
                    <strong className="text-gray-800">Credit rules enforced:</strong> Auto-block order entry if limit is breached, any bill &gt; 45 days overdue, or 2 bounced cheques. Soft warning at 85% utilization.
                  </div>
                </div>

                {/* Purchases — Last 6 Months & Top Products */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Purchases &amp; Buying Habits</h3>
                    <div className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
                      <span>Avg ₹{(customerDetail.monthlyAveragePurchase / 100000).toFixed(1)}L / month</span>
                      <span className="text-emerald-700 font-bold flex items-center">
                        ▲ {customerDetail.growthVsLastHalfYear}% vs H1
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-gray-800 mb-2">Top products ordered:</h4>
                    <div className="space-y-2 text-xs">
                      {customerDetail.topProducts.map((prod, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="text-gray-700 font-medium">{prod.name}</span>
                          <span className="font-mono font-bold text-gray-900">
                            ₹{(prod.amountPerMonth / 1000).toFixed(0)}K / m
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {customerDetail.notBuyingLately && (
                    <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      <strong>Not buying lately:</strong> {customerDetail.notBuyingLately.product} — last order {customerDetail.notBuyingLately.lastOrderDaysAgo} days ago.
                    </div>
                  )}
                </div>

                {/* Documents & Compliance Register */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Statutory &amp; KYC Register</h3>
                    <div className="space-y-2.5 text-xs">
                      {customerDetail.documents.map((doc, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                          <span className="text-gray-600 font-medium">{doc.name}</span>
                          <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                            {doc.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                    * Automated State FDA Drug Licence &amp; GSTN validity synced with Government Portal.
                  </div>
                </div>

              </div>

              {/* Row 2: Tabbed Sections (Invoices, Orders, Receipts, Notes) */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="border-b border-gray-200 px-5 flex items-center justify-between">
                  <div className="flex space-x-6 text-xs font-semibold">
                    <button
                      id="tab-btn-invoices"
                      onClick={() => setActiveTab("invoices")}
                      className={`py-3.5 border-b-2 cursor-pointer transition-colors ${
                        activeTab === "invoices"
                          ? "border-[#178582] text-[#178582]"
                          : "border-transparent text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Open Invoices ({customerDetail.openInvoices.length})
                    </button>
                    <button
                      id="tab-btn-orders"
                      onClick={() => setActiveTab("orders")}
                      className={`py-3.5 border-b-2 cursor-pointer transition-colors ${
                        activeTab === "orders"
                          ? "border-[#178582] text-[#178582]"
                          : "border-transparent text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Recent Sales Orders ({customerDetail.recentOrders?.length || 0})
                    </button>
                    <button
                      id="tab-btn-collections"
                      onClick={() => setActiveTab("collections")}
                      className={`py-3.5 border-b-2 cursor-pointer transition-colors ${
                        activeTab === "collections"
                          ? "border-[#178582] text-[#178582]"
                          : "border-transparent text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Payment Receipts ({customerDetail.recentCollections?.length || 0})
                    </button>
                    <button
                      id="tab-btn-notes"
                      onClick={() => setActiveTab("notes")}
                      className={`py-3.5 border-b-2 cursor-pointer transition-colors ${
                        activeTab === "notes"
                          ? "border-[#178582] text-[#178582]"
                          : "border-transparent text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Returns &amp; Credit Notes ({customerDetail.returnsAndNotes.length})
                    </button>
                  </div>

                  <span className="text-xs text-gray-500 font-mono">
                    Total Due: <strong className="text-gray-900">₹{customerDetail.openInvoices.reduce((a, b) => a + b.amount, 0).toLocaleString("en-IN")}</strong>
                  </span>
                </div>

                <div className="p-5">
                  {/* TAB 1: OPEN INVOICES */}
                  {activeTab === "invoices" && (
                    <div className="overflow-x-auto">
                      {customerDetail.openInvoices.length === 0 ? (
                        <div className="py-8 text-center text-xs text-gray-400">
                          Zero open invoices! Account has cleared all balances.
                        </div>
                      ) : (
                        <table className="w-full min-w-[540px] text-xs text-left">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase text-[10px]">
                              <th className="pb-2">Invoice #</th>
                              <th className="pb-2">Billing Date</th>
                              <th className="pb-2">Total Amount</th>
                              <th className="pb-2">Due Date</th>
                              <th className="pb-2">Aging / Overdue</th>
                              <th className="pb-2 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium">
                            {customerDetail.openInvoices.map((inv) => (
                              <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                <td className="py-2.5 font-bold font-mono text-gray-900">{inv.invoiceNo}</td>
                                <td className="py-2.5 text-gray-600">{inv.date}</td>
                                <td className="py-2.5 font-bold font-mono text-gray-900">
                                  ₹{inv.amount.toLocaleString("en-IN")}
                                </td>
                                <td className="py-2.5 text-gray-700">{inv.dueDate}</td>
                                <td className="py-2.5">
                                  {inv.daysOverdue > 0 ? (
                                    <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                                      {inv.daysOverdue} days overdue
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      Within Terms
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 text-right font-semibold">
                                  <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                    {inv.paymentStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* TAB 2: RECENT SALES ORDERS */}
                  {activeTab === "orders" && (
                    <div className="overflow-x-auto">
                      {(!customerDetail.recentOrders || customerDetail.recentOrders.length === 0) ? (
                        <div className="py-8 text-center text-xs text-gray-400">
                          No recent sales orders recorded for this chemist.
                        </div>
                      ) : (
                        <table className="w-full min-w-[500px] text-xs text-left">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase text-[10px]">
                              <th className="pb-2">Order #</th>
                              <th className="pb-2">Channel</th>
                              <th className="pb-2">Items</th>
                              <th className="pb-2">Order Value</th>
                              <th className="pb-2 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium">
                            {customerDetail.recentOrders.map((ord) => (
                              <tr key={ord.id} className="hover:bg-gray-50 transition-colors">
                                <td className="py-2.5 font-bold font-mono text-gray-900">{ord.orderNumber}</td>
                                <td className="py-2.5 text-gray-600">{ord.channelLabel || ord.channel}</td>
                                <td className="py-2.5 text-gray-700">{ord.itemsCount} products</td>
                                <td className="py-2.5 font-bold font-mono text-gray-900">
                                  ₹{ord.orderTotal.toLocaleString("en-IN")}
                                </td>
                                <td className="py-2.5 text-right">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                    {ord.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* TAB 3: PAYMENT RECEIPTS */}
                  {activeTab === "collections" && (
                    <div className="overflow-x-auto">
                      {(!customerDetail.recentCollections || customerDetail.recentCollections.length === 0) ? (
                        <div className="py-8 text-center text-xs text-gray-400">
                          No collection receipts recorded for this account.
                        </div>
                      ) : (
                        <table className="w-full min-w-[500px] text-xs text-left">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase text-[10px]">
                              <th className="pb-2">Receipt #</th>
                              <th className="pb-2">Date</th>
                              <th className="pb-2">Payment Mode</th>
                              <th className="pb-2">Reference UTR</th>
                              <th className="pb-2">Amount (₹)</th>
                              <th className="pb-2 text-right">Reconciliation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium">
                            {customerDetail.recentCollections.map((col) => (
                              <tr key={col.id} className="hover:bg-gray-50 transition-colors">
                                <td className="py-2.5 font-bold font-mono text-gray-900">{col.receiptNo}</td>
                                <td className="py-2.5 text-gray-600">{col.date}</td>
                                <td className="py-2.5 font-semibold text-gray-800">{col.mode}</td>
                                <td className="py-2.5 font-mono text-gray-500 text-[11px]">{col.referenceNo}</td>
                                <td className="py-2.5 font-bold font-mono text-emerald-800">
                                  ₹{col.amount.toLocaleString("en-IN")}
                                </td>
                                <td className="py-2.5 text-right">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    {col.reconciliationStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* TAB 4: RETURNS & NOTES */}
                  {activeTab === "notes" && (
                    <div>
                      {customerDetail.returnsAndNotes.length === 0 ? (
                        <p className="text-xs text-gray-400 py-6 text-center">
                          Zero active credit notes or return vouchers on file.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {customerDetail.returnsAndNotes.map((rn, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center">
                              <div>
                                <div className="font-semibold text-gray-800 text-xs">{rn.type} · {rn.date}</div>
                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">{rn.noteNo}</div>
                              </div>
                              <span className="font-bold text-gray-900 font-mono text-xs">
                                ₹{rn.amount.toLocaleString("en-IN")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Salesman Intelligence Tip */}
              {customerDetail.salesmanTip && (
                <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-emerald-900 mb-0.5">
                      Salesman Intelligence Tip for {customerDetail.salesman}:
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      {customerDetail.salesmanTip}
                    </p>
                  </div>
                </div>
              )}

            </div>

          </div>
        ) : null}

      </div>

      {/* MODAL 1: ONBOARD NEW CHEMIST */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Onboard New Chemist / Pharmacy</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  KYC compliance onboarding with statutory Drug Licence &amp; GSTIN registration
                </p>
              </div>
              <button
                id="btn-close-add-modal"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Chemist / Firm Name *</label>
                  <input
                    id="add-chemist-name"
                    type="text"
                    required
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="e.g. Mahavir Medicals"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-1 focus:ring-[#178582]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Customer Code (Auto-generated if empty)</label>
                  <input
                    id="add-chemist-code"
                    type="text"
                    value={addForm.code}
                    onChange={(e) => setAddForm({ ...addForm, code: e.target.value })}
                    placeholder="e.g. C-2901"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-1 focus:ring-[#178582]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Establishment Type</label>
                  <select
                    id="add-chemist-type"
                    value={addForm.type}
                    onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 bg-white"
                  >
                    <option value="Retail Chemist">Retail Chemist</option>
                    <option value="Hospital Pharmacy">Hospital Pharmacy</option>
                    <option value="Chain Pharmacy">Chain Pharmacy</option>
                    <option value="Wholesale Stockist">Wholesale Stockist</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Customer Grade</label>
                  <select
                    id="add-chemist-grade"
                    value={addForm.grade}
                    onChange={(e) => setAddForm({ ...addForm, grade: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 bg-white"
                  >
                    <option value="Grade A+">Grade A+ (Prime)</option>
                    <option value="Grade A">Grade A</option>
                    <option value="Grade B">Grade B</option>
                    <option value="Grade C">Grade C</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Assigned Route</label>
                  <input
                    id="add-chemist-route"
                    type="text"
                    value={addForm.route}
                    onChange={(e) => setAddForm({ ...addForm, route: e.target.value })}
                    placeholder="e.g. Route 3"
                    className="w-full border border-gray-300 rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Salesman Beat Rep</label>
                  <input
                    id="add-chemist-salesman"
                    type="text"
                    value={addForm.salesman}
                    onChange={(e) => setAddForm({ ...addForm, salesman: e.target.value })}
                    placeholder="e.g. Ravi Kumar"
                    className="w-full border border-gray-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Contact Phone</label>
                  <input
                    id="add-chemist-phone"
                    type="text"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    placeholder="+91 98XXX XXXXX"
                    className="w-full border border-gray-300 rounded p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Pharmacy Address</label>
                <input
                  id="add-chemist-address"
                  type="text"
                  value={addForm.address}
                  onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  placeholder="Shop number, Commercial Street, Landmark"
                  className="w-full border border-gray-300 rounded p-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">GSTIN (15 Digits) *</label>
                  <input
                    id="add-chemist-gstin"
                    type="text"
                    required
                    value={addForm.gstin}
                    onChange={(e) => setAddForm({ ...addForm, gstin: e.target.value })}
                    placeholder="29AABCU9603R1ZM"
                    className="w-full border border-gray-300 rounded p-2 font-mono uppercase bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Drug Licence 20B/21B *</label>
                  <input
                    id="add-chemist-dl"
                    type="text"
                    required
                    value={addForm.dlNumber}
                    onChange={(e) => setAddForm({ ...addForm, dlNumber: e.target.value })}
                    placeholder="KA-B1-20B-18294"
                    className="w-full border border-gray-300 rounded p-2 font-mono uppercase bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">DL Valid To</label>
                  <input
                    id="add-chemist-dlvalid"
                    type="date"
                    value={addForm.dlValidTo}
                    onChange={(e) => setAddForm({ ...addForm, dlValidTo: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Credit Limit Sanctioned (₹)</label>
                  <input
                    id="add-chemist-creditlimit"
                    type="number"
                    value={addForm.creditLimit}
                    onChange={(e) => setAddForm({ ...addForm, creditLimit: e.target.value })}
                    placeholder="300000"
                    className="w-full border border-gray-300 rounded p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Credit Terms (Days)</label>
                  <input
                    id="add-chemist-terms"
                    type="number"
                    value={addForm.termsDays}
                    onChange={(e) => setAddForm({ ...addForm, termsDays: e.target.value })}
                    placeholder="30"
                    className="w-full border border-gray-300 rounded p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="add-chemist-pharmacist-check"
                  type="checkbox"
                  checked={addForm.pharmacistOnRecord}
                  onChange={(e) => setAddForm({ ...addForm, pharmacistOnRecord: e.target.checked })}
                  className="rounded text-[#178582] focus:ring-[#178582]"
                />
                <label htmlFor="add-chemist-pharmacist-check" className="font-medium text-gray-700">
                  Registered Pharmacist on record physically present &amp; verified
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="submit-onboard-chemist-btn"
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? "Registering..." : "Complete Onboarding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT CHEMIST & CREDIT TERMS */}
      {showEditModal && customerDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Edit Chemist Terms — {customerDetail.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Update credit limit, payment days, contact information, and beat route
                </p>
              </div>
              <button
                id="btn-close-edit-modal"
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Firm Name</label>
                  <input
                    id="edit-chemist-name"
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Phone Number</label>
                  <input
                    id="edit-chemist-phone"
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Grade</label>
                  <select
                    id="edit-chemist-grade"
                    value={editForm.grade}
                    onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 bg-white"
                  >
                    <option value="Grade A+">Grade A+</option>
                    <option value="Grade A">Grade A</option>
                    <option value="Grade B">Grade B</option>
                    <option value="Grade C">Grade C</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Delivery Route</label>
                  <input
                    id="edit-chemist-route"
                    type="text"
                    value={editForm.route}
                    onChange={(e) => setEditForm({ ...editForm, route: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Salesman</label>
                  <input
                    id="edit-chemist-salesman"
                    type="text"
                    value={editForm.salesman}
                    onChange={(e) => setEditForm({ ...editForm, salesman: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Commercial Address</label>
                <input
                  id="edit-chemist-address"
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full border border-gray-300 rounded p-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-200">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Sanctioned Credit Limit (₹)</label>
                  <input
                    id="edit-chemist-creditlimit"
                    type="number"
                    value={editForm.creditLimit}
                    onChange={(e) => setEditForm({ ...editForm, creditLimit: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 font-mono bg-white font-bold text-gray-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Payment Credit Terms (Days)</label>
                  <input
                    id="edit-chemist-terms"
                    type="number"
                    value={editForm.termsDays}
                    onChange={(e) => setEditForm({ ...editForm, termsDays: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 font-mono bg-white font-bold text-gray-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="submit-edit-chemist-btn"
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BLOCK CHEMIST WITH REASON */}
      {showBlockModal && customerDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-red-900 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-red-600" />
                  <span>Block Account — {customerDetail.name}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Freezes all order dispatch and billing immediately
                </p>
              </div>
              <button
                id="btn-close-block-modal"
                onClick={() => setShowBlockModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">Select Blocking Justification:</label>
                <select
                  id="select-block-reason"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 bg-white"
                >
                  <option value="Credit limit exceeded and invoices overdue > 45 days">
                    Credit limit exceeded and invoices overdue &gt; 45 days
                  </option>
                  <option value="Cheque bounced (Return Code 01 - Insufficient Funds)">
                    Cheque bounced (Return Code 01 - Insufficient Funds)
                  </option>
                  <option value="Statutory Drug Licence expired without renewal proof">
                    Statutory Drug Licence expired without renewal proof
                  </option>
                  <option value="GSTIN registration suspended / cancelled on GSTN portal">
                    GSTIN registration suspended / cancelled on GSTN portal
                  </option>
                  <option value="Owner administrative hold for reconciliation audit">
                    Owner administrative hold for reconciliation audit
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Custom Notes / Audit Trail:</label>
                <textarea
                  id="block-reason-textarea"
                  rows={2}
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="p-3 bg-red-50 rounded border border-red-200 text-red-800 text-[11px] leading-relaxed">
                <strong>Warning:</strong> Blocking this account will prevent salesmen from booking new orders on the field app and stop warehouse picking trays from being released.
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100 mt-4">
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="submit-block-chemist-btn"
                onClick={() => handleToggleBlock("BLOCK")}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {actionLoading ? "Blocking..." : "Confirm & Block Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: FULL FINANCIAL LEDGER STATEMENT */}
      {showLedgerModal && customerDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Customer Financial Ledger — {customerDetail.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  GST-compliant double-entry account statement for {customerDetail.code} · GSTIN {customerDetail.gstin}
                </p>
              </div>
              <button
                id="btn-close-ledger-modal"
                onClick={() => setShowLedgerModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingLedger ? (
              <div className="py-16 text-center text-xs text-gray-400">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-[#178582]" />
                Generating live ledger statement...
              </div>
            ) : ledgerData ? (
              <div className="my-4 space-y-4 text-xs">
                {/* Summary KPIs */}
                <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 text-center">
                  <div>
                    <span className="text-gray-400 text-[10px]">Opening Bal</span>
                    <div className="font-bold text-gray-900 font-mono">
                      ₹{ledgerData.openingBalance.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px]">Debits (Sales)</span>
                    <div className="font-bold text-gray-900 font-mono">
                      ₹{ledgerData.totalDebits.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px]">Credits (Receipts)</span>
                    <div className="font-bold text-emerald-700 font-mono">
                      ₹{ledgerData.totalCredits.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px]">Closing Net Due</span>
                    <div className="font-bold text-[#178582] font-mono">
                      ₹{ledgerData.closingBalance.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>

                {/* Ledger Entries Table */}
                <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-[360px]">
                  <table className="w-full min-w-[540px] text-left">
                    <thead className="bg-gray-100 text-gray-600 text-[10px] uppercase font-semibold sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Voucher Ref</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3 text-right">Debit (₹)</th>
                        <th className="py-2 px-3 text-right">Credit (₹)</th>
                        <th className="py-2 px-3 text-right">Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {ledgerData.entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-600">{entry.date}</td>
                          <td className="py-2 px-3 font-mono font-bold text-gray-900">
                            {entry.referenceNo}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                entry.voucherType === "INVOICE"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : entry.voucherType === "COLLECTION"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-purple-50 text-purple-700 border border-purple-200"
                              }`}
                            >
                              {entry.voucherType}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {entry.debit > 0 ? `₹${entry.debit.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700">
                            {entry.credit > 0 ? `₹${entry.credit.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                            ₹{entry.runningBalance.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <span className="text-[11px] text-gray-400">
                Audited double-entry statement generated from PostgreSQL
              </span>
              <div className="flex items-center gap-2">
                <button
                  id="btn-print-statement"
                  onClick={() => {
                    window.print();
                    showToast("Statement ready for thermal or A4 printing.", "info");
                  }}
                  className="px-3.5 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-gray-600" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  id="btn-close-ledger-bottom"
                  onClick={() => setShowLedgerModal(false)}
                  className="px-4 py-1.5 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: SEND PAYMENT REMINDER */}
      {showReminderModal && customerDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Send Payment Reminder</h3>
                <p className="text-xs text-gray-500">Automated notice for {customerDetail.name}</p>
              </div>
              <button
                id="btn-close-reminder-modal"
                onClick={() => setShowReminderModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-700 leading-relaxed font-sans">
                &ldquo;Dear {customerDetail.name}, this is a gentle reminder regarding pending invoices totaling{" "}
                <strong>₹{customerDetail.creditUsed.toLocaleString("en-IN")}</strong> under your sanctioned terms of{" "}
                {customerDetail.termsDays} days. Click here to remit instantly via UPI QR or Net Banking: [Secure Pay Link]&rdquo;
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Select Delivery Gateway:</label>
                <select
                  id="reminder-channel-select"
                  className="w-full border border-gray-300 rounded p-2 bg-white text-gray-900 font-medium"
                >
                  <option value="WhatsApp Business API">WhatsApp Business API (Instant Delivery with PDF)</option>
                  <option value="SMS DLT Gateway">SMS DLT Gateway (Telecom Regulatory Approved)</option>
                  <option value="Salesman Field Task">Salesman Field App Task (For {customerDetail.salesman})</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-dispatch-reminder"
                onClick={() => handleSendReminder("WhatsApp Business API")}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm disabled:opacity-50"
              >
                {actionLoading ? "Dispatching..." : "Dispatch Reminder"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
