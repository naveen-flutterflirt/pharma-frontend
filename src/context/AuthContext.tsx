"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { pharmaApi, API_BASE_URL } from "@/lib/api";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: string;
  phone?: string | null;
  isActive?: boolean;
  makerChecker: boolean;
  lastLogin?: string | null;
  createdAt?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; user: UserProfile }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "pharma_token";
const USER_KEY = "pharma_user";

function setCookie(name: string, value: string, days = 7) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleLogoutCleanup = useCallback(async () => {
    const currentToken = token || (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);

    // Call backend logout to record audit trail in PostgreSQL
    if (currentToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json"
          }
        });
      } catch {
        // Continue cleanup even if server unreachable
      }
    }

    // Clear client-side auth tokens, storage, and cookies
    setToken(null);
    setUser(null);

    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.clear();
      deleteCookie(TOKEN_KEY);

      // Hard redirect to /login to flush router cache and prevent back-button replay
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }, [token]);

  // Dynamically fetch and sync fresh user profile from backend
  const fetchCurrentUser = useCallback(async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json"
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          return data.user;
        }
      } else if (res.status === 401 || res.status === 403) {
        // Token expired on server
        await handleLogoutCleanup();
      }
    } catch (err) {
      console.warn("Backend profile sync deferred (offline or network pause):", err);
    }
    return null;
  }, [handleLogoutCleanup]);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY) || getCookie(TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);

        if (storedToken) {
          setToken(storedToken);
          setCookie(TOKEN_KEY, storedToken, 7);

          // If cached user exists, use immediately for instant UI render
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser));
            } catch {
              // Ignore parse error
            }
          }

          // Then dynamically fetch fresh profile from PostgreSQL
          await fetchCurrentUser(storedToken);
        }
      } catch (err) {
        console.error("Error initializing session:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await pharmaApi.login({ email, password });
      if (res && res.token && res.user) {
        setToken(res.token);
        setUser(res.user);

        // Store tokens
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        setCookie(TOKEN_KEY, res.token, 7);

        // Fetch complete profile details (phone, branch, etc.)
        await fetchCurrentUser(res.token);

        return { success: true, user: res.user };
      }
      throw new Error(res.error || "Login response invalid");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await handleLogoutCleanup();
  };

  const refreshUser = async () => {
    const currentToken = token || (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);
    if (currentToken) {
      await fetchCurrentUser(currentToken);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        logout,
        refreshUser,
        setUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
