import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Alert, Badge, Button, Empty, Field, Input, Modal, PageHead, Select, Spinner, Textarea, useAsync, useToast } from "../../components/ui";
import type { Booking, Paged } from "../../types";
import { PAY_METHOD_LABEL, PAY_STATUS_LABEL, fmtDateTime, fmtMoney } from "../../utils";
import { t } from "../../i18n";

interface Pay {
  id: number; booking_id: number; booking_title: string; amount: number; method: string; status: string;
  note: string; created_at: string; client: { name: string } | null; creator_name: string;
}
interface PayList { items: Pay[]; total_paid: number; pending: number }
const TONE: Record<string, "green" | "blue" | "red"> = { paid: "green", pending: "blue", rejected: "red" };

export default function Payments() {
  const { user } = useAuth();
  const toast = useToast();
  const role = user!.role;
  const [status, setStatus] = useState("");
  const { data, loading, reload } = useAsync(
    () => api.get<PayList>(role === "admin" ? "/admin/payments" : "/payments", { status }), [status]);
  const [open, setOpen] = useState(false);
  const decide = async (p: Pay, s: "paid" | "rejected") => {
    try { await api.patch(`/payments/${p.id}`, { status: s }); toast(t("Saqlandi")); reload(); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <>
      <PageHead title={t("To'lovlar tarixi")} sub={t("Platforma pulni ushlab turmaydi: mijoz ijodkorga to'g'ridan-to'g'ri to'laydi, ikkala tomon to'lovni shu yerda qayd etadi.")}
        actions={role !== "admin" && <Button onClick={() => setOpen(true)}><Plus size={16} /> {t("To'lov qo'shish")}</Button>} />
      <div className="stats-grid">
        <div className="stat"><span>{t("To'langan")}</span><b className="money">{fmtMoney(data?.total_paid ?? 0)}</b></div>
        <div className="stat"><span>{t("Tasdiqlanmoqda")}</span><b className="money">{fmtMoney(data?.pending ?? 0)}</b></div>
      </div>
      <div className="toolbar">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("Barcha holatlar")}</option>
          <option value="paid">{t("To'langan")}</option><option value="pending">{t("Tasdiqlanmoqda")}</option><option value="rejected">{t("Rad etildi")}</option>
        </Select>
      </div>
      {loading && !data ? <Spinner /> : data?.items.length ? (
        <div className="table-wrap card flush">
          <table className="table">
            <thead><tr><th>{t("Sana")}</th><th>{t("Buyurtma")}</th><th>{role === "client" ? t("Ijodkor") : t("Mijoz")}</th><th>{t("Usul")}</th><th>{t("Summa")}</th><th>{t("Holat")}</th>{role === "creator" && <th />}</tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td className="nowrap small">{fmtDateTime(p.created_at)}</td>
                  <td><b>{p.booking_title}</b>{p.note && <div className="muted small">{p.note}</div>}</td>
                  <td>{role === "client" ? p.creator_name : role === "admin" ? `${p.client?.name} → ${p.creator_name}` : p.client?.name}</td>
                  <td>{PAY_METHOD_LABEL[p.method]}</td>
                  <td className="nowrap"><b>{fmtMoney(p.amount)}</b></td>
                  <td><Badge tone={TONE[p.status]}>{PAY_STATUS_LABEL[p.status]}</Badge></td>
                  {role === "creator" && <td className="nowrap">{p.status === "pending" && <>
                    <Button size="sm" variant="success" onClick={() => decide(p, "paid")}><Check size={15} /> {t("Tasdiqlash")}</Button>{" "}
                    <Button size="sm" variant="ghost" onClick={() => decide(p, "rejected")}><X size={15} /></Button></>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title={t("To'lovlar yo'q")} text={t("Qabul qilingan buyurtma bo'yicha to'lovni shu yerda qayd eting.")} />}
      {open && <AddPayment onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />}
    </>
  );
}

function AddPayment({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { data } = useAsync(() => api.get<Paged<Booking>>("/bookings", { size: 100 }), []);
  const list = (data?.items ?? []).filter((b) => b.status === "accepted" || b.status === "completed");
  const [f, setF] = useState({ booking_id: "", amount: "", method: "cash", note: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api.post("/payments", { booking_id: Number(f.booking_id), amount: Number(f.amount), method: f.method, note: f.note });
      toast(t("To'lov qo'shildi")); onDone();
    } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t("To'lov qo'shish")}>
      <form onSubmit={submit} className="stack">
        <Alert>{err}</Alert>
        <Field label={t("Buyurtma")}>
          <Select required value={f.booking_id} onChange={(e) => {
            const b = list.find((x) => String(x.id) === e.target.value);
            setF({ ...f, booking_id: e.target.value, amount: f.amount || (b?.price ? String(b.price) : "") });
          }}>
            <option value="">{t("Tanlang")}</option>
            {list.map((b) => <option key={b.id} value={b.id}>#{b.id} · {b.title} · {b.creator.display_name}</option>)}
          </Select>
        </Field>
        <div className="grid-2">
          <Field label={t("Summa")}><Input type="number" required min={1000} step={1000} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label={t("Usul")}>
            <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              {Object.entries(PAY_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t("Izoh")} hint={t("Ixtiyoriy")}><Textarea rows={2} maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="row-end"><Button variant="secondary" type="button" onClick={onClose}>{t("Bekor qilish")}</Button><Button loading={busy}>{t("Saqlash")}</Button></div>
      </form>
    </Modal>
  );
}
