import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, Check, CheckCircle2, Clock, Coins, Star, ThumbsUp, X } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { BarChart } from "../../components/BarChart";
import { CreatorCard as CreatorCardView } from "../../components/CreatorCard";
import { MonthCalendar, currentMonth } from "../../components/MonthCalendar";
import { Avatar, Button, Empty, Img, LinkButton, PageHead, Spinner, StatusBadge, useAsync, useToast } from "../../components/ui";
import type { Booking, CreatorCard, CreatorFull, Paged, SeriesPoint } from "../../types";
import { fmtDate, fmtMonthShort, fmtMoney } from "../../utils";
import AdminOverview from "../admin/AdminOverview";
import { t } from "../../i18n";

type Stats = {
  counts: Record<string, number>; total: number; money: number; series: SeriesPoint[]; upcoming: Booking[];
  rating?: number; reviews_count?: number; acceptance_rate?: number | null; portfolio_count?: number; services_count?: number;
};

export function UpcomingList({ items, role }: { items: Booking[]; role: string }) {
  if (!items.length) return <p className="muted">{t("Yaqin kunlarda rejalashtirilgan buyurtma yo'q.")}</p>;
  return (
    <div className="list">
      {items.map((b) => {
        const who = role === "creator" ? b.client?.name ?? t("Mijoz") : b.creator.display_name;
        const av = role === "creator" ? b.client?.avatar_url : b.creator.avatar_url;
        return (
          <Link key={b.id} to={`/dashboard/bookings/${b.id}`} className="list-row">
            <div className="date-chip"><b>{Number(b.event_date.slice(8))}</b><span>{fmtMonthShort(b.event_date)}</span></div>
            <Avatar src={av} name={who} size={36} />
            <div className="grow"><b>{b.title}</b><div className="muted small">{who} · {b.start_time || "vaqt kelishiladi"} · {b.location}</div></div>
            <StatusBadge status={b.status} />
          </Link>
        );
      })}
    </div>
  );
}

export default function Overview() {
  const { user } = useAuth();
  if (user?.role === "admin") return <AdminOverview />;
  return <UserOverview />;
}

