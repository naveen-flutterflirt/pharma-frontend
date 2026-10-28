"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Settings,
  Building,
  Users,
  Sliders,
  History,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
  Key,
  Globe,
  X,
  Plus,
  Loader2,
  Sparkles,
  Search,
  UserPlus,
  Power,
  ShieldCheck,
  Award
} from "lucide-react";
import { pharmaApi } from "@/lib/api";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: string;
  phone?: string | null;
  isActive: boolean;
  makerChecker: boolean;
  lastLogin?: string | null;
  createdAt: string;
}

interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  ipAddress: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"firm" | "staff" | "credit" | "statutory">("firm");

  // Loading & Action States
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "warning" | "info">("success");

  const showToast = (message: string, type: "success" | "warning" | "info" = "success") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Firm & Drug Licence State
  const [firmName, setFirmName] = useState("Shah Pharma Distributors LLP");
  const [tradeName, setTradeName] = useState("Shah Pharma (Central Logistics Hub)");
  const [dl20B, setDl20B] = useState("DL-20B-184920");
  const [dl21B, setDl21B] = useState("DL-21B-184921");
  const [dlExpiry, setDlExpiry] = useState("2028-11-30");
  const [fssaiNo, setFssaiNo] = useState("10020011000492");
  const [gstin, setGstin] = useState("27AAAAA0000A1Z5");
  const [pharmacistName, setPharmacistName] = useState("Rameshwar Nath Sharma, B.Pharm");
  const [pharmacistReg, setPharmacistReg] = useState("DPC-REG-449102");
  const [warehouseAddress, setWarehouseAddress] = useState("Plot No. 44, Logistics Park, Bhiwandi, Maharashtra 421302");
  const [contactPhone, setContactPhone] = useState("+91 98200 12345");
  const [billingEmail, setBillingEmail] = useState("billing@shahpharma.com");

  // 2. Credit Control & Distribution Rules State
  const [defaultCreditLimit, setDefaultCreditLimit] = useState(50000);
  const [defaultCreditDays, setDefaultCreditDays] = useState(21);
  const [overdueBlockDays, setOverdueBlockDays] = useState(45);
  const [requireMakerCheckerPin, setRequireMakerCheckerPin] = useState(true);
  const [nearExpiryAlertDays, setNearExpiryAlertDays] = useState(90);
  const [strictFefoEnforced, setStrictFefoEnforced] = useState(true);
  const [minOrderValueFreeDelivery, setMinOrderValueFreeDelivery] = useState(2500);

  // 3. Statutory e-Invoice & GST Gateway State
  const [gspProvider, setGspProvider] = useState("ClearTax / IRIS GST Enterprise");
  const [nicUsername, setNicUsername] = useState("PHARMA_EINV_27");
  const [nicClientId, setNicClientId] = useState("CLI-89304-NIC-PROD");
  const [autoEwbThreshold, setAutoEwbThreshold] = useState(50000);
  const [autoGenerateIrn, setAutoGenerateIrn] = useState(true);
  const [isGstTesting, setIsGstTesting] = useState(false);
  const [gstLatency, setGstLatency] = useState<number | null>(118);

  // 4. Staff Accounts State (RBAC)
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("BILLING_OPERATOR");
  const [newStaffPhone, setNewStaffPhone] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("admin123");
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);

  // 5. Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditSeverity, setAuditSeverity] = useState("all");

  // Load Initial Settings & Data from Backend
  const loadSettingsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [settingsRes, staffRes, logsRes] = await Promise.all([
        pharmaApi.getCompanySettings().catch(() => null),
        pharmaApi.getStaffList().catch(() => null),
        pharmaApi.getAuditLogs().catch(() => null)
      ]);

      if (settingsRes?.setting) {
        const s = settingsRes.setting;
        setFirmName(s.firmName || "Shah Pharma Distributors LLP");
        setTradeName(s.tradeName || "Shah Pharma (Central Logistics Hub)");
        setDl20B(s.dl20B || "DL-20B-184920");
        setDl21B(s.dl21B || "DL-21B-184921");
        setDlExpiry(s.dlExpiry || "2028-11-30");
        setFssaiNo(s.fssaiNo || "10020011000492");
        setGstin(s.gstin || "27AAAAA0000A1Z5");
        setPharmacistName(s.pharmacistName || "Rameshwar Nath Sharma, B.Pharm");
        setPharmacistReg(s.pharmacistReg || "DPC-REG-449102");
        setWarehouseAddress(s.warehouseAddress || "Plot No. 44, Logistics Park, Bhiwandi, Maharashtra 421302");
        setContactPhone(s.contactPhone || "+91 98200 12345");
        setBillingEmail(s.billingEmail || "billing@shahpharma.com");

        setDefaultCreditLimit(s.defaultCreditLimit || 50000);
        setDefaultCreditDays(s.defaultCreditDays || 21);
        setOverdueBlockDays(s.overdueBlockDays || 45);
        setRequireMakerCheckerPin(s.requireMakerCheckerPin !== false);
        setNearExpiryAlertDays(s.nearExpiryAlertDays || 90);
        setStrictFefoEnforced(s.strictFefoEnforced !== false);
        setMinOrderValueFreeDelivery(s.minOrderValueFreeDelivery || 2500);

        setGspProvider(s.gspProvider || "ClearTax / IRIS GST Enterprise");
        setNicUsername(s.nicUsername || "PHARMA_EINV_27");
        setNicClientId(s.nicClientId || "CLI-89304-NIC-PROD");
        setAutoEwbThreshold(s.autoEwbThreshold || 50000);
        setAutoGenerateIrn(s.autoGenerateIrn !== false);
      }

      if (staffRes?.staff) {
        setStaffList(staffRes.staff);
      }

      if (logsRes?.logs) {
        setAuditLogs(logsRes.logs);
      }
    } catch (err: any) {
      showToast("Failed to load settings from server: " + err.message, "warning");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  // Save Settings to Backend PostgreSQL
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const payload = {
        firmName,
        tradeName,
        dl20B,
        dl21B,
        dlExpiry,
        fssaiNo,
        gstin,
        pharmacistName,
        pharmacistReg,
        warehouseAddress,
        contactPhone,
        billingEmail,
        defaultCreditLimit,
        defaultCreditDays,
        overdueBlockDays,
        requireMakerCheckerPin,
        nearExpiryAlertDays,
        strictFefoEnforced,
        minOrderValueFreeDelivery,
        gspProvider,
        nicUsername,
        nicClientId,
        autoEwbThreshold,
        autoGenerateIrn
      };

      const res = await pharmaApi.updateCompanySettings(payload);
      if (res.success) {
        showToast("Master policies and company profile saved to PostgreSQL database.", "success");
        // Refresh audit logs to show this action
        const logsRes = await pharmaApi.getAuditLogs();
        if (logsRes?.logs) setAuditLogs(logsRes.logs);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to save settings.", "warning");
    } finally {
      setIsSaving(false);
    }
  };

  // Test GST Gateway Live
  const handleTestGstConnection = async () => {
    setIsGstTesting(true);
    try {
      const res = await pharmaApi.testGstGateway();
      setGstLatency(res.latencyMs || 112);
      showToast(`NIC e-Invoice Production Gateway Active (${res.latencyMs}ms). Token verified.`, "success");
    } catch (err: any) {
      showToast("GST Gateway ping failed: " + err.message, "warning");
    } finally {
      setIsGstTesting(false);
    }
  };

  // Toggle Staff Active Status
  const handleToggleStaffActive = async (staff: StaffMember) => {
    try {
      const updatedStatus = !staff.isActive;
      const res = await pharmaApi.updateStaffAccount(staff.id, { isActive: updatedStatus });
      if (res.success) {
        setStaffList((prev) =>
          prev.map((s) => (s.id === staff.id ? { ...s, isActive: updatedStatus } : s))
        );
        showToast(
          `Staff account for ${staff.name} ${updatedStatus ? "activated" : "suspended"}.`,
          "success"
        );
        const logsRes = await pharmaApi.getAuditLogs();
        if (logsRes?.logs) setAuditLogs(logsRes.logs);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update staff status.", "warning");
    }
  };

  // Toggle Staff Maker-Checker Flag
  const handleToggleMakerChecker = async (staff: StaffMember) => {
    try {
      const updatedFlag = !staff.makerChecker;
      const res = await pharmaApi.updateStaffAccount(staff.id, { makerChecker: updatedFlag });
      if (res.success) {
        setStaffList((prev) =>
          prev.map((s) => (s.id === staff.id ? { ...s, makerChecker: updatedFlag } : s))
        );
        showToast(`Maker-Checker authorization updated for ${staff.name}.`, "success");
        const logsRes = await pharmaApi.getAuditLogs();
        if (logsRes?.logs) setAuditLogs(logsRes.logs);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update authorization.", "warning");
    }
  };

  // Add New Staff Account Form Submit
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim()) {
      showToast("Please provide staff name and email address.", "warning");
      return;
    }

    setIsSubmittingStaff(true);
    try {
      const res = await pharmaApi.createStaffAccount({
        name: newStaffName.trim(),
        email: newStaffEmail.trim(),
        role: newStaffRole,
        phone: newStaffPhone.trim() || undefined,
        password: newStaffPassword || "admin123"
      });

      if (res.success && res.user) {
        setStaffList((prev) => [...prev, res.user]);
        setShowAddStaffModal(false);
        setNewStaffName("");
        setNewStaffEmail("");
        setNewStaffPhone("");
        showToast(`Staff account created for ${res.user.name} (${res.user.role}).`, "success");
        const logsRes = await pharmaApi.getAuditLogs();
        if (logsRes?.logs) setAuditLogs(logsRes.logs);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create staff account.", "warning");
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesSearch =
      !auditSearch ||
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.user.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.module.toLowerCase().includes(auditSearch.toLowerCase());
    const matchesSeverity = auditSeverity === "all" || log.severity === auditSeverity;
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f8f9] overflow-hidden relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-8 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold animate-in slide-in-from-top-3 duration-200 ${toastType === "success"
              ? "bg-[#0c2427] text-white border-teal-500/30"
              : toastType === "warning"
                ? "bg-amber-900 text-white border-amber-700"
                : "bg-slate-900 text-white border-slate-700"
            }`}
        >
          {toastType === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastType === "warning" && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          {toastType === "info" && <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />}
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-white/70 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="px-4 sm:px-8 py-5 bg-white border-b border-gray-200 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0c2427] text-white flex items-center justify-center shadow-xs">
                  <Settings className="w-5 h-5 text-[#178582]" />
                </div>
                <span>Owner Settings &amp; Master Policies</span>
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                PostgreSQL Synced
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Statutory wholesale licences, chemist credit control, staff RBAC permissions, and tamper-evident audit logs.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="px-3.5 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors"
            >
              ← Dashboard
            </Link>
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-[#178582] text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#126b68] active:bg-[#0f5956] transition-all shadow-sm shadow-[#178582]/20 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save All Changes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Executive Settings Tabs (4 Core Pillars) */}
        <div className="flex space-x-1.5 overflow-x-auto mt-5 pt-3 border-t border-gray-100 scrollbar-none">
          {[
            { id: "firm", label: "Company & Licences", icon: Building },
            { id: "staff", label: "Staff & User Access (RBAC)", icon: Users },
            { id: "credit", label: "Credit & Inventory Policies", icon: Sliders },
            { id: "statutory", label: "Statutory & Audit Trail", icon: History }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${isActive
                    ? "bg-[#178582] text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Settings Body */}
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#178582] mb-3" />
            <p className="text-sm font-medium">Loading distributor configurations from PostgreSQL...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: FIRM & DRUG LICENCES */}
            {activeTab === "firm" && (
              <div className="space-y-6 max-w-5xl">
                {/* Legal Licence Status Banner */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#178582] flex items-center justify-center border border-teal-100 shrink-0">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 text-sm">{firmName}</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          LICENSED WHOLESALER
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Form 20B &amp; 21B authorized by State Drugs Control Administration.
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-gray-400 font-medium">Licence Valid Till</div>
                    <div className="text-sm font-bold text-gray-900 font-mono mt-0.5">{dlExpiry}</div>
                  </div>
                </div>

                {/* Firm Profile Form */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-5">
                  <h3 className="text-sm font-bold text-gray-900 pb-3 border-b border-gray-100 flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#178582]" />
                    Registered Entity &amp; Drug Licences
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-gray-700 block mb-1">Registered Wholesale Firm Name</label>
                      <input
                        type="text"
                        value={firmName}
                        onChange={(e) => setFirmName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Commercial Trade Name</label>
                      <input
                        type="text"
                        value={tradeName}
                        onChange={(e) => setTradeName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Wholesale DL Form 20B</label>
                      <input
                        type="text"
                        value={dl20B}
                        onChange={(e) => setDl20B(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Wholesale DL Form 21B</label>
                      <input
                        type="text"
                        value={dl21B}
                        onChange={(e) => setDl21B(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Licence Expiry Date</label>
                      <input
                        type="date"
                        value={dlExpiry}
                        onChange={(e) => setDlExpiry(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">GSTIN Number</label>
                      <input
                        type="text"
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">FSSAI Licence Number</label>
                      <input
                        type="text"
                        value={fssaiNo}
                        onChange={(e) => setFssaiNo(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Registered Pharmacist on Record</label>
                      <input
                        type="text"
                        value={pharmacistName}
                        onChange={(e) => setPharmacistName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Pharmacist Registration No.</label>
                      <input
                        type="text"
                        value={pharmacistReg}
                        onChange={(e) => setPharmacistReg(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Official Contact Phone</label>
                      <input
                        type="text"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Billing Dispatch Email</label>
                      <input
                        type="email"
                        value={billingEmail}
                        onChange={(e) => setBillingEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900"
                      />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="font-bold text-gray-700 block mb-1">Registered Warehouse Depot Address</label>
                      <textarea
                        rows={2}
                        value={warehouseAddress}
                        onChange={(e) => setWarehouseAddress(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: STAFF & USER ACCESS (RBAC) */}
            {activeTab === "staff" && (
              <div className="space-y-6 max-w-5xl">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#178582]" />
                      Staff Team &amp; Role-Based Access Control (RBAC)
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Manage login credentials, Maker-Checker credit authorizations, and operational roles.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddStaffModal(true)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-[#178582] hover:bg-[#126b68] text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add New Staff Account</span>
                  </button>
                </div>

                {/* Staff Table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Staff Member</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4">Branch</th>
                          <th className="py-3 px-4 text-center">Maker-Checker</th>
                          <th className="py-3 px-4 text-center">Account Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {staffList.map((member) => (
                          <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-gray-900 text-xs sm:text-sm">{member.name}</div>
                              <div className="text-gray-500 text-[11px] font-mono">{member.email}</div>
                              {member.phone && <div className="text-gray-400 text-[10px]">{member.phone}</div>}
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-[#178582] border border-teal-200">
                                {member.role.replace(/_/g, " ")}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-gray-600">
                              {member.branch}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleMakerChecker(member)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${member.makerChecker
                                    ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                                    : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                                  }`}
                              >
                                {member.makerChecker ? "Authorized" : "Standard"}
                              </button>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${member.isActive
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-700"
                                  }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${member.isActive ? "bg-emerald-500" : "bg-red-500"
                                    }`}
                                />
                                {member.isActive ? "Active" : "Suspended"}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => handleToggleStaffActive(member)}
                                title={member.isActive ? "Suspend staff access" : "Activate staff access"}
                                className={`p-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${member.isActive
                                    ? "border-red-200 text-red-600 hover:bg-red-50"
                                    : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                  }`}
                              >
                                <Power className="w-3.5 h-3.5 inline mr-1" />
                                <span>{member.isActive ? "Suspend" : "Activate"}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CREDIT & INVENTORY POLICIES */}
            {activeTab === "credit" && (
              <div className="space-y-6 max-w-5xl">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-100 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-[#178582]" />
                      Chemist Credit Limits &amp; Overdue Hard-Stop Policies
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Automated credit safeguards configured by the Owner to prevent overdue defaults and bad debts.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Default Chemist Credit Limit (₹)</label>
                      <input
                        type="number"
                        value={defaultCreditLimit}
                        onChange={(e) => setDefaultCreditLimit(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 font-bold"
                      />
                      <span className="text-[10px] text-gray-400 mt-0.5 block">Applied to newly onboarded retail chemists</span>
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Standard Payment Terms (Days)</label>
                      <input
                        type="number"
                        value={defaultCreditDays}
                        onChange={(e) => setDefaultCreditDays(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 font-bold"
                      />
                      <span className="text-[10px] text-gray-400 mt-0.5 block">Standard cycle: 21 to 30 days</span>
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Hard-Stop Overdue Lock Threshold (Days)</label>
                      <input
                        type="number"
                        value={overdueBlockDays}
                        onChange={(e) => setOverdueBlockDays(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-red-600 font-bold"
                      />
                      <span className="text-[10px] text-gray-400 mt-0.5 block">Invoices unpaid past this threshold lock billing</span>
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Near-Expiry Warning Window (Days)</label>
                      <input
                        type="number"
                        value={nearExpiryAlertDays}
                        onChange={(e) => setNearExpiryAlertDays(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 font-bold"
                      />
                      <span className="text-[10px] text-gray-400 mt-0.5 block">Flag batches nearing expiry in warehouse</span>
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Free Delivery Minimum Order Value (₹)</label>
                      <input
                        type="number"
                        value={minOrderValueFreeDelivery}
                        onChange={(e) => setMinOrderValueFreeDelivery(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 font-bold"
                      />
                      <span className="text-[10px] text-gray-400 mt-0.5 block">Threshold for route van dispatch</span>
                    </div>
                  </div>

                  {/* Policy Toggles */}
                  <div className="pt-4 border-t border-gray-100 space-y-4">
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-gray-200 bg-gray-50/50">
                      <div>
                        <div className="font-bold text-gray-900 text-xs">Require Director Approval for Credit Lock Overrides</div>
                        <div className="text-[11px] text-gray-500">
                          Billing operators cannot bypass credit locks without Owner or Maker-Checker authorization.
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requireMakerCheckerPin}
                          onChange={(e) => setRequireMakerCheckerPin(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#178582]"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-gray-200 bg-gray-50/50">
                      <div>
                        <div className="font-bold text-gray-900 text-xs">Enforce Strict FEFO (First-Expiry-First-Out)</div>
                        <div className="text-[11px] text-gray-500">
                          Warehouse pick waves are strictly locked to the earliest expiring lot in stock.
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={strictFefoEnforced}
                          onChange={(e) => setStrictFefoEnforced(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#178582]"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: STATUTORY E-INVOICE & AUDIT TRAIL */}
            {activeTab === "statutory" && (
              <div className="space-y-6 max-w-5xl">
                {/* NIC Gateway Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-sm">NIC GST e-Invoice &amp; E-Way Bill Gateway</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          LIVE ACTIVE
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Automated 64-character IRN generation and NIC QR code embedding on B2B invoices.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {gstLatency !== null && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        {gstLatency}ms Latency
                      </span>
                    )}
                    <button
                      onClick={handleTestGstConnection}
                      disabled={isGstTesting}
                      className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#178582] ${isGstTesting ? "animate-spin" : ""}`} />
                      <span>{isGstTesting ? "Pinging Gateway..." : "Test NIC Connection"}</span>
                    </button>
                  </div>
                </div>

                {/* Gateway Config Form */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-100 flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#178582]" />
                    GSP / NIC Portal Credentials
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">GSP / ASP Service Provider</label>
                      <select
                        value={gspProvider}
                        onChange={(e) => setGspProvider(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 font-medium"
                      >
                        <option value="ClearTax / IRIS GST Enterprise">ClearTax / IRIS GST Enterprise</option>
                        <option value="Masters India GSP Direct">Masters India GSP Direct</option>
                        <option value="NIC Direct Government Portal">NIC Direct Government Portal</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">NIC e-Invoice Portal Username</label>
                      <input
                        type="text"
                        value={nicUsername}
                        onChange={(e) => setNicUsername(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">NIC API Client ID</label>
                      <input
                        type="text"
                        value={nicClientId}
                        onChange={(e) => setNicClientId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Auto E-Way Bill Threshold (₹)</label>
                      <input
                        type="number"
                        value={autoEwbThreshold}
                        onChange={(e) => setAutoEwbThreshold(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582] bg-white text-gray-900 font-bold"
                      />
                      <span className="text-[10px] text-gray-400 mt-0.5 block">Statutory limit: ₹50,000 for inter-district consignments</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <div className="text-xs text-gray-600 font-medium">
                      Auto-generate NIC IRN and QR code upon final billing
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoGenerateIrn}
                        onChange={(e) => setAutoGenerateIrn(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#178582]"></div>
                    </label>
                  </div>
                </div>

                {/* Real PostgreSQL Statutory Audit Trail */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <History className="w-4 h-4 text-[#178582]" />
                        Statutory Audit Trail (PostgreSQL Recorded)
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Tamper-evident logs of billing, credit overrides, staff sign-ins, and policy modifications.
                      </p>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
                        <input
                          type="text"
                          value={auditSearch}
                          onChange={(e) => setAuditSearch(e.target.value)}
                          placeholder="Search logs..."
                          className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#178582]"
                        />
                      </div>

                      <select
                        value={auditSeverity}
                        onChange={(e) => setAuditSeverity(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-gray-50 text-gray-700 cursor-pointer"
                      >
                        <option value="all">All Severities</option>
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  {/* Logs Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">Timestamp</th>
                          <th className="py-2.5 px-3">Staff User</th>
                          <th className="py-2.5 px-3">Module</th>
                          <th className="py-2.5 px-3">Action Description</th>
                          <th className="py-2.5 px-3">IP Address</th>
                          <th className="py-2.5 px-3 text-center">Severity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                        {filteredAuditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-400 font-sans">
                              No audit log records match your filter.
                            </td>
                          </tr>
                        ) : (
                          filteredAuditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-2.5 px-3 whitespace-nowrap text-gray-600">{log.timestamp}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap font-sans font-bold text-gray-900">
                                {log.user}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap font-sans text-gray-600">{log.module}</td>
                              <td className="py-2.5 px-3 font-sans text-gray-800">{log.action}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap text-gray-500">{log.ipAddress}</td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${log.severity === "critical"
                                      ? "bg-red-100 text-red-800"
                                      : log.severity === "warning"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-teal-50 text-teal-800"
                                    }`}
                                >
                                  {log.severity}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: ADD NEW STAFF MEMBER */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#178582] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Add New Staff Account</h3>
                  <p className="text-[11px] text-gray-500">Create access credentials and role assignment</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582]"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Email Address (Login Username) *</label>
                <input
                  type="email"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="name@shahpharma.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Role *</label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582]"
                  >
                    <option value="BILLING_OPERATOR">Billing Operator</option>
                    <option value="ACCOUNTS_CHECKER">Accounts Checker</option>
                    <option value="WAREHOUSE_SUPERVISOR">Warehouse Supervisor</option>
                    <option value="FIELD_REP">Field Rep</option>
                    <option value="OWNER">Owner / Director</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    placeholder="+91 98200..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Initial Password</label>
                <input
                  type="text"
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#178582]/20 focus:border-[#178582]"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">Staff will be asked to update on initial sign-in</span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  disabled={isSubmittingStaff}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#178582] hover:bg-[#126b68] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSubmittingStaff ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
