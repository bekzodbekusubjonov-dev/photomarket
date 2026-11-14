import type { BookingStatus, Category } from "./types";

import { LOCALE, getLang, t } from "./i18n";

const MONTHS_L = {
  uz: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const MONTHS_NOM = {
  uz: MONTHS_L.uz,
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: MONTHS_L.en,
};
const WD = { uz: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"], ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"], en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] };
const arrProxy = (src: Record<string, string[]>, cap: boolean) =>
  new Proxy([] as string[], {
    get: (_t, k) => {
      const arr = src[getLang()].map((m) => (cap ? m[0].toUpperCase() + m.slice(1) : m));
      const v = (arr as any)[k];
      return typeof v === "function" ? v.bind(arr) : v;
    },
  });
const MONTHS = arrProxy(MONTHS_L, false);
export const MONTHS_CAP = arrProxy(MONTHS_NOM, true);
export const WEEKDAYS = arrProxy(WD, false);

export const currency = () => ({ uz: "so'm", ru: "сум", en: "UZS" }[getLang()]);

export const fmtMoney = (n?: number | null) =>
  n === null || n === undefined ? t("Kelishiladi") : `${Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ")} ${currency()}`;

export const fmtShortMoney = (n: number) => {
  const l = getLang();
  const mln = { uz: "mln", ru: "млн", en: "M" }[l], th = { uz: "ming", ru: "тыс", en: "K" }[l];
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} ${mln}`;
  if (n >= 1000) return `${Math.round(n / 1000)} ${th}`;
  return String(n);
};
export { LOCALE };

/** "2026-11-03" -> 3-noyabr, 2026 / 3 ноября 2026 / 3 November 2026 */
export const fmtDate = (iso: string, withYear = true) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const l = getLang();
  if (l === "uz") return `${d}-${MONTHS[m - 1]}${withYear ? `, ${y}` : ""}`;
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
};

export const fmtMonthShort = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3);

/** Backend UTC (naive) datetime qaytaradi */
export const parseUtc = (s: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);

export const fmtDateTime = (s: string) => {
  const d = parseUtc(s);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return getLang() === "uz" ? `${d.getDate()}-${MONTHS[d.getMonth()]}, ${hm}` : `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hm}`;
};

export const timeAgo = (s: string) => {
  const diff = (Date.now() - parseUtc(s).getTime()) / 1000;
  if (diff < 60) return t("hozirgina");
  if (diff < 3600) return t("{n} daqiqa oldin", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("{n} soat oldin", { n: Math.floor(diff / 3600) });
  if (diff < 86400 * 7) return t("{n} kun oldin", { n: Math.floor(diff / 86400) });
  return fmtDateTime(s);
};

export const clockTime = (s: string) => {
  const d = parseUtc(s);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const todayISO = () => toISODate(new Date());

const labelMap = <K extends string>(src: Record<K, string>) =>
  new Proxy(src, { get: (o, k: string) => (k in o ? t((o as Record<string, string>)[k]) : undefined) });

export const CATEGORY_LABEL: Record<Category, string> = labelMap({
  photographer: "Fotograf", videographer: "Videograf", both: "Foto + video",
});

export const STATUS_LABEL: Record<BookingStatus, string> = labelMap({
  pending: "Kutilmoqda", accepted: "Qabul qilindi", rejected: "Rad etildi", cancelled: "Bekor qilindi", completed: "Bajarildi",
});

export const ROLE_LABEL = labelMap({ client: "Mijoz", creator: "Ijodkor", admin: "Administrator" }) as Record<"client" | "creator" | "admin", string>;

export const PAY_METHOD_LABEL = labelMap({ cash: "Naqd pul", card: "Karta", transfer: "O'tkazma" }) as Record<string, string>;
export const PAY_STATUS_LABEL = labelMap({ pending: "Tasdiqlanmoqda", paid: "To'langan", rejected: "Rad etildi" }) as Record<string, string>;
export const COMPLAINT_STATUS_LABEL = labelMap({ open: "Yangi", in_review: "Ko'rib chiqilmoqda", resolved: "Hal qilindi", dismissed: "Rad etildi" }) as Record<string, string>;
export const COMPLAINT_REASON_LABEL = labelMap({
  quality: "Sifat past", no_show: "Kelmadi", price: "Narx bo'yicha nizo", rude: "Muomala yomon", fraud: "Firibgarlik", other: "Boshqa",
}) as Record<string, string>;

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

export const plural = (n: number, word: string) => `${n} ${word}`;

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
