import { api } from "../../api";
import { BarChart } from "../../components/BarChart";
import { PageHead, Spinner, useAsync } from "../../components/ui";
import type { SeriesPoint } from "../../types";
import { fmtMoney } from "../../utils";
import { t } from "../../i18n";

interface A {
  series: SeriesPoint[]; by_category: { name: string; count: number }[]; by_city: { name: string; count: number }[];
  users_by_month: { month: string; count: number }[]; payments_paid: number; conversion: number; open_complaints: number;
}

function Rank({ rows }: { rows: { name: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="muted">—</p>;
  return (
    <div className="rank">{rows.map((r) => (
      <div key={r.name} className="rank-row"><span>{t(r.name)}</span><div className="rank-bar"><i style={{ width: `${(r.count / max) * 100}%` }} /></div><b>{r.count}</b></div>
    ))}</div>
  );
}

export default function AdminAnalytics() {
  const { data, loading } = useAsync(() => api.get<A>("/admin/analytics"), []);
  if (loading || !data) return <Spinner />;
  const users: SeriesPoint[] = data.users_by_month.map((u) => ({ label: u.month.slice(5), bookings: u.count, completed: 0, revenue: 0 }));
  return (
    <>
      <PageHead title={t("Tahlil")} sub={t("So'nggi 12 oy bo'yicha ko'rsatkichlar")} />
      <div className="stats-grid">
        <div className="stat"><span>{t("Konversiya (bajarilgan / barcha)")}</span><b>{data.conversion}%</b></div>
        <div className="stat"><span>{t("Tasdiqlangan to'lovlar")}</span><b className="money">{fmtMoney(data.payments_paid)}</b></div>
        <div className="stat"><span>{t("Ochiq shikoyatlar")}</span><b>{data.open_complaints}</b></div>
      </div>
      <div className="dash-grid">
        <section className="card"><div className="card-head"><h2>{t("Buyurtmalar dinamikasi")}</h2></div><BarChart data={data.series} field="bookings" /></section>
        <section className="card"><div className="card-head"><h2>{t("Daromad (bajarilgan)")}</h2></div><BarChart data={data.series} field="revenue" money /></section>
        <section className="card"><div className="card-head"><h2>{t("Yangi foydalanuvchilar")}</h2></div><BarChart data={users} field="bookings" /></section>
        <section className="card"><div className="card-head"><h2>{t("Yo'nalishlar bo'yicha")}</h2></div><Rank rows={data.by_category} /></section>
        <section className="card"><div className="card-head"><h2>{t("Shaharlar bo'yicha")}</h2></div><Rank rows={data.by_city} /></section>
      </div>
    </>
  );
}
