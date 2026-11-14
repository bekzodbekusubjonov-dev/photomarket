import { Link } from "react-router-dom";
import { Camera, ClipboardList, Coins, FileSignature, Megaphone, MessageCircle, ShieldAlert, Star, UserPlus, Users, Wallet } from "lucide-react";
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

type X = {
  contracts: { total: number; signed: number; awaiting: number; cancelled: number; value: number; commission: number; cancel_income: number };
  payments: { pending: number; paid_sum: number; payouts_due: number; fee_sum: number };
  ads: { active: number; views: number; clicks: number };
};

export default function AdminOverview() {
  const { data: s, loading } = useAsync(() => api.get<S>("/admin/stats"), []);
  const { data: x } = useAsync(() => api.get<X>("/admin/overview-extra"), []);
  if (loading || !s) return <Spinner />;
  const maxSt = Math.max(1, ...Object.values(s.bookings.by_status));
  return (
    <>
      <PageHead title={t("Admin panel")} sub={t("Platformaning umumiy holati")} />
      <div className="stats-grid stats-click">
        <Link to="/dashboard/admin/reports/users" className="stat"><Users /><span>{t("Foydalanuvchilar")}</span><b>{s.users.total}</b><small className="muted">{s.users.by_role.client ?? 0} {t("mijoz ·")} {s.users.by_role.creator ?? 0} {t("ijodkor")}</small></Link>
        <Link to="/dashboard/admin/reports/users?status=unverified" className="stat"><UserPlus /><span>{t("So'nggi 30 kunda")}</span><b>+{s.users.new_30d}</b><small className="muted">{s.users.unverified} {t("tasdiqlanmagan")}</small></Link>
        <Link to="/dashboard/admin/reports/bookings" className="stat"><ClipboardList /><span>{t("Buyurtmalar")}</span><b>{s.bookings.total}</b></Link>
        <Link to="/dashboard/admin/reports/revenue" className="stat"><Coins /><span>{t("Bajarilgan aylanma")}</span><b className="money">{fmtMoney(s.revenue)}</b></Link>
        <Link to="/dashboard/admin/reports/reviews" className="stat"><Star /><span>{t("Sharhlar")}</span><b>{s.reviews}</b></Link>
        <Link to="/dashboard/admin/reports/creators" className="stat"><Camera /><span>{t("Ijodkorlar")}</span><b>{s.users.by_role.creator ?? 0}</b></Link>
        {x && <>
          <Link to="/dashboard/admin/reports/contracts" className="stat"><FileSignature /><span>{t("Shartnomalar")}</span><b>{x.contracts.total}</b><small className="muted">{x.contracts.signed} {t("imzolangan ·")} {x.contracts.awaiting} {t("kutilmoqda")}</small></Link>
          <Link to="/dashboard/admin/reports/payments" className="stat"><Wallet /><span>{t("To'lovlar")}</span><b className="money">{fmtMoney(x.payments.paid_sum)}</b><small className="muted">{x.payments.pending} {t("ta tasdiq kutmoqda")}</small></Link>
          <Link to="/dashboard/admin/reports/revenue" className="stat"><Coins /><span>{t("Platforma daromadi")}</span><b className="money">{fmtMoney(x.payments.fee_sum + x.contracts.cancel_income)}</b><small className="muted">{x.payments.payouts_due} {t("ta ulush o'tkazilishi kerak")}</small></Link>
          <Link to="/dashboard/admin/ads" className="stat"><Megaphone /><span>{t("Reklamalar")}</span><b>{x.ads.active}</b><small className="muted">{x.ads.views} {t("ko'rish ·")} {x.ads.clicks} {t("bosish")}</small></Link>
        </>}
        <Link to="/dashboard/complaints" className="stat"><MessageCircle /><span>{t("Xabarlar")}</span><b>{s.messages}</b></Link>
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
