"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  FileText, 
  Receipt, 
  Package, 
  ShoppingCart, 
  Warehouse, 
  Truck, 
  Users, 
  IndianRupee, 
  ShieldAlert, 
  UserCheck, 
  BarChart3, 
  Settings as SettingsIcon,
  ChevronRight,
  LogOut,
  Shield,
  Loader2,
  Building2,
  Mail
} from "lucide-react";

const menuItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Order Desk", href: "/order-desk", icon: FileText },
  { name: "Billing", href: "/billing", icon: Receipt },
  { name: "Products & Stock", href: "/products", icon: Package },
  { name: "Purchase", href: "/purchase", icon: ShoppingCart },
  { name: "Warehouse", href: "/warehouse", icon: Warehouse },
  { name: "Delivery", href: "/delivery", icon: Truck },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Collections", href: "/collections", icon: IndianRupee },
  { name: "Claims", href: "/claims", icon: ShieldAlert },
  { name: "Salesmen", href: "/salesmen", icon: UserCheck },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: SettingsIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (pathname === "/login") {
    return null;
  }

  const activeItem = menuItems.find((item) => item.href === pathname) || menuItems[0];

  // Helper to extract clean initials from staff name
  const getInitials = (name?: string) => {
    if (!name) return "AD";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const formattedRole = user?.role
    ? user.role.replace(/_/g, " ")
    : "DIRECTOR";

  return (
    <>
      {/* MOBILE TOP NAVBAR */}
      <div className="md:hidden w-full bg-[#0c2427] text-white px-4 py-3 flex items-center justify-between border-b border-[#153a3e] shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#178582] flex items-center justify-center font-bold text-sm">
            +
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight leading-tight">[Distributor] DMS</span>
            <span className="text-[10px] text-[#8ea7aa] leading-tight flex items-center gap-1">
              <span>{activeItem.name}</span>
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle navigation menu"
          className="p-1.5 rounded-lg bg-[#153a3e] hover:bg-[#1c4d52] text-white transition-colors cursor-pointer"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* MOBILE SLIDE-OUT DRAWER */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[80vw] bg-[#0c2427] text-[#8ea7aa] h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="p-5 flex items-center justify-between border-b border-[#153a3e] text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#178582] flex items-center justify-center font-bold text-base">
                  +
                </div>
                <div>
                  <div className="font-bold text-base leading-tight">[Distributor] DMS</div>
                  <div className="text-[11px] text-[#8ea7aa]">Pharma Operations Suite</div>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-md hover:bg-[#153a3e] text-gray-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg transition-colors text-sm font-medium cursor-pointer ${
                      isActive
                        ? "bg-[#153a3e] text-white font-semibold shadow-xs"
                        : "hover:bg-[#153a3e]/50 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? "text-[#178582]" : "text-[#8ea7aa]"}`} />
                      <span>{item.name}</span>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-[#178582]" />}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Footer Profile */}
            <div className="p-4 border-t border-[#153a3e] bg-[#091b1d] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-[#178582] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {getInitials(user?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white text-xs font-semibold truncate leading-tight">
                    {user?.name || "Mr. Rajesh Shah"}
                  </div>
                  <div className="text-[10px] text-teal-400 truncate leading-tight mt-0.5 font-medium">
                    {user?.email || "admin@pharma.com"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setShowLogoutModal(true);
                }}
                title="Sign out of DMS"
                className="p-2 rounded-lg bg-[#153a3e] hover:bg-red-500/20 hover:text-red-400 text-gray-300 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="w-60 bg-[#0c2427] text-[#8ea7aa] min-h-screen flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto hidden md:flex border-r border-[#153a3e]">
        
        {/* Brand Header */}
        <div className="p-6 flex items-center gap-3 text-white border-b border-[#153a3e]/60">
          <div className="w-8 h-8 rounded bg-[#178582] flex items-center justify-center font-bold text-lg shadow-xs">
            +
          </div>
          <div>
            <div className="font-semibold text-xs leading-tight text-[#8ea7aa]">[Distributor]</div>
            <div className="font-bold text-lg leading-tight tracking-tight">DMS</div>
          </div>
        </div>
        
        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors text-xs font-semibold cursor-pointer ${
                  isActive 
                    ? "bg-[#153a3e] text-white shadow-sm" 
                    : "hover:bg-[#153a3e]/50 hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#178582]" : "text-[#8ea7aa]"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Dynamic Staff Profile & Logout Section */}
        <div className="p-3 mx-3 mb-4 rounded-xl bg-[#091b1d] border border-[#153a3e] shadow-xs">
          <div className="flex items-center justify-between gap-2.5">
            {/* Staff Avatar with Initials */}
            <div className="w-8 h-8 rounded-full bg-[#178582] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {getInitials(user?.name)}
            </div>

            {/* Dynamic Staff Name & Real Email */}
            <div className="min-w-0 flex-1">
              <div className="text-white text-xs font-bold truncate leading-tight">
                {user?.name || "Mr. Rajesh Shah"}
              </div>
              <div className="text-[10px] text-[#8ea7aa] truncate leading-tight mt-0.5 flex items-center gap-1">
                <span className="truncate">{user?.email || "admin@pharma.com"}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                <span className="text-[9px] font-semibold text-emerald-400 tracking-wide uppercase truncate">
                  {formattedRole}
                </span>
              </div>
            </div>

            {/* Industry-Standard Logout Trigger */}
            <button 
              onClick={() => setShowLogoutModal(true)}
              title="Sign Out / Terminate Session"
              className="p-2 rounded-lg bg-[#153a3e]/70 hover:bg-red-500/20 hover:text-red-400 text-gray-300 transition-colors cursor-pointer shrink-0"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* INDUSTRY-STANDARD LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 animate-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Confirm Sign Out</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Pharma DMS Enterprise Authentication</p>
                </div>
              </div>
              <button
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Profile Card Preview */}
            <div className="my-4 p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#178582] text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {getInitials(user?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-gray-900 truncate">
                    {user?.name || "Mr. Rajesh Shah"}
                  </div>
                  <div className="text-xs text-gray-500 truncate flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{user?.email || "admin@pharma.com"}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#178582]" />
                  <span className="font-semibold text-gray-700 capitalize">{formattedRole}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  <span className="truncate">{user?.branch || "Central Logistics Warehouse"}</span>
                </div>
              </div>
            </div>

            {/* Explanation Note */}
            <p className="text-xs text-gray-600 mb-6 leading-relaxed">
              Are you sure you want to sign out? Your session token will be revoked on the server and an audit entry will be recorded in compliance with statutory distribution tracking.
            </p>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-2 cursor-pointer shadow-sm shadow-red-600/30 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Yes, Sign Out</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
