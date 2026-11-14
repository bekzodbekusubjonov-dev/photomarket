import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileSignature, Printer, Share2 } from "lucide-react";
import { api } from "../../api";
import { ReceiptPrinter } from "../../components/ReceiptPaper";
import { Alert, Button, PageHead, Spinner, useAsync, useToast } from "../../components/ui";
import type { Receipt } from "../../types";
import { fmtMoney } from "../../utils";
import { t } from "../../i18n";

export default function ReceiptPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data: r, loading, error } = useAsync(() => api.get<Receipt>(`/payments/${id}/receipt`), [id]);
  if (loading && !r) return <Spinner />;
  if (error || !r) return <Alert>{error ?? t("To'lov topilmadi")}</Alert>;
  const share = async () => {
    const text = `PhotoMarket ${t("chek")} ${r.receipt_no}: ${fmtMoney(r.amount)}`;
    try {
      if (navigator.share) await navigator.share({ title: "PhotoMarket", text, url: location.href });
      else { await navigator.clipboard.writeText(`${text}\n${location.href}`); toast(t("Havola nusxalandi")); }
    } catch { /* bekor qilindi */ }
  };
  return (
    <>
      <div className="no-print"><PageHead title={t("To'lov cheki")} sub={r.approved ? `${r.receipt_no}` : t("To'lov hali tasdiqlanmagan")} /></div>
      {!r.approved ? (
        <Alert kind="info">{r.status === "rejected" ? t("Bu to'lov rad etilgan, chek berilmaydi.") : t("Administrator to'lovni tasdiqlagach chek shu yerda chiqadi va emailingizga yuboriladi.")}</Alert>
      ) : (
        <div className="receipt-page print-area">
          <ReceiptPrinter r={r} />
        </div>
      )}
      <div className="receipt-actions no-print">
        <Button variant="ghost" onClick={() => nav(-1)}><ArrowLeft size={16} /> {t("Orqaga")}</Button>
        {r.approved && <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> {t("Chop etish / PDF")}</Button>}
        {r.approved && <Button variant="secondary" onClick={share}><Share2 size={16} /> {t("Ulashish")}</Button>}
        {r.contract_no && <Link className="btn btn-ghost btn-md" to={`/dashboard/contracts?q=${r.contract_no}`}><FileSignature size={16} /> {t("Shartnoma")} {r.contract_no}</Link>}
      </div>
    </>
  );
}
