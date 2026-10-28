const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "https://pharma-backend-psi.vercel.app/api";
export const API_BASE_URL = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl.endsWith("/api") ? rawApiUrl : `${rawApiUrl}/api`;

export async function fetchFromApi<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  let authHeader: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("pharma_token");
    if (token) {
      authHeader = { Authorization: `Bearer ${token}` };
    }
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(options?.headers || {})
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const pharmaApi = {
  // Health
  checkHealth: () => fetchFromApi("/health"),

  // Executive Dashboard
  getDashboardSummary: (params?: { range?: string }) => {
    const qs = params?.range ? `?range=${encodeURIComponent(params.range)}` : "";
    return fetchFromApi<any>(`/dashboard/summary${qs}`);
  },
  getDashboardExportUrl: (range?: string) => 
    `${API_BASE_URL}/dashboard/export/csv${range ? `?range=${encodeURIComponent(range)}` : ""}`,

  // Auth
  login: (credentials: { email: string; password?: string }) =>
    fetchFromApi("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    }),
  getMe: () => fetchFromApi("/auth/me"),
  getUsers: () => fetchFromApi("/auth/users"),

  // Order Desk & Sales Order Intake
  getOrderStats: () => fetchFromApi("/orders/stats"),
  getOrders: (params?: { channel?: string; status?: string; creditBlocked?: string; route?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.channel && params.channel !== "all") query.append("channel", params.channel);
    if (params?.status && params.status !== "all") query.append("status", params.status);
    if (params?.creditBlocked && params.creditBlocked !== "all") query.append("creditBlocked", params.creditBlocked);
    if (params?.route && params.route !== "all") query.append("route", params.route);
    if (params?.search) query.append("search", params.search);
    const qs = query.toString();
    return fetchFromApi(`/orders${qs ? `?${qs}` : ""}`);
  },
  getOrderById: (id: string) => fetchFromApi(`/orders/${id}`),
  createOrder: (data: any) =>
    fetchFromApi("/orders", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  toggleOrderHold: (orderId: string) =>
    fetchFromApi(`/orders/${orderId}/hold`, { method: "POST" }),
  overrideOrderCredit: (orderId: string, note?: string) =>
    fetchFromApi(`/orders/${orderId}/override`, {
      method: "POST",
      body: JSON.stringify({ note })
    }),
  billOrder: (orderId: string, overrideReason?: string) =>
    fetchFromApi(`/orders/${orderId}/bill`, {
      method: "POST",
      body: JSON.stringify({ overrideReason })
    }),
  getExportOrdersUrl: () => `${API_BASE_URL}/orders/export/csv`,

  // Invoices & Statutory (GST e-Invoicing, E-Way Bill, Register)
  getBillingStats: () => fetchFromApi("/invoices/stats"),
  getInvoices: (params?: { search?: string; paymentStatus?: string; dispatchStatus?: string; route?: string; filter?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.paymentStatus && params.paymentStatus !== "all") query.append("paymentStatus", params.paymentStatus);
    if (params?.dispatchStatus && params.dispatchStatus !== "all") query.append("dispatchStatus", params.dispatchStatus);
    if (params?.route && params.route !== "all") query.append("route", params.route);
    if (params?.filter && params.filter !== "all") query.append("filter", params.filter);
    const qs = query.toString();
    return fetchFromApi(`/invoices${qs ? `?${qs}` : ""}`);
  },
  getInvoiceById: (id: string) => fetchFromApi(`/invoices/${id}`),
  createInvoice: (data: any) =>
    fetchFromApi("/invoices", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  generateIrn: (invoiceId: string) =>
    fetchFromApi(`/invoices/${invoiceId}/irn`, { method: "POST" }),
  generateEwayBill: (invoiceId: string, vehicleNo?: string, transporterId?: string) =>
    fetchFromApi(`/invoices/${invoiceId}/eway`, {
      method: "POST",
      body: JSON.stringify({ vehicleNo, transporterId })
    }),
  updateInvoiceDispatch: (invoiceId: string, data: { dispatchStatus: string; trayId?: string }) =>
    fetchFromApi(`/invoices/${invoiceId}/dispatch`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  recordInvoicePayment: (invoiceId: string, data: { amount?: number; paymentMode?: string; referenceNo?: string }) =>
    fetchFromApi(`/invoices/${invoiceId}/payment`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  getGstr1ExportUrl: () => `${API_BASE_URL}/invoices/export/csv`,

  // Warehouse Picking & Barcode Verification
  getWaves: (params?: { status?: string; route?: string; search?: string } | string) => {
    if (typeof params === "string") {
      return fetchFromApi(`/warehouse/waves?status=${encodeURIComponent(params)}`);
    }
    const query = new URLSearchParams();
    if (params?.status && params.status !== "all") query.append("status", params.status);
    if (params?.route && params.route !== "all") query.append("route", params.route);
    if (params?.search) query.append("search", params.search);
    const qs = query.toString();
    return fetchFromApi(`/warehouse/waves${qs ? `?${qs}` : ""}`);
  },
  getWarehouseStats: () => fetchFromApi("/warehouse/stats"),
  getPickWaveById: (id: string) => fetchFromApi(`/warehouse/waves/${id}`),
  createPickWave: (data: any) =>
    fetchFromApi("/warehouse/waves", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  scanBarcode: (data: { itemId?: string; waveId?: string; scannedBatch: string }) =>
    fetchFromApi("/warehouse/scan", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  sealWaveTote: (waveId: string, force?: boolean) =>
    fetchFromApi(`/warehouse/waves/${waveId}/seal`, {
      method: "POST",
      body: JSON.stringify({ force })
    }),
  dispatchWaveToVan: (waveId: string, vanAssigned?: string) =>
    fetchFromApi(`/warehouse/waves/${waveId}/dispatch`, {
      method: "POST",
      body: JSON.stringify({ vanAssigned })
    }),
  updateWaveStatus: (waveId: string, status: string) =>
    fetchFromApi(`/warehouse/waves/${waveId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }),
  getExportWarehouseUrl: () => `${API_BASE_URL}/warehouse/export/csv`,

  // Delivery & Dispatch (POD, Vans, Telemetry)
  getDeliveryRoutes: (params?: { search?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchFromApi(`/delivery/routes${query ? `?${query}` : ""}`);
  },
  getDeliveryStats: () => fetchFromApi("/delivery/stats"),
  getDeliveryRouteById: (id: string) => fetchFromApi(`/delivery/routes/${id}`),
  createDeliveryRoute: (data: any) =>
    fetchFromApi("/delivery/routes", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  verifyDeliveryOtp: (dropId: string, collectedAmount?: number, collectionMethod?: string) =>
    fetchFromApi(`/delivery/drops/${dropId}/verify-otp`, {
      method: "POST",
      body: JSON.stringify({ collectedAmount, collectionMethod })
    }),
  recordDropCollection: (dropId: string, data: { amount: number; method: string; referenceNo?: string }) =>
    fetchFromApi(`/delivery/drops/${dropId}/collect`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateDropStatus: (dropId: string, data: { status: string; failureReason?: string }) =>
    fetchFromApi(`/delivery/drops/${dropId}/status`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  settleRouteDayEnd: (routeId: string, data?: any) =>
    fetchFromApi(`/delivery/routes/${routeId}/settle`, {
      method: "POST",
      body: JSON.stringify(data || {})
    }),
  getExportDeliveryUrl: () => `${API_BASE_URL}/delivery/export/csv`,

  // Collections & Reconciliation
  getCollections: (params?: { mode?: string; status?: string; search?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchFromApi(`/collections${query ? `?${query}` : ""}`);
  },
  getCollectionStats: () => fetchFromApi("/collections/stats"),
  recordCollection: (data: Record<string, unknown>) =>
    fetchFromApi("/collections", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  reconcileCollection: (id: string, data: { status: string; bankRef?: string; bounceReason?: string }) =>
    fetchFromApi(`/collections/${id}/reconcile`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  autoMatchBankFeeds: () =>
    fetchFromApi("/collections/auto-match", {
      method: "POST"
    }),
  getExportCollectionsUrl: () => `${API_BASE_URL}/collections/export/csv`,

  // Customer Master & 360° Dossier
  getCustomers: (params?: { search?: string; route?: string; status?: string; grade?: string; sortBy?: string } | string) => {
    if (typeof params === "string") {
      return fetchFromApi(`/customers?search=${encodeURIComponent(params)}`);
    }
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.route && params.route !== "all") query.append("route", params.route);
    if (params?.status && params.status !== "all") query.append("status", params.status);
    if (params?.grade && params.grade !== "all") query.append("grade", params.grade);
    if (params?.sortBy) query.append("sortBy", params.sortBy);
    const qs = query.toString();
    return fetchFromApi(`/customers${qs ? `?${qs}` : ""}`);
  },
  getCustomerStats: () => fetchFromApi("/customers/stats"),
  getCustomerById: (id: string) => fetchFromApi(`/customers/${id}`),
  createCustomer: (data: any) =>
    fetchFromApi("/customers", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateCustomer: (id: string, data: any) =>
    fetchFromApi(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  toggleCustomerStatus: (id: string, data: { status?: string; blockReason?: string }) =>
    fetchFromApi(`/customers/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  getCustomerLedger: (id: string) => fetchFromApi(`/customers/${id}/ledger`),
  sendCustomerReminder: (id: string, data: { channel?: string; amount?: number }) =>
    fetchFromApi(`/customers/${id}/reminder`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  getExportCustomersUrl: () => `${API_BASE_URL}/customers/export/csv`,

  getDashboardMetrics: () => fetchFromApi("/reports/dashboard"),

  // Comprehensive Reports & Business Intelligence
  getReportsKpis: () => fetchFromApi("/reports/kpis"),
  getReportsSales: (params?: { search?: string; paymentStatus?: string; route?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchFromApi(`/reports/sales${query ? `?${query}` : ""}`);
  },
  getReportsStock: (params?: { principal?: string; coldChain?: string; search?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchFromApi(`/reports/stock${query ? `?${query}` : ""}`);
  },
  getReportsOutstanding: (params?: { route?: string; search?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchFromApi(`/reports/outstanding${query ? `?${query}` : ""}`);
  },
  getReportsClaims: (params?: { principal?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchFromApi(`/reports/claims${query ? `?${query}` : ""}`);
  },
  getReportsSalesmen: () => fetchFromApi("/reports/salesmen"),
  getReportsAlerts: () => fetchFromApi("/reports/alerts"),
  getReportsColdChain: () => fetchFromApi("/reports/coldchain"),
  getReportsH1: () => fetchFromApi("/reports/h1"),
  getReportsNearExpiry: () => fetchFromApi("/reports/near-expiry"),
  getExportReportUrl: (reportType: string) => `${API_BASE_URL}/reports/export/${reportType}`,


  // Settings & Master Policy Management (Owner)
  getCompanySettings: () => fetchFromApi("/settings/company"),
  updateCompanySettings: (data: any) =>
    fetchFromApi("/settings/company", {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  getStaffList: () => fetchFromApi("/settings/staff"),
  createStaffAccount: (data: any) =>
    fetchFromApi("/settings/staff", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateStaffAccount: (id: string, data: any) =>
    fetchFromApi(`/settings/staff/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  testGstGateway: () =>
    fetchFromApi("/settings/test-gst", {
      method: "POST"
    }),
  getAuditLogs: (params?: { module?: string; severity?: string; search?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchFromApi(`/settings/audit-logs${query ? `?${query}` : ""}`);
  },

  // Salesmen & Beat Management
  getSalesmen: () => fetchFromApi<{ salesmen: any[] }>("/salesmen"),
  getSalesman: (id: string) => fetchFromApi<{ salesman: any }>(`/salesmen/${id}`),
  createSalesman: (data: { name: string; phone: string; email?: string; beatName: string; todayTarget?: number }) =>
    fetchFromApi("/salesmen", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateSalesman: (id: string, data: any) =>
    fetchFromApi(`/salesmen/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  deleteSalesman: (id: string) =>
    fetchFromApi(`/salesmen/${id}`, {
      method: "DELETE"
    }),
  broadcastBeat: (salesmanId: string) =>
    fetchFromApi(`/salesmen/${salesmanId}/broadcast`, {
      method: "POST"
    }),
  checkInBeatVisit: (visitId: string, coordinates?: string) =>
    fetchFromApi(`/salesmen/visits/${visitId}/check-in`, {
      method: "POST",
      body: JSON.stringify({ coordinates })
    }),
  bookBeatOrder: (visitId: string, orderAmount: number, collectionAmount?: number) =>
    fetchFromApi(`/salesmen/visits/${visitId}/book-order`, {
      method: "POST",
      body: JSON.stringify({ orderAmount, collectionAmount })
    }),
  skipBeatVisit: (visitId: string, reason: string) =>
    fetchFromApi(`/salesmen/visits/${visitId}/skip`, {
      method: "POST",
      body: JSON.stringify({ reason })
    }),
  addBeatStop: (salesmanId: string, data: any) =>
    fetchFromApi(`/salesmen/${salesmanId}/add-stop`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  getSalesmenScorecardUrl: () => `${API_BASE_URL}/salesmen/export/scorecard`,

  // Principal Claims Management
  getClaims: (params?: { status?: string; type?: string; principal?: string; search?: string; overdue?: boolean }) => {
    const queryParams: Record<string, string> = {};
    if (params?.status) queryParams.status = params.status;
    if (params?.type) queryParams.type = params.type;
    if (params?.principal) queryParams.principal = params.principal;
    if (params?.search) queryParams.search = params.search;
    if (params?.overdue !== undefined) queryParams.overdue = String(params.overdue);
    const query = new URLSearchParams(queryParams).toString();
    return fetchFromApi<{ claims: any[] }>(`/claims${query ? `?${query}` : ""}`);
  },
  getClaimStats: () => fetchFromApi<{ success: boolean; stats: any }>("/claims/stats"),
  getClaim: (id: string) => fetchFromApi<{ claim: any }>(`/claims/${id}`),
  createClaim: (data: {
    type: string;
    principalName: string;
    cnfDepot?: string;
    amount: number;
    batchDetails?: string;
    linesCount?: number;
    evidenceFilesCount?: number;
    dateRaised?: string;
    status?: string;
  }) =>
    fetchFromApi<{ success: boolean; claim: any }>("/claims", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateClaimStatus: (id: string, data: { status: string; creditNoteNo?: string; creditNoteAmount?: number }) =>
    fetchFromApi<{ success: boolean; claim: any }>(`/claims/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  settleClaim: (id: string, data?: { creditNoteNo?: string; creditNoteAmount?: number }) =>
    fetchFromApi<{ success: boolean; message: string; claim: any }>(`/claims/${id}/settle`, {
      method: "POST",
      body: JSON.stringify(data || {})
    }),
  deleteClaim: (id: string) =>
    fetchFromApi<{ success: boolean; message: string }>(`/claims/${id}`, {
      method: "DELETE"
    }),
  getClaimsExportUrl: () => `${API_BASE_URL}/claims/export/csv`,

  // Purchase Orders & GRN Inwarding
  getPurchaseOrders: (params?: { status?: string; principal?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "all") query.append("status", params.status);
    if (params?.principal && params.principal !== "all") query.append("principal", params.principal);
    if (params?.search) query.append("search", params.search);
    const qs = query.toString();
    return fetchFromApi<{ orders: any[] }>(`/purchase/orders${qs ? `?${qs}` : ""}`);
  },
  getPurchaseStats: () => fetchFromApi<{ stats: any }>("/purchase/stats"),
  getPurchaseOrderById: (id: string) => fetchFromApi<{ order: any }>(`/purchase/orders/${id}`),
  createPurchaseOrder: (data: any) =>
    fetchFromApi<{ success: boolean; message: string; order: any }>("/purchase/orders", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  processGrn: (id: string, data: { supplierInvoiceNo?: string; receivedItems?: any[] }) =>
    fetchFromApi<{ success: boolean; message: string; order: any }>(`/purchase/orders/${id}/grn`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  getDebitNote: (id: string) => fetchFromApi<{ debitNote: any }>(`/purchase/orders/${id}/debit-note`),
  getPurchaseManifestExportUrl: () => `${API_BASE_URL}/purchase/export/csv`,

  // Products & Stock Catalog
  getProducts: (params?: { search?: string; principal?: string; tab?: string; coldChain?: boolean; scheduleH?: boolean } | string) => {
    if (typeof params === "string") {
      return fetchFromApi<{ products: any[] }>(`/products${params ? `?search=${encodeURIComponent(params)}` : ""}`);
    }
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.principal && params.principal !== "All" && params.principal !== "all") query.append("principal", params.principal);
    if (params?.tab && params.tab !== "all") query.append("tab", params.tab);
    if (params?.coldChain !== undefined) query.append("coldChain", String(params.coldChain));
    if (params?.scheduleH !== undefined) query.append("scheduleH", String(params.scheduleH));
    const qs = query.toString();
    return fetchFromApi<{ products: any[] }>(`/products${qs ? `?${qs}` : ""}`);
  },
  getProductStats: () => fetchFromApi<{ stats: any }>("/products/stats"),
  getProductPrincipals: () => fetchFromApi<{ principals: string[] }>("/products/principals"),
  getProductById: (id: string) => fetchFromApi<{ product: any }>(`/products/${id}`),
  createProduct: (data: any) =>
    fetchFromApi<{ success: boolean; message: string; product: any }>("/products", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  updateProduct: (id: string, data: any) =>
    fetchFromApi<{ success: boolean; message: string; product: any }>(`/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),
  deleteProduct: (id: string) =>
    fetchFromApi<{ success: boolean; message: string }>(`/products/${id}`, {
      method: "DELETE"
    }),
  adjustProductStock: (id: string, data: { batchNumber: string; adjustmentType: string; qty: number; reason?: string; status?: string; expDate?: string }) =>
    fetchFromApi<{ success: boolean; message: string; batch: any; product: any }>(`/products/${id}/adjust-stock`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  addProductBatch: (id: string, data: { batchNumber: string; qty: number; expDate: string; status?: string }) =>
    fetchFromApi<{ success: boolean; message: string; batch: any; product: any }>(`/products/${id}/batches`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
  getProductsExportUrl: () => `${API_BASE_URL}/products/export/csv`
};

export const api = pharmaApi;
export default pharmaApi;
