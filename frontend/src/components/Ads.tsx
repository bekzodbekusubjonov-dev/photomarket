import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { api, mediaUrl } from "../api";
import type { AdItem } from "../types";
import { t } from "../i18n";

/** E'lon / reklama banneri (admin boshqaradi). Bir nechta bo'lsa avtomatik almashadi. */
export function AdSlot({ placement, className }: { placement: "home" | "dashboard" | "creators"; className?: string }) {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [i, setI] = useState(0);
  useEffect(() => { api.get<AdItem[]>("/ads", { placement }).then(setAds).catch(() => {}); }, [placement]);
  useEffect(() => {
    if (ads.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % ads.length), 6000);
    return () => clearInterval(id);
  }, [ads.length]);
  if (!ads.length) return null;
  const ad = ads[i % ads.length];
  const external = /^https?:/.test(ad.link_url);
  const click = () => { api.post(`/ads/${ad.id}/click`).catch(() => {}); };
  const body = (
    <>
      {ad.image_url && <img src={mediaUrl(ad.image_url)} alt="" loading="lazy" />}
      <div className="ad-body">
        <span className="ad-tag">{t("Reklama")}{ad.advertiser ? ` · ${ad.advertiser.replace(/\s*\(demo\)$/i, "")}` : ""}</span>
        <b>{ad.title}</b>
        {ad.text && <p>{ad.text}</p>}
      </div>
      {ad.link_url && <ExternalLink size={16} className="ad-go" />}
    </>
  );
  return (
    <div className={`ad-slot ${className ?? ""}`}>
      {!ad.link_url ? <div className="ad-card">{body}</div>
        : external ? <a className="ad-card" href={ad.link_url} target="_blank" rel="noreferrer noopener sponsored" onClick={click}>{body}</a>
        : <Link className="ad-card" to={ad.link_url} onClick={click}>{body}</Link>}
      {ads.length > 1 && (
        <div className="ad-dots">{ads.map((a, k) => <button key={a.id} className={k === i % ads.length ? "on" : ""} onClick={() => setI(k)} aria-label={`${k + 1}`} />)}</div>
      )}
    </div>
  );
}
