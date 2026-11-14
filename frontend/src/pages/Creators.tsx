import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { api } from "../api";
import { CreatorCard, CreatorCardSkeleton } from "../components/CreatorCard";
import { Button, Empty, Field, DateField, Input, PageHead, Pagination, Select, useAsync, useDebounced } from "../components/ui";
import type { CreatorCard as C, Paged } from "../types";
import { cx, todayISO } from "../utils";
import { t } from "../i18n";

type Meta = { cities: string[]; specialties: string[] };
const KEYS = ["q", "category", "city", "min_price", "max_price", "min_rating", "specialty", "available_on", "verified", "sort", "lat", "lng"] as const;

export default function Creators() {
  const [sp, setSp] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dq = useDebounced(q);
  const [meta, setMeta] = useState<Meta>({ cities: [], specialties: [] });
  const page = Number(sp.get("page") || 1);

  useEffect(() => { api.get<Meta>("/creators/meta").then(setMeta).catch(() => {}); }, []);
  useEffect(() => { if ((sp.get("q") ?? "") !== dq) update("q", dq); /* eslint-disable-next-line */ }, [dq]);

  const update = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    if (k !== "page") n.delete("page");
    setSp(n, { replace: true });
  };
  const params = Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? ""]));
  const { data, loading, error } = useAsync(
    () => api.get<Paged<C>>("/creators", { ...params, page, size: 12 }), [sp.toString()]);
  const active = KEYS.filter((k) => k !== "sort" && k !== "q" && k !== "lat" && k !== "lng" && sp.get(k)).length;
  const [geoErr, setGeoErr] = useState("");
  const onSort = (v: string) => {
    if (v !== "nearest") { const n = new URLSearchParams(sp); n.delete("lat"); n.delete("lng"); v && v !== "recommended" ? n.set("sort", v) : n.delete("sort"); n.delete("page"); setSp(n, { replace: true }); return; }
    if (!navigator.geolocation) return setGeoErr(t("Brauzeringiz joylashuvni qo'llab-quvvatlamaydi"));
    navigator.geolocation.getCurrentPosition((pos) => {
      const n = new URLSearchParams(sp); n.set("sort", "nearest"); n.set("lat", pos.coords.latitude.toFixed(5)); n.set("lng", pos.coords.longitude.toFixed(5)); n.delete("page");
      setGeoErr(""); setSp(n, { replace: true });
    }, () => setGeoErr(t("Joylashuvga ruxsat berilmadi")), { timeout: 12000 });
  };

  const filters = (
    <div className="filters">
      <Field label={t("Kim kerak")}>
        <Select value={params.category} onChange={(e) => update("category", e.target.value)}>
          <option value="">{t("Hammasi")}</option><option value="photographer">{t("Fotograf")}</option><option value="videographer">{t("Videograf")}</option>
        </Select>
      </Field>
      <Field label={t("Shahar")}>
        <Select value={params.city} onChange={(e) => update("city", e.target.value)}>
          <option value="">{t("Barcha shaharlar")}</option>
          {meta.cities.map((c) => <option key={c} value={c}>{t(c)}</option>)}
        </Select>
      </Field>
      <Field label={t("Yo'nalish")}>
        <Select value={params.specialty} onChange={(e) => update("specialty", e.target.value)}>
          <option value="">{t("Barchasi")}</option>
          {meta.specialties.map((c) => <option key={c} value={c}>{t(c)}</option>)}
        </Select>
      </Field>
      <Field label={t("Bo'sh sana")}>
        <DateField min={todayISO()} value={params.available_on} onChange={(e) => update("available_on", e.target.value)} />
      </Field>
      <div className="two">
        <Field label={t("Narx (dan)")}><Input type="number" min={0} step={100000} placeholder="0" value={params.min_price} onChange={(e) => update("min_price", e.target.value)} /></Field>
        <Field label={t("Narx (gacha)")}><Input type="number" min={0} step={100000} placeholder="∞" value={params.max_price} onChange={(e) => update("max_price", e.target.value)} /></Field>
      </div>
      <Field label={t("Minimal reyting")}>
        <Select value={params.min_rating} onChange={(e) => update("min_rating", e.target.value)}>
          <option value="">{t("Farqi yo'q")}</option><option value="4.5">{t("4.5 ★ va yuqori")}</option><option value="4">{t("4 ★ va yuqori")}</option><option value="3">{t("3 ★ va yuqori")}</option>
        </Select>
      </Field>
      <label className="check">
        <input type="checkbox" checked={params.verified === "true"} onChange={(e) => update("verified", e.target.checked ? "true" : "")} />
        {t("Faqat tasdiqlangan ijodkorlar")}
      </label>
      {active > 0 && <Button variant="ghost" onClick={() => { setQ(""); setSp(new URLSearchParams(), { replace: true }); }}><X size={16} /> {t("Filtrlarni tozalash")}</Button>}
    </div>
  );

  return (
    <div className="container page">
      <PageHead title={t("Ijodkorlar")} sub={data ? t("{n} ta ijodkor topildi", { n: data.total }) : t("Qidirilmoqda...")} />
      <div className="catalog">
        <aside className={cx("catalog-side", showFilters && "open")}>
          <div className="side-head"><b>{t("Filtrlar")}</b><button className="icon-btn" onClick={() => setShowFilters(false)}><X size={20} /></button></div>
          {filters}
          <Button block className="side-apply" onClick={() => setShowFilters(false)}>{t("Natijalarni ko'rish")}</Button>
        </aside>
        <div>
          <div className="catalog-bar">
            <Input placeholder={t("Ism, uslub yoki shahar bo'yicha qidirish...")} value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={params.sort || "recommended"} onChange={(e) => onSort(e.target.value)} aria-label={t("Saralash")} className="sort">
              <option value="recommended">{t("Tavsiya etilgan")}</option>
              <option value="rating">{t("Reyting bo'yicha")}</option>
              <option value="reviews">{t("Sharhlar soni")}</option>
              <option value="price_asc">{t("Arzonroq avval")}</option>
              <option value="price_desc">{t("Qimmatroq avval")}</option>
              <option value="newest">{t("Yangi qo'shilgan")}</option>
              <option value="nearest">{t("Menga yaqin")}</option>
            </Select>
            <Button variant="secondary" className="filter-toggle" onClick={() => setShowFilters(true)}>
              <SlidersHorizontal size={16} /> {t("Filtr")}{active ? ` (${active})` : ""}
            </Button>
          </div>
          {error && <p className="alert alert-error">{error}</p>}
          {geoErr && <p className="alert alert-error">{geoErr}</p>}
          <div className="grid-cards cols-3">
            {loading && !data ? Array.from({ length: 6 }).map((_, i) => <CreatorCardSkeleton key={i} />) :
              data?.items.map((c) => <CreatorCard key={c.id} c={c} />)}
          </div>
          {data && data.items.length === 0 && (
            <Empty title={t("Hech narsa topilmadi")} text={t("Filtrlarni o'zgartirib ko'ring yoki boshqa sanani tanlang.")} />
          )}
          {data && <Pagination page={data.page} pages={data.pages} onChange={(p) => update("page", String(p))} />}
        </div>
      </div>
    </div>
  );
}
