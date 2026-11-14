import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { Eye, X } from "lucide-react";
import { api } from "../../api";
import { useAuth, type TokenResponse } from "../../auth";
import { Button, Empty, PageHead, Spinner, useAsync, useToast } from "../../components/ui";
import { fmtDate, fmtMoney } from "../../utils";
import { t } from "../../i18n";

type Col = { key: string; label: string; type: string };
type Rep = {
  kind: string; title: string; total: number; summary: { label: string; value: number | string; type?: string }[];
  groups: { key: string; title: string; items: { value: string; label: string; count: number }[] }[];
  columns: Col[]; rows: Record<string, any>[]; filters: Record<string, string>; link?: string;
};
const TABS = [["users", "Foydalanuvchilar"], ["creators", "Ijodkorlar"], ["bookings", "Buyurtmalar"], ["payments", "To'lovlar"], ["contracts", "Shartnomalar"], ["revenue", "Daromad"], ["reviews", "Sharhlar"], ["complaints", "Shikoyatlar"]];

export default function AdminReport() {
  const { kind } = useParams();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { startViewAs } = useAuth();
  const q = Object.fromEntries(sp.entries());
  const { data, loading, error } = useAsync(() => api.get<Rep>(`/admin/reports/${kind}`, q), [kind, sp.toString()]);
  const toggle = (k: string, v: string) => { const n = new URLSearchParams(sp); n.get(k) === v ? n.delete(k) : n.set(k, v); setSp(n, { replace: true }); };
  const view = async (uid: number) => {
    try { startViewAs(await api.post<TokenResponse>(`/admin/impersonate/${uid}`)); } catch (e) { toast((e as Error).message, "error"); }
  };
  const cell = (c: Col, v: any) => v === null || v === undefined || v === "" ? "—" : c.type === "money" ? fmtMoney(Number(v)) : c.type === "date" ? fmtDate(String(v).slice(0, 10)) : String(v);
  return (
    <>
      <PageHead title={data?.title ?? t("Hisobot")} sub={t("Kartani bosib ma'lumotni toraytiring; qatorda «Ko'rish» — foydalanuvchi ko'zi bilan (faqat o'qish)")} />
      <div className="chips tabs-scroll">
        {TABS.map(([k, l]) => <Link key={k} to={`/dashboard/admin/reports/${k}`} className={`chip ${k === kind ? "on" : ""}`}>{t(l)}</Link>)}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading && !data ? <Spinner /> : data && (
        <>
          <div className="stats-grid">
            {data.summary.map((s) => <div key={s.label} className="stat"><span>{t(s.label)}</span><b className={s.type === "money" ? "money" : ""}>{s.type === "money" ? fmtMoney(Number(s.value)) : s.value}</b></div>)}
          </div>
          {data.groups.filter((g) => g.items.length).map((g) => (
            <section key={g.key} className="card rep-group">
              <h3>{t(g.title)}</h3>
              <div className="chips">
                {g.items.map((it) => (
                  <button key={it.value} className={`chip ${sp.get(g.key) === it.value ? "on" : ""}`} onClick={() => toggle(g.key, it.value)}>
                    {it.label} <b>{it.count}</b>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {Object.keys(data.filters).length > 0 && (
            <div className="active-filters">
              {Object.entries(data.filters).map(([k, v]) => <button key={k} className="chip on" onClick={() => toggle(k, v)}>{v} <X size={12} /></button>)}
              <button className="btn btn-ghost btn-sm" onClick={() => setSp({}, { replace: true })}>{t("Tozalash")}</button>
            </div>
          )}
          {data.rows.length ? (
            <div className="table-wrap card flush">
              <table className="table">
                <thead><tr>{data.columns.map((c) => <th key={c.key}>{t(c.label)}</th>)}<th /></tr></thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i}>
                      {data.columns.map((c) => <td key={c.key} className={c.type === "money" ? "nowrap" : ""}>{cell(c, r[c.key])}</td>)}
                      <td className="nowrap">
                        {r.user_id && r.role !== "Administrator" && <Button size="sm" variant="secondary" onClick={() => view(r.user_id)}><Eye size={14} /> {t("Ko'rish")}</Button>}
                        {r.booking_id && <Button size="sm" variant="secondary" onClick={() => nav(`/dashboard/bookings/${r.booking_id}`)}>{t("Ochish")}</Button>}
                        {r.payment_id && <Button size="sm" variant="secondary" onClick={() => nav(`/dashboard/payments/${r.payment_id}/receipt`)}>{t("Chek")}</Button>}
                        {r.contract_id && <Button size="sm" variant="secondary" onClick={() => nav(`/dashboard/contracts/${r.contract_id}`)}>{t("Ochish")}</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty title={t("Ma'lumot topilmadi")} />}
          <p className="muted small">{data.total} {t("ta yozuv")}{data.total > data.rows.length ? ` · ${t("birinchi")} ${data.rows.length}` : ""}</p>
        </>
      )}
    </>
  );
}
