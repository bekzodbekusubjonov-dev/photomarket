import { Link } from "react-router-dom";
import { Camera, ClipboardList, Coins, MessageCircle, ShieldAlert, Star, UserPlus, Users } from "lucide-react";
import { api } from "../../api";
import { BarChart } from "../../components/BarChart";
import { Avatar, PageHead, Spinner, Stars, useAsync } from "../../components/ui";
import type { CreatorCard, SeriesPoint } from "../../types";
import { STATUS_LABEL, fmtMoney, timeAgo } from "../../utils";
import { t } from "../../i18n";

type S = {
  users: { total: number; by_role: Record<string, number>; new_30d: number; unverified: number; blocked: number };
  bookings: { total: number; by_status: Record<string, number> };
  revenue: number; reviews: number; messages: number; pending_verification: number;
  series: SeriesPoint[]; top_creators: CreatorCard[];
  activity: { at: string; kind: string; text: string; link?: string }[];
};

export default function AdminOverview() {
  const { data: s, loading } = useAsync(() => api.get<S>("/admin/stats"), []);
  if (loading || !s) return <Spinner />;
  const maxSt = Math.max(1, ...Object.values(s.bookings.by_status));
  return (
    <>
      <PageHead title={t("Admin panel")} sub={t("Platformaning umumiy holati")} />
      <div className="stats-grid">
        <div className="stat"><Users /><span>{t("Foydalanuvchilar")}</span><b>{s.users.total}</b><small className="muted">{s.users.by_role.client ?? 0} {t("mijoz ·")} {s.users.by_role.creator ?? 0} {t("ijodkor")}</small></div>
        <div className="stat"><UserPlus /><span>{t("So'nggi 30 kunda")}</span><b>+{s.users.new_30d}</b><small className="muted">{s.users.unverified} {t("tasdiqlanmagan")}</small></div>
        <div className="stat"><ClipboardList /><span>{t("Buyurtmalar")}</span><b>{s.bookings.total}</b></div>
        <div className="stat"><Coins /><span>{t("Bajarilgan aylanma")}</span><b className="money">{fmtMoney(s.revenue)}</b></div>
        <div className="stat"><Star /><span>{t("Sharhlar")}</span><b>{s.reviews}</b></div>
        <div className="stat"><MessageCircle /><span>{t("Xabarlar")}</span><b>{s.messages}</b></div>
      </div>
      {s.pending_verification > 0 && (
        <Link to="/dashboard/admin/creators?verified=false" className="card progress-card link-card">
          <ShieldAlert /><div className="grow"><b>{s.pending_verification} {t("ta ijodkor tasdiqlanmagan")}</b><p className="muted small">{t("Profil va portfoliosini tekshirib «Tasdiqlangan» belgisini bering.")}</p></div>
        </Link>
      )}
      <div className="dash-grid">
        <section className="card"><h2>{t("Oylik buyurtmalar")}</h2><BarChart data={s.series} field="bookings" /><h3 className="mt">{t("Oylik aylanma")}</h3><BarChart data={s.series} field="revenue" money /></section>
        <section className="card">
          <h2>{t("Holatlar bo'yicha")}</h2>
          <div className="hbars">
            {Object.entries(STATUS_LABEL).map(([k, l]) => (
              <div key={k} className="hbar"><span>{l}</span><div className="rb-track"><div className={`st-bg-${k}`} style={{ width: `${((s.bookings.by_status[k] ?? 0) / maxSt) * 100}%` }} /></div><b>{s.bookings.by_status[k] ?? 0}</b></div>
            ))}
          </div>
          <h2 className="mt">{t("Top ijodkorlar")}</h2>
          <div className="list">
            {s.top_creators.map((c) => (
              <Link key={c.id} to={`/creators/${c.id}`} className="list-row">
                <Avatar src={c.avatar_url} name={c.display_name} size={36} />
                <div className="grow"><b>{c.display_name}</b><div className="muted small">{c.city} · {c.completed_count} {t("bajarilgan")}</div></div>
                <Stars value={c.rating} />
              </Link>
            ))}
            {!s.top_creators.length && <p className="muted"><Camera size={16} /> {t("Hali ijodkorlar yo'q")}</p>}
          </div>
        </section>
      </div>
      <section className="card mt">
        <div className="card-head"><h2>{t("So'nggi faollik")}</h2></div>
        {s.activity.length ? (
          <ul className="activity">
            {s.activity.map((a, i) => (
              <li key={i} className={`act-${a.kind.split("_")[0]}`}>
                <span className="act-dot" />
                {a.link ? <Link to={a.link} className="grow">{a.text}</Link> : <span className="grow">{a.text}</span>}
                <span className="muted small nowrap">{timeAgo(a.at)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">{t("Hali faollik yo'q.")}</p>}
      </section>
    </>
  );
}
