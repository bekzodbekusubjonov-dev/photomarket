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
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

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

  return <Ctx.Provider value={{ user, loading, setSession, setUser, logout, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export type { TokenResponse };
