import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { LANGS, useLang, type Lang } from "../i18n";

export function LangSwitch() {
  const { lang, setLang } = useLang();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const pick = (l: Lang) => {
    setOpen(false);
    if (l === lang) return;
    // backend bildirishnoma va xatlarni shu tilda yuborishi uchun saqlab qo'yamiz
    if (user) api.put("/auth/me", { name: user.name, phone: user.phone, lang: l }).catch(() => {});
    setLang(l);
  };
  const cur = LANGS.find((x) => x.code === lang)!;
  return (
    <div className="lang-switch" ref={ref}>
      <button className="lang-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-label="Language">
        <Globe size={16} /> <b>{cur.short}</b>
      </button>
      {open && (
        <div className="dropdown lang-menu" role="menu">
          {LANGS.map((l) => (
            <button key={l.code} onClick={() => pick(l.code)} role="menuitem">
              <span>{l.label}</span>{l.code === lang && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
