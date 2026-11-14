import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

type Counts = { messages: number; notifications: number };
const Ctx = createContext<{ counts: Counts; refresh: () => void }>({ counts: { messages: 0, notifications: 0 }, refresh: () => {} });

export function UnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>({ messages: 0, notifications: 0 });
  const refresh = useCallback(() => {
    if (!user) return;
    api.get<Counts>("/messages/unread-count").then(setCounts).catch(() => {});
  }, [user]);
  useEffect(() => {
    if (!user) { setCounts({ messages: 0, notifications: 0 }); return; }
    refresh();
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 15000);
    return () => clearInterval(t);
  }, [user, refresh]);
  return <Ctx.Provider value={{ counts, refresh }}>{children}</Ctx.Provider>;
}

export const useUnread = () => useContext(Ctx);
