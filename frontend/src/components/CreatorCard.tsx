import { Link } from "react-router-dom";
import { BadgeCheck, MapPin, Sparkles } from "lucide-react";
import type { CreatorCard as C } from "../types";
import { CATEGORY_LABEL, fmtMoney } from "../utils";
import { useSite } from "../site";
import { Avatar, Img, Stars } from "./ui";
import { FavButton } from "../favorites";
import { t } from "../i18n";

export function CreatorCard({ c }: { c: C }) {
  const site = useSite();
  return (
    <Link to={`/creators/${c.id}`} className="creator-card">
      <div className="cc-media">
        <Img src={c.cover_url || site?.images.cover} alt={c.display_name} />
        <FavButton id={c.id} className="cc-fav" />
        <div className="cc-tags">
          <span className="chip chip-glass">{CATEGORY_LABEL[c.category]}</span>
          {c.featured && <span className="chip chip-accent"><Sparkles size={12} /> {t("Tavsiya")}</span>}
        </div>
      </div>
      <div className="cc-body">
        <div className="cc-who">
          <Avatar src={c.avatar_url} name={c.display_name} size={44} className="cc-avatar" />
          <div className="cc-name">
            <h3>{c.display_name} {c.verified && <BadgeCheck size={16} className="verified" aria-label={t("Tasdiqlangan")} />}</h3>
            <span className="muted small"><MapPin size={13} /> {t(c.city)}{c.distance_km != null ? ` · ${c.distance_km} ${t("km")}` : ""}{c.experience_years ? ` · ${t("{n} yil tajriba",{n:c.experience_years})}` : ""}</span>
          </div>
        </div>
        {c.specialties.length > 0 && (
          <div className="cc-specs">{c.specialties.slice(0, 3).map((s) => <span key={s} className="chip">{t(s)}</span>)}</div>
        )}
        <div className="cc-foot">
          <div>
            <span className="muted small">{t("dan boshlab")}</span>
            <b className="price">{c.price_from ? fmtMoney(c.price_from) : t("Kelishiladi")}</b>
          </div>
          <div className="cc-rating">
            <Stars value={c.rating} size={13} />
            <span className="muted small">{c.reviews_count ? `${c.rating.toFixed(1)} (${c.reviews_count})` : t("Yangi")}</span>
          </div>
        </div>
        <span className="cc-view">{t("Profilni ko'rish")}</span>
      </div>
    </Link>
  );
}

export function CreatorCardSkeleton() {
  return (
    <div className="creator-card skeleton-card">
      <div className="cc-media sk" />
      <div className="cc-body"><div className="sk sk-line" /><div className="sk sk-line short" /><div className="sk sk-line" /></div>
    </div>
  );
}
