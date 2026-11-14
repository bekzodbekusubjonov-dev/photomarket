import { createContext, useContext, useState, type ReactNode } from "react";
import { en } from "./locales/en";
import { ru } from "./locales/ru";

export type Lang = "uz" | "ru" | "en";
export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "uz", label: "O‘zbekcha", short: "UZ" },
  { code: "ru", label: "Русский", short: "RU" },
  { code: "en", label: "English", short: "EN" },
];

const KEY = "pm_lang";
const dicts: Record<Lang, Record<string, string>> = { uz: {}, ru, en };

function detect(): Lang {
  try {
    const s = localStorage.getItem(KEY);
    if (s === "uz" || s === "ru" || s === "en") return s;
  } catch { /* ignore */ }
  const n = (navigator.language || "uz").slice(0, 2).toLowerCase();
  return n === "ru" ? "ru" : n === "en" ? "en" : "uz";
}

let current: Lang = detect();
export const getLang = () => current;
export const LOCALE: Record<Lang, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-GB" };

/** Matnni joriy tilga o'giradi. Kalit — o'zbekcha matn; {n} o'rinbosarlari vars bilan to'ldiriladi. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dicts[current][key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LangCtx = createContext<Ctx>({ lang: current, setLang: () => {} });
export const useLang = () => useContext(LangCtx);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setL] = useState<Lang>(current);
  const setLang = (l: Lang) => {
    current = l;
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    document.documentElement.lang = l;
    setL(l);
  };
  document.documentElement.lang = lang;
  // key bo'yicha qayta qurish: til almashganda barcha matnlar yangilanadi (holat saqlanadi — auth kontekst tashqarida)
  return <LangCtx.Provider value={{ lang, setLang }}><div key={lang} className="lang-root">{children}</div></LangCtx.Provider>;
}
