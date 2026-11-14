import { useParams, useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { BrandMark } from "../components/Brand";
import { Spinner, useAsync } from "../components/ui";
import { CONTRACT_STATUS_LABEL, fmtDate } from "../utils";
import { t } from "../i18n";

type V = { valid: boolean; number?: string; status?: string; created_at?: string; event_date?: string | null; client?: string; creator?: string;
  client_signed?: boolean; creator_signed?: boolean; hash_short?: string; hash_match?: boolean };

/** Ommaviy shartnoma tekshiruvi: /verify/PM-2026-000123?h=<xesh> */
export default function Verify() {
  const { number } = useParams();
  const [sp] = useSearchParams();
  const h = sp.get("h") ?? "";
  const { data, loading } = useAsync(() => api.get<V>(`/contracts/verify/${number}`, { h }), [number, h]);
  if (loading || !data) return <Spinner />;
  return (
    <div className="container verify-page">
      <div className="card verify-card">
        <BrandMark size={52} />
        <h1>{t("Shartnomani tekshirish")}</h1>
        {!data.valid ? (
          <div className="verify-bad"><ShieldAlert size={40} /><b>{t("Bunday shartnoma topilmadi")}</b><p className="muted">{t("Raqamni tekshirib qayta urinib ko'ring.")}</p></div>
        ) : (
          <>
            <div className={data.hash_match || !h ? "verify-ok" : "verify-bad"}>
              {data.hash_match || !h ? <ShieldCheck size={40} /> : <ShieldAlert size={40} />}
              <b>{h ? (data.hash_match ? t("Hujjat haqiqiy va o'zgartirilmagan") : t("Xesh mos kelmadi — hujjat o'zgartirilgan bo'lishi mumkin")) : t("Shartnoma PhotoMarket tizimida mavjud")}</b>
            </div>
            <dl className="verify-list">
              <div><dt>{t("Raqam")}</dt><dd>{data.number}</dd></div>
              <div><dt>{t("Holat")}</dt><dd>{CONTRACT_STATUS_LABEL[data.status!]}</dd></div>
              <div><dt>{t("Mijoz")}</dt><dd>{data.client}</dd></div>
              <div><dt>{t("Ijodkor")}</dt><dd>{data.creator}</dd></div>
              {data.event_date && <div><dt>{t("Sana")}</dt><dd>{fmtDate(data.event_date)}</dd></div>}
              <div><dt>{t("Imzolar")}</dt><dd>{data.client_signed ? <CheckCircle2 size={14} className="ok" /> : "—"} {t("Mijoz")} · {data.creator_signed ? <CheckCircle2 size={14} className="ok" /> : "—"} {t("Ijodkor")}</dd></div>
              <div><dt>{t("Xesh")}</dt><dd><code>{data.hash_short}…</code></dd></div>
            </dl>
          </>
        )}
        <Link to="/" className="btn btn-secondary btn-md">{t("Bosh sahifa")}</Link>
      </div>
    </div>
  );
}
