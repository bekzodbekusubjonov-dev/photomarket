import { useEffect, useRef, useState } from "react";
import { Crosshair, ExternalLink, LocateFixed, MapPin, Navigation } from "lucide-react";
import { Button, Field, Input } from "./ui";
import { t } from "../i18n";

/** Shahar -> markaz koordinatasi (tez tanlash uchun) */
export const CITY_COORDS: Record<string, [number, number]> = {
  "Toshkent": [41.3111, 69.2797], "Samarqand": [39.6542, 66.9597], "Buxoro": [39.7747, 64.4286], "Andijon": [40.7821, 72.3442],
  "Farg'ona": [40.3864, 71.7864], "Namangan": [41.0011, 71.6726], "Qarshi": [38.8606, 65.7891], "Navoiy": [40.1030, 65.3739],
  "Jizzax": [40.1158, 67.8422], "Guliston": [40.4897, 68.7842], "Termiz": [37.2242, 67.2783], "Urganch": [41.5506, 60.6317],
  "Nukus": [42.4531, 59.6103], "Xiva": [41.3783, 60.3639], "Qo'qon": [40.5286, 70.9425], "Chirchiq": [41.4689, 69.5822],
};

export function haversine(a: [number, number], b: [number, number]) {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} ${t("m")}` : `${km.toFixed(km < 10 ? 1 : 0)} ${t("km")}`);

export function MapEmbed({ lat, lng, height = 240 }: { lat: number; lng: number; height?: number }) {
  const d = 0.008;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d * 1.6},${lat - d},${lng + d * 1.6},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className="map-embed" style={{ height }}>
      <iframe title={t("Xarita")} src={src} loading="lazy" referrerPolicy="no-referrer" />
    </div>
  );
}

const gmaps = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
const yandex = (lat: number, lng: number) => `https://yandex.com/maps/?rtext=~${lat},${lng}&rtt=auto`;

/** Xarita + yo'nalish tugmalari + jonli masofa (foydalanuvchi joylashuvi ilovaning o'zida kuzatiladi) */
export function MapCard({ lat, lng, title, address }: { lat: number; lng: number; title?: string; address?: string }) {
  const [me, setMe] = useState<[number, number] | null>(null);
  const [watching, setWatching] = useState(false);
  const [err, setErr] = useState("");
  const watch = useRef<number | null>(null);
  const stop = () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); watch.current = null; setWatching(false); };
  useEffect(() => stop, []); // eslint-disable-line
  const start = () => {
    if (!navigator.geolocation) return setErr(t("Brauzeringiz joylashuvni qo'llab-quvvatlamaydi"));
    setErr(""); setWatching(true);
    watch.current = navigator.geolocation.watchPosition(
      (p) => setMe([p.coords.latitude, p.coords.longitude]),
      () => { setErr(t("Joylashuvga ruxsat berilmadi")); stop(); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  };
  const km = me ? haversine(me, [lat, lng]) : null;
  const eta = km === null ? null : Math.max(1, Math.round((km / 35) * 60)); // shaharda o'rtacha ~35 km/soat
  return (
    <div className="map-card">
      {title && <div className="map-title"><MapPin size={16} /><div><b>{title}</b>{address && <span className="muted small"> · {address}</span>}</div></div>}
      <MapEmbed lat={lat} lng={lng} />
      {km !== null && (
        <div className="live-box">
          <span className="live-dot" /><div><b>{fmtKm(km)}</b> <span className="muted">{t("masofa")}</span> · ≈ {eta} {t("daqiqa")}</div>
        </div>
      )}
      {err && <p className="field-error">{err}</p>}
      <div className="map-actions">
        <a className="btn btn-primary btn-md" href={gmaps(lat, lng)} target="_blank" rel="noreferrer noopener"><Navigation size={16} /> {t("Yo'nalish (Google)")}</a>
        <a className="btn btn-secondary btn-md" href={yandex(lat, lng)} target="_blank" rel="noreferrer noopener"><ExternalLink size={16} /> {t("Yandex Xarita")}</a>
        {watching ? <Button variant="ghost" onClick={stop}><LocateFixed size={16} /> {t("Kuzatuvni to'xtatish")}</Button>
          : <Button variant="secondary" onClick={start}><Crosshair size={16} /> {t("Mening joylashuvim")}</Button>}
      </div>
    </div>
  );
}

/** Koordinatani Google/Yandex havolasidan yoki "41.31, 69.28" matnidan ajratib oladi */
export function parseCoords(s: string): [number, number] | null {
  const m = s.match(/(-?\d{1,2}\.\d+)\s*[,;/ ]\s*(-?\d{1,3}\.\d+)/) || s.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  let a = Number(m[1]), b = Number(m[2]);
  if (/yandex/i.test(s) && !/@/.test(s)) [a, b] = [b, a]; // Yandex: lng,lat
  return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [a, b] : null;
}

/** Joylashuvni belgilash: GPS, shahar markazi, havola yopishtirish yoki qo'lda kiritish */
export function LocationPicker({ lat, lng, city, onChange, label }: {
  lat: number | null; lng: number | null; city?: string; label?: string;
  onChange: (lat: number | null, lng: number | null) => void;
}) {
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const gps = () => {
    if (!navigator.geolocation) return setMsg(t("Brauzeringiz joylashuvni qo'llab-quvvatlamaydi"));
    setBusy(true); setMsg("");
    navigator.geolocation.getCurrentPosition(
      (p) => { onChange(+p.coords.latitude.toFixed(6), +p.coords.longitude.toFixed(6)); setBusy(false); },
      () => { setMsg(t("Joylashuvga ruxsat berilmadi")); setBusy(false); },
      { enableHighAccuracy: true, timeout: 15000 });
  };
  const fromCity = () => { const c = city && CITY_COORDS[city]; if (c) onChange(c[0], c[1]); else setMsg(t("Avval shaharni tanlang")); };
  const applyPaste = (v: string) => {
    setPaste(v);
    const c = parseCoords(v);
    if (c) { onChange(+c[0].toFixed(6), +c[1].toFixed(6)); setMsg(""); }
  };
  return (
    <div className="loc-picker">
      <div className="loc-head"><b><MapPin size={16} /> {label ?? t("Joylashuv (xarita)")}</b>{lat !== null && <button type="button" className="link-btn" onClick={() => onChange(null, null)}>{t("O'chirish")}</button>}</div>
      <div className="loc-actions">
        <Button type="button" variant="secondary" size="sm" onClick={gps} loading={busy}><LocateFixed size={15} /> {t("Mening joylashuvim")}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={fromCity}><MapPin size={15} /> {t("Shahar markazi")}</Button>
      </div>
      <Field label={t("Xarita havolasi yoki koordinata")} hint={t("Google/Yandex xaritadan havolani yopishtiring")}>
        <Input value={paste} onChange={(e) => applyPaste(e.target.value)} placeholder="https://maps.google.com/?q=41.3111,69.2797" />
      </Field>
      <div className="grid-2">
        <Field label={t("Kenglik (lat)")}><Input inputMode="decimal" value={lat ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value), lng)} /></Field>
        <Field label={t("Uzunlik (lng)")}><Input inputMode="decimal" value={lng ?? ""} onChange={(e) => onChange(lat, e.target.value === "" ? null : Number(e.target.value))} /></Field>
      </div>
      {msg && <p className="field-error">{msg}</p>}
      {lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && <MapEmbed lat={lat} lng={lng} height={200} />}
    </div>
  );
}
