import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, FileSignature, Search } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Empty, Input, PageHead, Select, Spinner, useAsync, useDebounced } from "../../components/ui";
import type { Contract } from "../../types";
import { CONTRACT_STATUS_LABEL, fmtDate, fmtMoney } from "../../utils";
import { t } from "../../i18n";

export const CONTRACT_TONE: Record<string, "green" | "blue" | "red" | "neutral"> = { signed: "green", awaiting: "blue", cancelled: "red", void: "neutral" };

export default function Contracts() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const { data, loading } = useAsync(() => api.get<{ items: Contract[] }>("/contracts", { status, q: dq }), [status, dq]);
  const role = user!.role;
  return (
    <>
      <PageHead title={t("Shartnomalar")} sub={role === "admin" ? t("Foydalanuvchilar o'rtasidagi barcha elektron shartnomalar") : t("Qabul qilingan buyurtmalar uchun elektron shartnomalar")} />
      <div className="toolbar">
        <div className="search-box"><Search size={16} /><Input placeholder={t("Raqam yoki nom bo'yicha qidirish")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("Barcha holatlar")}</option>
          {Object.entries(CONTRACT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      {loading && !data ? <Spinner /> : data?.items.length ? (
        <div className="contract-list">
          {data.items.map((c) => (
            <Link key={c.id} to={`/dashboard/contracts/${c.id}`} className="card contract-row">
              <div className="cr-icon"><FileSignature size={22} /></div>
              <div className="grow">
                <div className="cr-top"><b>{c.number}</b><Badge tone={CONTRACT_TONE[c.status]}>{CONTRACT_STATUS_LABEL[c.status]}</Badge></div>
                <div className="cr-title">{c.title}</div>
                <div className="muted small">{c.client.name} ⇄ {c.creator.name}{c.event_date ? ` · ${fmtDate(c.event_date)}` : ""}</div>
              </div>
              <div className="cr-right">
                <b className="money">{fmtMoney(c.price)}</b>
                <span className="sign-dots" title={t("Imzolar")}>
                  <span className={c.client_signed_at ? "ok" : ""}>{c.client_signed_at ? <CheckCircle2 size={14} /> : <Clock size={14} />} {t("Mijoz")}</span>
                  <span className={c.creator_signed_at ? "ok" : ""}>{c.creator_signed_at ? <CheckCircle2 size={14} /> : <Clock size={14} />} {t("Ijodkor")}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : <Empty icon={<FileSignature size={28} />} title={t("Shartnomalar yo'q")} text={t("Buyurtma qabul qilinganda elektron shartnoma avtomatik yaratiladi.")} />}
    </>
  );
}
