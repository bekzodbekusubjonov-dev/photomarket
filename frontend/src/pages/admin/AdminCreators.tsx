import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { Avatar, Badge, Input, PageHead, Pagination, Select, Spinner, Stars, useAsync, useDebounced, useToast } from "../../components/ui";
import type { CreatorCard, Paged } from "../../types";
import { CATEGORY_LABEL, fmtMoney } from "../../utils";
import { t } from "../../i18n";

export default function AdminCreators() {
  const toast = useToast();
  const [sp] = useSearchParams();
  const [q, setQ] = useState("");
  const [verified, setVerified] = useState(sp.get("verified") ?? "");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, setData, loading } = useAsync(() => api.get<Paged<CreatorCard>>("/admin/creators", { q: dq, verified, page }), [dq, verified, page]);
  const patch = async (c: CreatorCard, body: Partial<Pick<CreatorCard, "verified" | "featured" | "active">>) => {
    try {
      const nc = await api.patch<CreatorCard>(`/admin/creators/${c.id}`, body);
      setData((o) => o && { ...o, items: o.items.map((x) => x.id === nc.id ? { ...x, ...nc } : x) });
      toast(t("Saqlandi"));
    } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <>
      <PageHead title={t("Ijodkorlar")} sub={t("Tasdiqlash, tavsiya qilish va katalogdan yashirish")} />
      <div className="toolbar">
        <Input placeholder={t("Ism, email yoki shahar...")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select value={verified} onChange={(e) => { setVerified(e.target.value); setPage(1); }}>
          <option value="">{t("Hammasi")}</option><option value="false">{t("Tasdiqlanmaganlar")}</option><option value="true">{t("Tasdiqlanganlar")}</option>
        </Select>
      </div>
      {loading && !data ? <Spinner /> : (
        <div className="table-wrap card flush">
          <table className="table">
            <thead><tr><th>{t("Ijodkor")}</th><th>{t("Yo'nalish")}</th><th>{t("Narx")}</th><th>{t("Reyting")}</th><th>{t("Tasdiqlangan")}</th><th>{t("Tavsiya")}</th><th>{t("Katalogda")}</th></tr></thead>
            <tbody>
              {data?.items.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/creators/${c.id}`} className="row gap-s"><Avatar src={c.avatar_url} name={c.display_name} size={32} /><div><b>{c.display_name}</b><div className="muted small">{c.email} · {c.city} · {c.portfolio_count} {t("rasm")}</div></div></Link>
                    {c.user_active === false && <Badge tone="red">{t("Hisob bloklangan")}</Badge>}</td>
                  <td>{CATEGORY_LABEL[c.category]}</td>
                  <td className="nowrap">{fmtMoney(c.price_from)}</td>
                  <td className="nowrap"><Stars value={c.rating} /> <span className="small muted">({c.reviews_count})</span></td>
                  <td><input type="checkbox" className="switch" checked={c.verified} onChange={(e) => patch(c, { verified: e.target.checked })} aria-label={t("Tasdiqlangan")} /></td>
                  <td><input type="checkbox" className="switch" checked={c.featured} onChange={(e) => patch(c, { featured: e.target.checked })} aria-label={t("Tavsiya")} /></td>
                  <td><input type="checkbox" className="switch" checked={c.active} onChange={(e) => patch(c, { active: e.target.checked })} aria-label={t("Faol")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </>
  );
}
