import type { ReactNode } from "react";
import { Camera, CalendarCheck, MessageCircle } from "lucide-react";
import { Logo } from "../../components/Layout";
import { Img } from "../../components/ui";
import { useSite } from "../../site";
import { t } from "../../i18n";

export function AuthShell({ title, sub, children, slot = "auth" }:
  { title: string; sub?: ReactNode; children: ReactNode; slot?: string }) {
  document.title = `${title} — PhotoMarket`;
  const site = useSite();
  return (
    <div className="auth">
      <div className="auth-side">
        <Logo />
        <div className="auth-photo"><Img src={site?.images[slot]} alt="" />
          {site && site.stats.creators > 0 && <div className="auth-photo-badge"><b>{site.stats.creators}+</b> {t("ijodkor ·")} <b>{site.stats.rating || "5.0"}</b> ★</div>}
        </div>
        <div>
          <h2>{t("Har bir lahza — professional kadrda.")}</h2>
          <ul className="auth-points">
            <li><Camera size={18} /> {t("Yuzlab portfoliolarni solishtiring")}</li>
            <li><CalendarCheck size={18} /> {t("Bo'sh sanani ko'rib, onlayn buyurtma bering")}</li>
            <li><MessageCircle size={18} /> {t("Ijodkor bilan to'g'ridan-to'g'ri yozishing")}</li>
          </ul>
        </div>
        <span className="muted small">{t("© PhotoMarket")}</span>
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <div className="auth-logo-mobile"><Logo /></div>
          <h1>{title}</h1>
          {sub && <p className="muted">{sub}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

export function OtpInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <input className="input otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••"
      value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-label={t("6 xonali kod")} />
  );
}

