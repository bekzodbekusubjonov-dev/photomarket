import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Heart } from "lucide-react";
import { api } from "./api";
import { useAuth } from "./auth";
import { t } from "./i18n";
import { cx } from "./utils";

type Ctx = { ids: Set<number>; toggle: (id: number) => Promise<void>; enabled: boolean };
const FavCtx = createContext<Ctx>({ ids: new Set(), toggle: async () => {}, enabled: false });

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<number>>(new Set());
  const enabled = user?.role === "client";
  useEffect(() => {
    if (!enabled) { setIds(new Set()); return; }
    api.get<number[]>("/favorites/ids").then((l) => setIds(new Set(l))).catch(() => {});
  }, [enabled, user?.id]);
  const toggle = useCallback(async (id: number) => {
    const has = ids.has(id);
    setIds((o) => { const n = new Set(o); has ? n.delete(id) : n.add(id); return n; });
    try { has ? await api.del(`/favorites/${id}`) : await api.post(`/favorites/${id}`); }
    catch { setIds((o) => { const n = new Set(o); has ? n.add(id) : n.delete(id); return n; }); }
  }, [ids]);
  return <FavCtx.Provider value={{ ids, toggle, enabled }}>{children}</FavCtx.Provider>;
}

export const useFavorites = () => useContext(FavCtx);

/** Yurakcha tugma — faqat mijoz uchun ko'rinadi */
export function FavButton({ id, className }: { id: number; className?: string }) {
  const { ids, toggle, enabled } = useFavorites();
  if (!enabled) return null;
  const on = ids.has(id);
  return (
    <button type="button" className={cx("fav-btn", on && "on", className)} aria-pressed={on}
      aria-label={on ? t("Sevimlilardan olib tashlash") : t("Sevimlilarga qo'shish")}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(id); }}>
      <Heart size={18} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
