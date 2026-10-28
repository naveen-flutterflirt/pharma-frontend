"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { 
  Check, 
  AlertTriangle, 
  FileCheck2, 
  Printer, 
  ArrowRight, 
  Search, 
  X, 
  Plus, 
  ShieldAlert, 
  Sparkles, 
  RefreshCw, 
  Truck, 
  FileSpreadsheet, 
  ShieldCheck, 
  ExternalLink
} from "lucide-react";
import { api } from "@/lib/api";

interface OrderItem {
  id: string;
  name: string;
  batch: string;
  exp: string;
  qty: number;
  free: number | string;
  ptr: number;
  gst: number;
  amount: number;
  isShort?: boolean;
  shortNote?: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  channel: string;
  channelLabel: string;
  route: string;
  creditStatus: string;
  creditBlocked: boolean;
  blockReason?: string | null;
  orderTotal: number;
  status: "PENDING" | "HOLD" | "BILLED" | "CANCELLED";
  irn?: string | null;
  ewayBill?: string | null;
  billedAt?: string | null;
  schemeSummary?: string | null;
  freeGoodsValue: number;
  createdAt: string;
  items: OrderItem[];
  customer?: any;
  invoice?: any;
}

interface OrderStats {
  pendingOrdersCount: number;
  pendingOrdersValue: number;
  creditBlockedCount: number;
  creditBlockedValue: number;
  todayOrdersCount: number;
  todayOrdersValue: number;
  freeGoodsValueTotal: number;
  billedOrdersCount: number;
  holdOrdersCount: number;
  channelCounts: {
    salesman: number;
    app: number;
    whatsapp: number;
    counter: number;
  };
}

interface CustomerOption {
  id: string;
  name: string;
  code: string;
  route: string;
  gstin: string;
  creditLimit: number;
  creditUsed: number;
  status: string;
}

