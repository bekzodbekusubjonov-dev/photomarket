import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Avatar, Empty, DateField, Input, LinkButton, PageHead, Pagination, Select, Spinner, StatusBadge, useAsync, useDebounced } from "../../components/ui";
import type { Booking, Paged } from "../../types";
import { STATUS_LABEL, cx, fmtDate, fmtMoney } from "../../utils";
import { t } from "../../i18n";

const TABS = ["", "pending", "accepted", "completed", "cancelled", "rejected"] as const;

export default function Bookings() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dq = useDebounced(q);
  const status = sp.get("status") ?? "";
  const sort = sp.get("sort") ?? "newest";
  const [range, setRange] = useState({ from: "", to: "" });
  const page = Number(sp.get("page") || 1);
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== "page") n.delete("page"); setSp(n, { replace: true }); };
  const { data, loading } = useAsync(() => api.get<Paged<Booking> & { counts: Record<string, number> }>("/bookings",
    { status, q: dq, sort, page, date_from: range.from, date_to: range.to }), [status, dq, sort, page, range.from, range.to]);
  const counts = data?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const role = user!.role;

  return (
    <>
      <PageHead title={role === "admin" ? t("Barcha buyurtmalar") : t("Buyurtmalar")} sub={t("{n} ta buyurtma",{n:total})}
        actions={role === "client" && <LinkButton to="/creators">{t("Yangi buyurtma")}</LinkButton>} />
      <div className="tabs">
        {TABS.map((tb) => (
          <button key={tb} className={cx("tab", status === tb && "active")} onClick={() => set("status", tb)}>
            {tb ? STATUS_LABEL[tb] : t("Barchasi")} <span>{tb ? counts[tb] ?? 0 : total}</span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <Input placeholder={role === "creator" ? t("Mijoz, tadbir yoki manzil...") : t("Ijodkor, tadbir yoki manzil...")} value={q} onChange={(e) => setQ(e.target.value)} />
        <DateField placeholder={t("Sanadan")} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label={t("Sanadan")} title={t("Tadbir sanasi (dan)")} />
        <DateField placeholder={t("Sanagacha")} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label={t("Sanagacha")} title={t("Tadbir sanasi (gacha)")} />
        <Select value={sort} onChange={(e) => set("sort", e.target.value)} aria-label={t("Saralash")}>
          <option value="newest">{t("Yangi buyurtmalar")}</option><option value="oldest">{t("Eski buyurtmalar")}</option>
          <option value="event_asc">{t("Tadbir sanasi ↑")}</option><option value="event_desc">{t("Tadbir sanasi ↓")}</option>
        </Select>
      </div>
      {loading && !data ? <Spinner /> : data && data.items.length ? (
        <div className="table-wrap card flush">
          <table className="table">
            <thead><tr><th>#</th><th>{t("Tadbir")}</th><th>{role === "creator" ? t("Mijoz") : role === "client" ? t("Ijodkor") : t("Mijoz → Ijodkor")}</th><th>{t("Sana")}</th><th>{t("Narx")}</th><th>{t("Holat")}</th></tr></thead>
            <tbody>
              {data.items.map((b) => (
                <tr key={b.id}>
                  <td className="muted">{b.id}</td>
                  <td><Link to={`/dashboard/bookings/${b.id}`} className="strong-link">{b.title}</Link><div className="muted small">{b.location}</div></td>
                  <td>
                    <div className="row gap-s">
                      {role !== "admin" && <Avatar size={28} src={role === "creator" ? b.client?.avatar_url : b.creator.avatar_url} name={role === "creator" ? b.client?.name ?? "?" : b.creator.display_name} />}
                      <span>{role === "creator" ? b.client?.name : role === "client" ? b.creator.display_name : `${b.client?.name} → ${b.creator.display_name}`}</span>
                    </div>
                  </td>
                  <td className="nowrap">{fmtDate(b.event_date)}<div className="muted small">{b.start_time || "—"} · {b.duration_hours} {t("soat")}</div></td>
                  <td className="nowrap">{fmtMoney(b.price)}</td>
                  <td><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty icon={<ClipboardList />} title={t("Buyurtmalar topilmadi")} text={t("Filtrlarni o'zgartirib ko'ring.")} />}
      {data && <Pagination page={data.page} pages={data.pages} onChange={(p) => set("page", String(p))} />}
    </>
  );
}