function UserOverview() {
  const { user } = useAuth();
  const { data: s, loading } = useAsync(() => api.get<Stats>("/dashboard/stats"), []);
  const prof = useAsync(() => user?.role === "creator" ? api.get<CreatorFull>("/creator/profile") : Promise.resolve(null), [user?.role]);
  const reco = useAsync(() => user?.role === "client" ? api.get<Paged<CreatorCard>>("/creators", { size: 3, sort: "rating" }) : Promise.resolve(null), [user?.role]);
  if (loading || !s) return <Spinner />;
  const isCreator = user?.role === "creator";
  const c = s.counts;
  return (
    <>
      <PageHead title={t("Assalomu alaykum, {name}!",{name:user?.name.split(" ")[0] ?? ""})}
        sub={isCreator ? t("Buyurtmalaringiz va profilingiz holati") : t("Buyurtmalaringiz bir joyda")}
        actions={isCreator ? <LinkButton to={`/creators/${user?.creator_id}`} variant="secondary">{t("Ommaviy profilni ko'rish")}</LinkButton>
          : <LinkButton to="/creators">{t("Ijodkor topish")} <ArrowRight size={16} /></LinkButton>} />

      {isCreator && prof.data && (prof.data.completeness ?? 100) < 100 && (
        <div className="card progress-card">
          <div className="grow">
            <b>{t("Profil")} {prof.data.completeness}{t("% to'ldirilgan")}</b>
            <p className="muted small">{t("To'liq profil (rasm, bio, kamida 3 ta portfolio, xizmatlar, telefon) mijozlar ishonchini oshiradi va katalogda yuqoriroq chiqadi.")}</p>
            <div className="progress"><div style={{ width: `${prof.data.completeness}%` }} /></div>
          </div>
          <LinkButton to="/dashboard/profile" size="sm">{t("To'ldirish")}</LinkButton>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat"><Clock /><span>{t("Kutilmoqda")}</span><b>{c.pending ?? 0}</b></div>
        <div className="stat"><CalendarCheck /><span>{t("Qabul qilingan")}</span><b>{c.accepted ?? 0}</b></div>
        <div className="stat"><CheckCircle2 /><span>{t("Bajarilgan")}</span><b>{c.completed ?? 0}</b></div>
        <div className="stat"><Coins /><span>{isCreator ? t("Daromad (bajarilgan)") : t("Sarflangan")}</span><b className="money">{fmtMoney(s.money)}</b></div>
        {isCreator && <div className="stat"><Star /><span>{t("Reyting")}</span><b>{s.rating ? s.rating.toFixed(1) : "—"} <small className="muted">({s.reviews_count})</small></b></div>}
        {isCreator && <div className="stat"><ThumbsUp /><span>{t("Qabul qilish darajasi")}</span><b>{s.acceptance_rate ?? "—"}{s.acceptance_rate != null && "%"}</b></div>}
      </div>

      {isCreator && <NewRequests />}
      <div className="dash-grid">
        <section className="card">
          <div className="card-head"><h2>{t("Yaqin buyurtmalar")}</h2><Link to="/dashboard/bookings">{t("Barchasi")}</Link></div>
          {s.total ? <UpcomingList items={s.upcoming} role={user!.role} /> :
            <Empty title={t("Hali buyurtma yo'q")} text={isCreator ? t("Profilingizni to'ldiring — mijozlar sizni topa boshlaydi.") : t("Katalogdan ijodkor tanlang va birinchi buyurtmani bering.")}
              action={isCreator ? <LinkButton to="/dashboard/portfolio">{t("Portfolio qo'shish")}</LinkButton> : <LinkButton to="/creators">{t("Katalogga o'tish")}</LinkButton>} />}
        </section>
        {isCreator ? (
          <section className="card">
            <div className="card-head"><h2>{t("Oylik daromad")}</h2></div>
            <BarChart data={s.series} field="revenue" money />
            <h3 className="mt">{t("Buyurtmalar soni")}</h3><BarChart data={s.series} field="bookings" />
          </section>
        ) : <ClientCalendar />}
      </div>

      {isCreator && prof.data && (
        <section className="card mt">
          <div className="card-head"><h2>{t("Portfolio")}</h2><Link to="/dashboard/portfolio">{t("Boshqarish")}</Link></div>
          {prof.data.portfolio.length ? (
            <div className="pf-strip">
              {prof.data.portfolio.slice(0, 4).map((p) => (
                <Link key={p.id} to="/dashboard/portfolio"><Img src={p.image_url} alt={p.title} />{p.title && <span>{p.title}</span>}</Link>
              ))}
            </div>
          ) : <p className="muted">{t("Portfolio bo'sh — eng yaxshi 6–12 ta ishingizni yuklang.")}</p>}
        </section>
      )}
      {!isCreator && reco.data && reco.data.items.length > 0 && (
        <section className="mt">
          <div className="card-head"><h2>{t("Sizga tavsiya etamiz")}</h2><Link to="/creators">{t("Barchasi")}</Link></div>
          <div className="reco">{reco.data.items.map((c) => <CreatorCardView key={c.id} c={c} />)}</div>
        </section>
      )}
    </>
  );
}

function NewRequests() {
  const toast = useToast();
  const { data, setData } = useAsync(() => api.get<Paged<Booking>>("/bookings", { status: "pending", sort: "event_asc", size: 5 }), []);
  const act = async (b: Booking, status: "accepted" | "rejected") => {
    try {
      await api.post(`/bookings/${b.id}/status`, { status });
      setData((o) => o && { ...o, items: o.items.filter((x) => x.id !== b.id), total: o.total - 1 });
      toast(status === "accepted" ? t("Buyurtma qabul qilindi") : t("Buyurtma rad etildi"));
    } catch (e) { toast((e as Error).message, "error"); }
  };
  if (!data?.items.length) return null;
  return (
    <section className="card">
      <div className="card-head"><h2>{t("Yangi so'rovlar")} <span className="side-badge">{data.total}</span></h2><Link to="/dashboard/bookings?status=pending">{t("Barchasi")}</Link></div>
      <div className="list">
        {data.items.map((b) => (
          <div key={b.id} className="list-row req-row">
            <Avatar src={b.client?.avatar_url} name={b.client?.name ?? t("Mijoz")} size={40} />
            <Link to={`/dashboard/bookings/${b.id}`} className="grow"><b>{b.client?.name}</b> <span className="badge badge-accent">{b.title}</span>
              <div className="muted small">{fmtDate(b.event_date)} · {b.start_time || "vaqt kelishiladi"} · {fmtMoney(b.price)}</div></Link>
            <div className="row gap-s">
              <Button size="sm" variant="success" onClick={() => act(b, "accepted")}><Check size={15} /> {t("Qabul")}</Button>
              <Button size="sm" variant="danger" onClick={() => act(b, "rejected")}><X size={15} /> {t("Rad")}</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClientCalendar() {
  const [month, setMonth] = useState(currentMonth());
  const [items, setItems] = useState<Booking[]>([]);
  useEffect(() => {
    api.get<{ bookings: Booking[] }>("/bookings/calendar", { month }).then((r) => setItems(r.bookings)).catch(() => {});
  }, [month]);
  const days = new Set(items.map((b) => b.event_date));
  return (
    <section className="card">
      <div className="card-head"><h2>{t("Kalendar")}</h2><Link to="/dashboard/calendar">{t("To'liq")}</Link></div>
      <MonthCalendar compact month={month} onMonth={setMonth} dayClass={(d) => days.has(d) ? "has-event" : undefined} />
      <h3 className="mt">{t("Shu oyda")}</h3>
      {items.length ? items.map((b) => (
        <Link key={b.id} to={`/dashboard/bookings/${b.id}`} className="mini-event"><b>{fmtDate(b.event_date, false)}</b> {b.title} · {b.creator.display_name}</Link>
      )) : <p className="muted small">{t("Bu oyda buyurtma yo'q.")}</p>}
    </section>
  );
}
