import { api } from "../../api";
import { BarChart } from "../../components/BarChart";
import { LinkButton, PageHead, Spinner, useAsync } from "../../components/ui";
import type { SeriesPoint } from "../../types";
import { fmtMoney } from "../../utils";
import { t } from "../../i18n";

interface E { completed_total: number; paid: number; pending: number; outstanding: number; series: SeriesPoint[] }

export default function Earnings() {
  const { data, loading } = useAsync(() => api.get<E>("/creator/earnings"), []);
  if (loading || !data) return <Spinner />;
  return (
    <>
      <PageHead title={t("Daromad")} sub={t("Bajarilgan ishlar va qabul qilingan to'lovlar")}
        actions={<LinkButton to="/dashboard/payments" variant="secondary">{t("To'lovlar tarixi")}</LinkButton>} />
      <div className="stats-grid">
        <div className="stat"><span>{t("Bajarilgan ishlar summasi")}</span><b className="money">{fmtMoney(data.completed_total)}</b></div>
        <div className="stat"><span>{t("Qabul qilingan to'lov")}</span><b className="money">{fmtMoney(data.paid)}</b></div>
        <div className="stat"><span>{t("Tasdiqlanmoqda")}</span><b className="money">{fmtMoney(data.pending)}</b></div>
        <div className="stat"><span>{t("Olinishi kerak")}</span><b className="money">{fmtMoney(data.outstanding)}</b></div>
      </div>
      <section className="card"><div className="card-head"><h2>{t("Oylik daromad")}</h2></div><BarChart data={data.series} field="revenue" money /></section>
    </>
  );
}
