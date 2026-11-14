import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "./api";
import type { User } from "./types";

interface TokenResponse { access_token: string; user: User }

interface AuthCtx {
  user: User | null;
  loading: boolean;
  setSession: (r: TokenResponse) => void;
  setUser: (u: User) => void;
  logout: () => void;
  viewingAs: boolean;
  startViewAs: (r: TokenResponse) => void;
  exitViewAs: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const ADMIN_KEY = "pm_admin_token";
  const [viewingAs, setViewingAs] = useState(() => { try { return !!localStorage.getItem(ADMIN_KEY); } catch { return false; } });
  const exitViewAs = useCallback(() => {
    let adm: string | null = null;
    try { adm = localStorage.getItem(ADMIN_KEY); localStorage.removeItem(ADMIN_KEY); } catch { /* */ }
    tokenStore.set(adm);
    setViewingAs(false);
    window.location.assign("/dashboard");
  }, []);
  const startViewAs = useCallback((r: TokenResponse) => {
    try { const cur = tokenStore.get(); if (cur && !localStorage.getItem(ADMIN_KEY)) localStorage.setItem(ADMIN_KEY, cur); } catch { /* */ }
    tokenStore.set(r.access_token);
    window.location.assign("/dashboard");
  }, []);
  const logout = useCallback(() => {
    if (viewingAs) { exitViewAs(); return; }
    tokenStore.set(null);
    setUser(null);
  }, [viewingAs, exitViewAs]);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); return; }
    try { setUser(await api.get<User>("/auth/me")); } catch { /* 401 -> handler */ }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const setSession = useCallback((r: TokenResponse) => {
    tokenStore.set(r.access_token);
    setUser(r.user);
  }, []);

  return <Ctx.Provider value={{ user, loading, setSession, setUser, logout, refresh, viewingAs, startViewAs, exitViewAs }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export type { TokenResponse };