export default function OrderDesk() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");

  // Filters
  const [activeTab, setActiveTab] = useState<"all" | "salesman" | "app" | "whatsapp" | "counter">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "warning" | "info">("info");

  // Modals
  const [showBilledModal, setShowBilledModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("Cheque received / Director authorized credit exception");
  const [lastBilledData, setLastBilledData] = useState<{ order: Order; irn: string; ewb: string; tray: string } | null>(null);

  // New Order Form State
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [newOrderCustomerId, setNewOrderCustomerId] = useState("");
  const [newOrderChannel, setNewOrderChannel] = useState("salesman");
  const [newOrderRoute, setNewOrderRoute] = useState("Route 3");
  const [newOrderItems, setNewOrderItems] = useState<Array<{
    name: string;
    batch: string;
    exp: string;
    qty: number;
    free: string;
    ptr: number;
    gst: number;
  }>>([
    {
      name: "Amoxicillin + Clav 625 (10)",
      batch: "AC2504",
      exp: "08/28",
      qty: 60,
      free: "6",
      ptr: 162.40,
      gst: 12
    }
  ]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "warning" | "info" = "info") => {
    setToastMessage(message);
    setToastType(type);
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  // Fetch Orders and Stats
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [ordRes, statsRes] = await Promise.all([
        api.getOrders({
          channel: activeTab !== "all" ? activeTab : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          route: routeFilter !== "all" ? routeFilter : undefined,
          search: searchQuery || undefined
        }),
        api.getOrderStats()
      ]);

      if (ordRes?.orders) {
        setOrders(ordRes.orders);
        if (ordRes.orders.length > 0 && (!selectedOrderId || !ordRes.orders.some((o: Order) => o.id === selectedOrderId))) {
          setSelectedOrderId(ordRes.orders[0].id);
        }
      }

      if (statsRes?.stats) {
        setStats(statsRes.stats);
      }
    } catch (err: any) {
      console.error("Error loading order desk data:", err);
      showToast("Failed to load orders from database", "warning");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, statusFilter, routeFilter, searchQuery, selectedOrderId, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load Customers & Products for New Order modal
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          api.getCustomers().catch(() => null),
          api.getProducts().catch(() => null)
        ]);

        if (cRes?.customers?.length) {
          setCustomers(cRes.customers);
          setNewOrderCustomerId(cRes.customers[0].id);
          if (cRes.customers[0].route) {
            setNewOrderRoute(cRes.customers[0].route);
          }
        }

        if (pRes?.products?.length) {
          setProducts(pRes.products);
        }
      } catch (e) {
        console.error("Error loading master data for order desk:", e);
      }
    };
    loadMasterData();
  }, []);

  // Currently Selected Order
  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || orders[0] || null;
  }, [orders, selectedOrderId]);

  // Extract unique routes from both orders and customers
  const availableRoutes = useMemo(() => {
    const routesSet = new Set<string>();
    orders.forEach((o) => {
      if (o.route) routesSet.add(o.route);
    });
    customers.forEach((c) => {
      if (c.route) routesSet.add(c.route);
    });
    return Array.from(routesSet);
  }, [orders, customers]);

  // Handle Bill Action (Direct or with Override)
  const handleBillAction = useCallback(async () => {
    if (!selectedOrder) return;

    if (selectedOrder.status === "BILLED") {
      showToast(`Order ${selectedOrder.orderNumber} is already billed!`, "info");
      return;
    }

    // Check if customer is credit blocked
    if (selectedOrder.creditBlocked) {
      setShowOverrideModal(true);
      return;
    }

    try {
      const res = await api.billOrder(selectedOrder.id);
      if (res?.success) {
        showToast(`Order ${selectedOrder.orderNumber} billed! Invoice & NIC IRN generated.`, "success");
        setLastBilledData({
          order: res.order,
          irn: res.irn,
          ewb: res.ewayBill || "Exempt (<₹50k)",
          tray: res.tray || "Tray Assigned"
        });
        setShowBilledModal(true);
        fetchData(true);
      }
    } catch (err: any) {
      showToast(err.message || "Error billing order", "warning");
    }
  }, [selectedOrder, fetchData, showToast]);

  // Approve Override & Bill
  const handleApproveOverride = async () => {
    if (!selectedOrder) return;
    try {
      // Step 1: Override credit lock
      await api.overrideOrderCredit(selectedOrder.id, overrideReason);
      // Step 2: Bill order
      const res = await api.billOrder(selectedOrder.id, overrideReason);
      if (res?.success) {
        setShowOverrideModal(false);
        showToast("Manager credit override authorized & order billed!", "success");
        setLastBilledData({
          order: res.order,
          irn: res.irn,
          ewb: res.ewayBill || "Exempt (<₹50k)",
          tray: res.tray || "Tray Assigned"
        });
        setShowBilledModal(true);
        fetchData(true);
      }
    } catch (err: any) {
      showToast(err.message || "Error overriding credit lock", "warning");
    }
  };

  // Keyboard shortcut listener: F9 to Bill
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        handleBillAction();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBillAction]);

  // Handle Hold / Resume toggle
  const handleHoldToggle = async () => {
    if (!selectedOrder) return;
    try {
      const res = await api.toggleOrderHold(selectedOrder.id);
      if (res?.success) {
        const nextStatus = res.order.status;
        if (nextStatus === "HOLD") {
          showToast(`Order ${selectedOrder.orderNumber} placed on HOLD. Picking paused.`, "warning");
        } else {
          showToast(`Order ${selectedOrder.orderNumber} resumed. Ready for billing.`, "info");
        }
        fetchData(true);
      }
    } catch (_err: any) {
      showToast("Error updating order hold status", "warning");
    }
  };

  // Derived Calculations for current active order
  const calculatedTaxable = useMemo(() => {
    if (!selectedOrder || !selectedOrder.items) return 0;
    return selectedOrder.items.reduce((acc, item) => {
      const gst = Number(item.gst) || 12;
      return acc + (Number(item.amount) / (1 + gst / 100));
    }, 0);
  }, [selectedOrder]);

  const calculatedGST = useMemo(() => {
    if (!selectedOrder) return 0;
    return selectedOrder.orderTotal - calculatedTaxable;
  }, [selectedOrder, calculatedTaxable]);

  // Calculate new order modal totals
  const newOrderCalculations = useMemo(() => {
    let total = 0;
    newOrderItems.forEach((it) => {
      const lineTaxable = (Number(it.qty) || 0) * (Number(it.ptr) || 0);
      const lineGst = lineTaxable * ((Number(it.gst) || 0) / 100);
      total += lineTaxable + lineGst;
    });
    return Math.round(total * 100) / 100;
  }, [newOrderItems]);

  const selectedNewOrderCustomer = useMemo(() => {
    return customers.find((c) => c.id === newOrderCustomerId) || null;
  }, [customers, newOrderCustomerId]);

  const newOrderHeadroom = useMemo(() => {
    if (!selectedNewOrderCustomer) return { limit: 0, used: 0, available: 0, willExceed: false };
    const limit = Number(selectedNewOrderCustomer.creditLimit) || 0;
    const used = Number(selectedNewOrderCustomer.creditUsed) || 0;
    const available = Math.max(0, limit - used);
    const willExceed = (used + newOrderCalculations) > limit;
    return { limit, used, available, willExceed };
  }, [selectedNewOrderCustomer, newOrderCalculations]);

  // Submit New Order
  const handleCreateNewOrder = async () => {
    if (!newOrderCustomerId) {
      showToast("Please select a customer", "warning");
      return;
    }
    if (newOrderItems.length === 0) {
      showToast("Please add at least one line item", "warning");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const res = await api.createOrder({
        customerId: newOrderCustomerId,
        channel: newOrderChannel,
        route: newOrderRoute,
        schemeSummary: "Standard Schemes Auto-Applied",
        freeGoodsValue: 1250,
        items: newOrderItems
      });

      if (res?.success) {
        showToast(res.message || "Sales order placed in live queue!", "success");
        setShowNewOrderModal(false);
        fetchData();
        if (res.order) {
          setSelectedOrderId(res.order.id);
        }
      }
    } catch (_err: any) {
      showToast("Failed to create sales order", "warning");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f6f8f9] overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className={`absolute top-4 right-8 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium transition-all transform animate-in slide-in-from-top-3 duration-200 ${
            toastType === "success" 
              ? "bg-emerald-900 text-white border-emerald-700" 
              : toastType === "warning"
              ? "bg-amber-900 text-white border-amber-700"
              : "bg-slate-900 text-white border-slate-700"
          }`}
        >
          {toastType === "success" && <FileCheck2 className="w-5 h-5 text-emerald-400" />}
          {toastType === "warning" && <AlertTriangle className="w-5 h-5 text-amber-400" />}
          {toastType === "info" && <Sparkles className="w-5 h-5 text-blue-400" />}
          <span>{toastMessage}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="ml-2 text-white/70 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & KPI Strip */}
      <header className="px-4 sm:px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Order Desk &amp; Credit Control
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Live Order Intake
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Multi-channel sales order intake, real-time credit validation, and automated FEFO batch allocation.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/billing"
              className="px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-100 transition-colors"
            >
              Tax Invoices →
            </Link>
            <Link
              href="/warehouse"
              className="px-3 py-2 bg-teal-50 border border-teal-200 text-[#178582] rounded-md text-xs font-semibold hover:bg-teal-100 transition-colors"
            >
              Warehouse Picking →
            </Link>
            <button
              id="refresh-orderdesk-btn"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 bg-white border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#178582]" : ""}`} />
            </button>
            <a
              id="export-orders-csv-btn"
              href={api.getExportOrdersUrl()}
              download
              onClick={() => showToast("Downloading Sales Orders Register CSV...", "success")}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </a>
            <button
              id="new-order-btn"
              onClick={() => setShowNewOrderModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#178582] text-white rounded-md text-xs font-semibold hover:bg-[#126b68] transition-colors shadow-sm cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Book Order</span>
            </button>
          </div>
        </div>

        {/* Dynamic KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 font-medium">Pending Orders Queue</div>
            <div className="text-base font-bold text-gray-900 mt-0.5">
              {stats?.pendingOrdersCount ?? orders.filter((o) => o.status === "PENDING").length} Orders
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              ₹{(((stats?.pendingOrdersValue || 0) / 100000)).toFixed(2)} Lakh ready to bill
            </div>
          </div>
          <div className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 font-medium">Credit Blocked Alerts</div>
            <div className="text-base font-bold text-rose-700 mt-0.5">
              {stats?.creditBlockedCount ?? orders.filter((o) => o.creditBlocked).length} Blocked
            </div>
            <div className="text-[11px] text-rose-600 font-medium mt-0.5">
              ₹{(((stats?.creditBlockedValue || 0) / 100000)).toFixed(2)} Lakh awaiting approval
            </div>
          </div>
          <div className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 font-medium">Today&apos;s Order Intake</div>
            <div className="text-base font-bold text-gray-900 mt-0.5">
              ₹{(((stats?.todayOrdersValue || 0) / 100000)).toFixed(2)} Lakh
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {stats?.todayOrdersCount || orders.length} total orders booked
            </div>
          </div>
          <div className="bg-[#fbfcfd] p-3 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-500 font-medium">Schemes &amp; Free Goods</div>
            <div className="text-base font-bold text-emerald-700 mt-0.5">
              ₹{(stats?.freeGoodsValueTotal || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
              Auto-applied to formulation lines
            </div>
          </div>
        </div>
      </header>

      {/* Main Order Workspace (Split Layout) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel: Incoming Orders Queue */}
        <div className="w-full lg:w-[360px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-[#fbfcfd] flex flex-col max-h-[300px] lg:max-h-full">
          <div className="p-3 border-b border-gray-200 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
                <span>Incoming Queue</span>
                <span className="text-gray-400 font-normal text-xs">· {orders.length}</span>
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                LIVE DB
              </span>
            </div>

            {/* Channel Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-md overflow-x-auto">
              <button
                id="channel-tab-all"
                onClick={() => setActiveTab("all")}
                className={`flex-1 py-1 text-[11px] font-medium rounded transition-all cursor-pointer text-center whitespace-nowrap px-2 ${
                  activeTab === "all"
                    ? "bg-white text-gray-900 shadow-xs font-semibold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All ({stats?.todayOrdersCount || orders.length})
              </button>
              <button
                id="channel-tab-salesman"
                onClick={() => setActiveTab("salesman")}
                className={`flex-1 py-1 text-[11px] font-medium rounded transition-all cursor-pointer text-center whitespace-nowrap px-2 ${
                  activeTab === "salesman"
                    ? "bg-white text-gray-900 shadow-xs font-semibold text-blue-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Salesman {stats?.channelCounts?.salesman ? `(${stats.channelCounts.salesman})` : ""}
              </button>
              <button
                id="channel-tab-app"
                onClick={() => setActiveTab("app")}
                className={`flex-1 py-1 text-[11px] font-medium rounded transition-all cursor-pointer text-center whitespace-nowrap px-2 ${
                  activeTab === "app"
                    ? "bg-white text-gray-900 shadow-xs font-semibold text-blue-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                App {stats?.channelCounts?.app ? `(${stats.channelCounts.app})` : ""}
              </button>
              <button
                id="channel-tab-whatsapp"
                onClick={() => setActiveTab("whatsapp")}
                className={`flex-1 py-1 text-[11px] font-medium rounded transition-all cursor-pointer text-center whitespace-nowrap px-2 ${
                  activeTab === "whatsapp"
                    ? "bg-white text-gray-900 shadow-xs font-semibold text-blue-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                WhatsApp {stats?.channelCounts?.whatsapp ? `(${stats.channelCounts.whatsapp})` : ""}
              </button>
              <button
                id="channel-tab-counter"
                onClick={() => setActiveTab("counter")}
                className={`flex-1 py-1 text-[11px] font-medium rounded transition-all cursor-pointer text-center whitespace-nowrap px-2 ${
                  activeTab === "counter"
                    ? "bg-white text-gray-900 shadow-xs font-semibold text-blue-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Counter {stats?.channelCounts?.counter ? `(${stats.channelCounts.counter})` : ""}
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="relative flex-1 min-w-[130px]">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  id="order-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chemist, SO #..."
                  className="pl-8 pr-6 py-1.5 w-full rounded border border-gray-200 text-xs focus:ring-1 focus:ring-[#178582] focus:outline-none bg-white text-gray-900"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <select
                id="status-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-200 rounded py-1.5 px-2 text-[11px] bg-white text-gray-700 font-medium focus:ring-1 focus:ring-[#178582] focus:outline-none cursor-pointer"
              >
                <option value="all">Status: All</option>
                <option value="PENDING">Pending</option>
                <option value="HOLD">Hold</option>
                <option value="BILLED">Billed</option>
              </select>

              <select
                id="route-filter-select"
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
                className="border border-gray-200 rounded py-1.5 px-2 text-[11px] bg-white text-gray-700 font-medium focus:ring-1 focus:ring-[#178582] focus:outline-none cursor-pointer"
              >
                <option value="all">Route: All</option>
                {availableRoutes.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Orders Queue List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {loading ? (
              <div className="py-12 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#178582]" />
                <span>Loading live orders feed...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-400">
                No orders found matching current filters.
              </div>
            ) : (
              orders.map((order) => {
                const isSelected = order.id === selectedOrderId;
                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`p-3 rounded-lg transition-all cursor-pointer group relative ${
                      isSelected
                        ? "bg-white border-2 border-[#178582] shadow-sm ring-1 ring-[#178582]/20"
                        : "bg-white border border-gray-200 hover:border-gray-300 shadow-xs"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-gray-900 text-xs group-hover:text-[#178582] transition-colors">
                        {order.customerName}{" "}
                        <span className="font-normal text-gray-400 text-[11px]">
                          · {order.items ? order.items.length : 1} lines
                        </span>
                      </h3>
                      {order.status === "HOLD" && (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                          HOLD
                        </span>
                      )}
                      {order.status === "BILLED" && (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                          BILLED
                        </span>
                      )}
                      {order.status === "PENDING" && (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                          PENDING
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mb-2">
                      {order.channelLabel} · {order.orderNumber} · {order.route}
                    </p>
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold border rounded-sm ${
                          order.creditBlocked
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : order.creditStatus.includes("Special")
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : order.creditStatus.includes("Licence")
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {order.creditStatus}
                      </span>
                      <span className="text-xs font-bold text-gray-900 font-mono">
                        ₹{order.orderTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Order Workspace */}
        <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
          {selectedOrder ? (
            <>
              {/* Order Header */}
              <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white shadow-xs z-10">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                      {selectedOrder.customerName}
                    </h2>
                    <span className="text-xs font-mono text-gray-500 font-semibold">
                      ({selectedOrder.orderNumber})
                    </span>
                    <div className="flex items-center text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                      GSTIN <Check className="w-3 h-3 text-emerald-600 ml-1 stroke-[2.5]" />
                    </div>
                    <div className="flex items-center text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                      DL Valid <Check className="w-3 h-3 text-emerald-600 ml-1 stroke-[2.5]" />
                    </div>

                    {selectedOrder.status === "HOLD" && (
                      <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 rounded-full animate-pulse">
                        Order on Hold
                      </span>
                    )}
                    {selectedOrder.status === "BILLED" && (
                      <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" /> Billed ({selectedOrder.billedAt || "Sealed"})
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500">
                    Credit Limit ₹{selectedOrder.customer?.creditLimit?.toLocaleString("en-IN") || "3,00,000"} · 
                    Used ₹{selectedOrder.customer?.creditUsed?.toLocaleString("en-IN") || "0"} · 
                    This Order ₹{selectedOrder.orderTotal.toLocaleString("en-IN")} · 
                    Terms {selectedOrder.customer?.termsDays || 30} days · {selectedOrder.route}
                  </p>
                </div>

                {/* Action Buttons: Print, Hold & Bill & Send to Pick (F9) */}
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  <button
                    id="print-order-voucher-btn"
                    onClick={() => {
                      showToast(`Printing Order Voucher ${selectedOrder.orderNumber}...`, "info");
                      window.print();
                    }}
                    title="Print picking slip / order voucher"
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium rounded-md text-xs transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <Printer className="w-3.5 h-3.5 text-gray-500" />
                    <span>Print Slip</span>
                  </button>

                  <button
                    id="toggle-hold-btn"
                    onClick={handleHoldToggle}
                    title="Toggle hold status for this order"
                    className={`px-3.5 py-2 border font-medium rounded-md text-xs transition-all cursor-pointer shadow-xs active:scale-95 ${
                      selectedOrder.status === "HOLD"
                        ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {selectedOrder.status === "HOLD" ? "Resume Order" : "Hold"}
                  </button>

                  <button
                    id="bill-order-f9-btn"
                    onClick={handleBillAction}
                    disabled={selectedOrder.status === "BILLED"}
                    title="Shortcut: Press F9 anywhere on this screen"
                    className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-md text-xs transition-all cursor-pointer shadow-xs active:scale-95 ${
                      selectedOrder.status === "BILLED"
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none"
                        : "bg-[#178582] text-white hover:bg-[#126b68] hover:shadow"
                    }`}
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>Bill &amp; Send to Pick (F9)</span>
                  </button>
                </div>
              </div>

              {/* Billed Statutory Info Strip */}
              {selectedOrder.status === "BILLED" && (
                <div className="bg-emerald-50/80 border-b border-emerald-200 px-6 py-2.5 flex flex-wrap items-center justify-between text-xs text-emerald-900 gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold">Tax Invoice Generated:</span>
                    <Link
                      href="/billing"
                      className="font-mono font-bold text-teal-800 bg-white px-2 py-0.5 rounded border border-emerald-300 hover:underline flex items-center gap-1 shadow-xs"
                    >
                      {selectedOrder.invoice?.invoiceNo || `INV-26-${selectedOrder.orderNumber.replace(/[^0-9]/g, "").slice(-4)}`}
                      <ExternalLink className="w-3 h-3 inline" />
                    </Link>
                    {selectedOrder.irn && (
                      <span className="font-mono text-[10px] text-gray-600 truncate max-w-[220px]" title={selectedOrder.irn}>
                        IRN: {selectedOrder.irn.slice(0, 16)}...
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold bg-white border border-emerald-300 px-2.5 py-0.5 rounded text-emerald-800 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-emerald-600" />
                      {selectedOrder.invoice?.trayId || "Tray 14 · Bin C-04-2"}
                    </span>
                    <Link
                      href="/warehouse"
                      className="font-bold text-teal-800 hover:text-teal-950 underline text-xs"
                    >
                      Track in Warehouse →
                    </Link>
                  </div>
                </div>
              )}

              {/* Warning Banner if Overdue Block exists */}
              {selectedOrder.creditBlocked && (
                <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between text-xs text-rose-700 font-medium">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>System Credit Lock:</strong> {selectedOrder.blockReason || "Customer credit terms exceeded."} Standard dispatch blocked until accounts clearance.
                    </span>
                  </div>
                  <button
                    id="request-override-btn"
                    onClick={() => setShowOverrideModal(true)}
                    className="underline text-rose-800 hover:text-rose-950 font-bold cursor-pointer shrink-0 ml-2"
                  >
                    Request Manager Override
                  </button>
                </div>
              )}

              {/* Order Items Data Grid */}
              <div className="flex-1 overflow-auto p-4 sm:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[700px]">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-200 text-[11px] uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Formulation Product</th>
                        <th className="pb-3 font-semibold">Batch</th>
                        <th className="pb-3 font-semibold">Exp</th>
                        <th className="pb-3 font-semibold text-right">Qty</th>
                        <th className="pb-3 font-semibold text-right">Free</th>
                        <th className="pb-3 font-semibold text-right">PTR</th>
                        <th className="pb-3 font-semibold text-right">GST</th>
                        <th className="pb-3 font-semibold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-900 divide-y divide-gray-50">
                      {selectedOrder.items && selectedOrder.items.length > 0 ? (
                        selectedOrder.items.map((item) => {
                          if (item.isShort) {
                            return (
                              <tr key={item.id} className="bg-rose-50/50 text-rose-700 font-medium">
                                <td className="py-3">
                                  <div className="font-semibold text-rose-900">{item.name}</div>
                                  <div className="text-[10px] text-rose-600">{item.shortNote || "Back-ordered"}</div>
                                </td>
                                <td className="py-3 font-mono text-xs">{item.batch}</td>
                                <td className="py-3">{item.exp}</td>
                                <td className="py-3 text-right font-bold">{item.qty}</td>
                                <td className="py-3 text-right">{item.free}</td>
                                <td className="py-3 text-right font-mono">₹{Number(item.ptr).toFixed(2)}</td>
                                <td className="py-3 text-right">{item.gst}%</td>
                                <td className="py-3 text-right font-bold font-mono">
                                  ₹{Number(item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                              <td className="py-3 font-medium text-gray-900">{item.name}</td>
                              <td className="py-3 font-mono text-xs text-gray-700">{item.batch}</td>
                              <td className="py-3 text-gray-600">{item.exp}</td>
                              <td className="py-3 text-right font-semibold text-gray-900">{item.qty}</td>
                              <td className="py-3 text-right text-emerald-600 font-semibold">{item.free}</td>
                              <td className="py-3 text-right font-mono text-gray-700">₹{Number(item.ptr).toFixed(2)}</td>
                              <td className="py-3 text-right text-gray-500">{item.gst}%</td>
                              <td className="py-3 text-right font-bold text-gray-900 font-mono">
                                ₹{Number(item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-gray-400">
                            No items attached to this sales order voucher.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Summary Blocks */}
              <div className="p-4 sm:p-6 bg-gray-50/70 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Schemes Applied */}
                <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 mb-1 flex items-center justify-between">
                      <span>Schemes applied</span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                        Auto-applied
                      </span>
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">
                      {selectedOrder.schemeSummary || "Standard fast-mover formulation schemes (10+1)"}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                    Free goods value: <span className="font-bold text-emerald-700">₹{selectedOrder.freeGoodsValue.toLocaleString("en-IN")}</span>
                  </p>
                </div>

                {/* Short Supply */}
                <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 mb-1 flex items-center justify-between">
                      <span>Back-order status</span>
                      <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
                        Auto-GRN
                      </span>
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">
                      {selectedOrder.items?.some((i) => i.isShort)
                        ? "Items back-ordered · Auto-billed when next supplier GRN inwarded"
                        : "All formulation lines available in full stock"}
                    </p>
                  </div>
                  <p className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                    Real-time warehouse inventory sync
                  </p>
                </div>

                {/* Invoice Summary */}
                <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Taxable Value:</span>
                      <span className="font-mono font-medium text-gray-800">
                        ₹{calculatedTaxable.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">GST (CGST + SGST):</span>
                      <span className="font-mono font-medium text-gray-800">
                        ₹{calculatedGST.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="font-bold text-gray-900 text-sm">Order Total:</span>
                      <span className="font-bold text-gray-900 text-base font-mono">
                        ₹{selectedOrder.orderTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold mt-2 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>e-Invoice IRN + e-Way bill generated on billing</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select an order from the queue to view details.
            </div>
          )}
        </div>
      </div>

      {/* SUCCESS MODAL: Billed & Sent to Pick */}
      {showBilledModal && lastBilledData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 animate-in zoom-in-95 duration-150 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <FileCheck2 className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Invoice Generated &amp; Sent to Pick!
                </h3>
                <p className="text-xs text-gray-500">
                  Order successfully sealed with NIC e-Invoice IRN and warehouse tote allocated.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-200 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500">Customer:</span>
                <span className="font-bold text-gray-900">{lastBilledData.order.customerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500">Invoice Amount:</span>
                <span className="font-bold text-gray-900 font-mono">₹{lastBilledData.order.orderTotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500">e-Invoice IRN:</span>
                <span className="font-mono text-gray-800 break-all text-[10px]">{lastBilledData.irn}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500">e-Way Bill No:</span>
                <span className="font-mono font-bold text-gray-900">{lastBilledData.ewb}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Warehouse Pick Tote:</span>
                <span className="font-semibold text-[#178582]">{lastBilledData.tray}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <Link
                  href="/billing"
                  className="px-3 py-1.5 bg-teal-50 text-[#178582] border border-teal-200 rounded text-xs font-semibold hover:bg-teal-100 transition-colors"
                >
                  View in Billing →
                </Link>
                <Link
                  href="/warehouse"
                  className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded text-xs font-semibold hover:bg-gray-100 transition-colors"
                >
                  Track in Warehouse →
                </Link>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    window.print();
                    setShowBilledModal(false);
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button
                  onClick={() => {
                    setShowBilledModal(false);
                    const nextPending = orders.find((o) => o.status === "PENDING" && o.id !== lastBilledData.order.id);
                    if (nextPending) {
                      setSelectedOrderId(nextPending.id);
                      showToast(`Switched to next order: ${nextPending.customerName}`, "info");
                    }
                  }}
                  className="px-4 py-1.5 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>Next Order (F9)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERRIDE MODAL: Maker-Checker Credit Clearance */}
      {showOverrideModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 animate-in zoom-in-95 duration-150 border border-rose-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Credit Limit / Overdue Override
                </h3>
                <p className="text-[11px] text-rose-600 font-medium">
                  Compliance Rule: Maker-Checker audit trail enforced
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-3 leading-relaxed">
              <strong>{selectedOrder.customerName}</strong> has an active credit lock:
              <span className="block mt-1 p-2 bg-rose-50 text-rose-800 rounded text-[11px] font-medium border border-rose-200">
                {selectedOrder.blockReason || "Customer account over credit limit."}
              </span>
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Manager Authorization Note:
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Cheque received #409122 / post-dated guarantee"
                  className="w-full text-xs border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 font-medium focus:ring-1 focus:ring-[#178582] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-3.5 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-override-bill-btn"
                onClick={handleApproveOverride}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold cursor-pointer shadow-sm"
              >
                Authorize &amp; Bill (Logged)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW SALES ORDER BOOKING MODAL */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4 pb-2 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#178582]" />
                  Book New Sales Order
                </h3>
                <p className="text-xs text-gray-500">
                  Direct order entry with automatic credit check and scheme application
                </p>
              </div>
              <button
                onClick={() => setShowNewOrderModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">Customer / Chemist</label>
                  <select
                    id="new-order-customer-select"
                    value={newOrderCustomerId}
                    onChange={(e) => {
                      const custId = e.target.value;
                      setNewOrderCustomerId(custId);
                      const c = customers.find((cust) => cust.id === custId);
                      if (c?.route) setNewOrderRoute(c.route);
                    }}
                    className="w-full border border-gray-300 rounded p-2 bg-white text-gray-900 font-medium focus:ring-1 focus:ring-[#178582] focus:outline-none cursor-pointer"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.code} ({c.route})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-800 mb-1">Intake Channel</label>
                  <select
                    id="new-order-channel-select"
                    value={newOrderChannel}
                    onChange={(e) => setNewOrderChannel(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 bg-white text-gray-900 font-medium focus:ring-1 focus:ring-[#178582] focus:outline-none cursor-pointer"
                  >
                    <option value="salesman">Salesman Beat</option>
                    <option value="app">Chemist Portal</option>
                    <option value="whatsapp">WhatsApp OCR</option>
                    <option value="counter">Counter Direct</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Customer Credit Headroom Strip */}
              {selectedNewOrderCustomer && (
                <div 
                  id="new-order-credit-headroom"
                  className={`p-2.5 rounded border text-xs flex items-center justify-between ${
                    newOrderHeadroom.willExceed 
                      ? "bg-rose-50 border-rose-200 text-rose-800" 
                      : "bg-emerald-50 border-emerald-200 text-emerald-800"
                  }`}
                >
                  <div>
                    <span className="font-semibold">Credit Limit:</span> ₹{newOrderHeadroom.limit.toLocaleString("en-IN")} ·{" "}
                    <span className="font-semibold">Used:</span> ₹{newOrderHeadroom.used.toLocaleString("en-IN")} ·{" "}
                    <span className="font-semibold">Available Headroom:</span> ₹{newOrderHeadroom.available.toLocaleString("en-IN")}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    newOrderHeadroom.willExceed ? "bg-rose-200 text-rose-900" : "bg-emerald-200 text-emerald-900"
                  }`}>
                    {newOrderHeadroom.willExceed ? "Credit Lock Warning" : "Credit OK"}
                  </span>
                </div>
              )}

              {/* Datalist for catalog products */}
              <datalist id="orderdesk-product-catalog">
                {products.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} · {p.batches?.[0]?.batchNo || "Batch"} · ₹{p.ptr || p.mrp || 100}
                  </option>
                ))}
              </datalist>

              {/* Order Items Builder */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-bold text-gray-800">Order Lines ({newOrderItems.length})</label>
                  <button
                    type="button"
                    id="add-order-line-btn"
                    onClick={() =>
                      setNewOrderItems([
                        ...newOrderItems,
                        {
                          name: products[0]?.name || "Pantoprazole 40 (15)",
                          batch: products[0]?.batches?.[0]?.batchNo || "PN2504",
                          exp: products[0]?.batches?.[0]?.exp || "10/28",
                          qty: 50,
                          free: "5",
                          ptr: Number(products[0]?.ptr) || 98.10,
                          gst: Number(products[0]?.gstPercent) || 12
                        }
                      ])
                    }
                    className="text-[#178582] hover:text-[#126b68] font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {newOrderItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 rounded border border-gray-200 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-5">
                        <label className="block text-[10px] text-gray-500 mb-0.5">Product</label>
                        <input
                          type="text"
                          list="orderdesk-product-catalog"
                          value={item.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            const up = [...newOrderItems];
                            up[idx].name = val;
                            const matchedProd = products.find((p) => p.name.toLowerCase() === val.toLowerCase());
                            if (matchedProd) {
                              if (matchedProd.batches?.[0]) {
                                up[idx].batch = matchedProd.batches[0].batchNo;
                                up[idx].exp = matchedProd.batches[0].exp;
                              }
                              if (matchedProd.ptr) {
                                up[idx].ptr = Number(matchedProd.ptr);
                              }
                              if (matchedProd.gstPercent) {
                                up[idx].gst = Number(matchedProd.gstPercent);
                              }
                            }
                            setNewOrderItems(up);
                          }}
                          placeholder="Type or select product..."
                          className="w-full border border-gray-300 rounded p-1 text-xs bg-white text-gray-900 font-medium"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-0.5">Batch</label>
                        <input
                          type="text"
                          value={item.batch}
                          onChange={(e) => {
                            const up = [...newOrderItems];
                            up[idx].batch = e.target.value;
                            setNewOrderItems(up);
                          }}
                          className="w-full border border-gray-300 rounded p-1 text-xs bg-white text-gray-900 font-medium"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-0.5">Qty</label>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => {
                            const up = [...newOrderItems];
                            up[idx].qty = Number(e.target.value);
                            setNewOrderItems(up);
                          }}
                          className="w-full border border-gray-300 rounded p-1 text-xs bg-white text-gray-900 font-bold"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-0.5">PTR (₹)</label>
                        <input
                          type="number"
                          value={item.ptr}
                          onChange={(e) => {
                            const up = [...newOrderItems];
                            up[idx].ptr = Number(e.target.value);
                            setNewOrderItems(up);
                          }}
                          className="w-full border border-gray-300 rounded p-1 text-xs bg-white text-gray-900 font-mono"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center pt-3">
                        {newOrderItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewOrderItems(newOrderItems.filter((_, i) => i !== idx))}
                            className="text-gray-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Total Bar */}
              <div className="p-3 bg-gray-50 rounded border border-gray-200 flex justify-between items-center text-xs">
                <span className="text-gray-600 font-medium">Calculated Order Total:</span>
                <span className="text-base font-bold text-gray-900 font-mono">
                  ₹{newOrderCalculations.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="px-3.5 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="submit-new-order-btn"
                disabled={isSubmittingOrder}
                onClick={handleCreateNewOrder}
                className="px-4 py-2 bg-[#178582] text-white rounded text-xs font-semibold hover:bg-[#126b68] cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {isSubmittingOrder ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Booking Order...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Place Order in Queue</span>
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
