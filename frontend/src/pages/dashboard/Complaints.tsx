import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Alert, Badge, Button, Empty, Field, Modal, PageHead, Select, Spinner, Textarea, useAsync, useToast } from "../../components/ui";
import type { Booking, Paged } from "../../types";
import { COMPLAINT_REASON_LABEL, COMPLAINT_STATUS_LABEL, fmtDateTime } from "../../utils";
import { t } from "../../i18n";

interface Cmp {
  id: number; reason: string; text: string; status: string; admin_note: string; created_at: string;
  creator_name: string; booking_id: number | null; reporter: { name: string } | null;
}
const TONE: Record<string, "red" | "blue" | "green" | "neutral"> = { open: "red", in_review: "blue", resolved: "green", dismissed: "neutral" };

export default function Complaints() {
  const { user } = useAuth();
  const admin = user!.role === "admin";
  const toast = useToast();
  const [status, setStatus] = useState("");
  const { data, loading, reload } = useAsync(
    () => admin ? api.get<Cmp[]>("/admin/complaints", { status }) : api.get<Cmp[]>("/complaints/mine"), [status, admin]);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const set = async (c: Cmp, s: string) => {
    try { await api.patch(`/admin/complaints/${c.id}`, { status: s, admin_note: notes[c.id] ?? c.admin_note }); toast(t("Saqlandi")); reload(); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <>
      <PageHead title={t("Shikoyatlar")} sub={admin ? t("Foydalanuvchi shikoyatlarini ko'rib chiqing") : t("Ijodkor yoki buyurtma haqida shikoyat qoldirish mumkin")}
        actions={!admin && user!.role === "client" && <Button onClick={() => setOpen(true)}><Plus size={16} /> {t("Shikoyat yozish")}</Button>} />
      {admin && (
        <div className="toolbar">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("Barcha holatlar")}</option>
            {Object.entries(COMPLAINT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
      )}
      {loading && !data ? <Spinner /> : data?.length ? (
        <div className="list">
          {data.map((c) => (
            <article key={c.id} className="card">
              <div className="row gap-s wrap">
                <b>{COMPLAINT_REASON_LABEL[c.reason]}</b>
                <Badge tone={TONE[c.status]}>{COMPLAINT_STATUS_LABEL[c.status]}</Badge>
                <span className="muted small push">{fmtDateTime(c.created_at)}</span>
              </div>
              <p className="muted small">{admin && `${c.reporter?.name} → `}{c.creator_name}{c.booking_id ? ` · #${c.booking_id}` : ""}</p>
              <p>{c.text}</p>
              {admin ? (
                <div className="stack">
                  <Textarea rows={2} placeholder={t("Administrator izohi")} value={notes[c.id] ?? c.admin_note} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />
                  <div className="row gap-s wrap">
                    <Button size="sm" variant="secondary" onClick={() => set(c, "in_review")}>{t("Ko'rib chiqish")}</Button>
                    <Button size="sm" variant="success" onClick={() => set(c, "resolved")}>{t("Hal qilindi")}</Button>
                    <Button size="sm" variant="ghost" onClick={() => set(c, "dismissed")}>{t("Rad etish")}</Button>
                  </div>
                </div>
              ) : c.admin_note && <div className="review-reply"><b>{t("Javob:")}</b> {c.admin_note}</div>}
            </article>
          ))}
        </div>
      ) : <Empty title={t("Shikoyatlar yo'q")} />}
      {open && <NewComplaint onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />}
    </>
  );
}

function NewComplaint({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { data } = useAsync(() => api.get<Paged<Booking>>("/bookings", { size: 100 }), []);
  const [f, setF] = useState({ booking_id: "", reason: "quality", text: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api.post("/complaints", { booking_id: Number(f.booking_id), reason: f.reason, text: f.text });
      toast(t("Shikoyat yuborildi")); onDone();
    } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t("Shikoyat yozish")}>
      <form onSubmit={submit} className="stack">
        <Alert>{err}</Alert>
        <Field label={t("Buyurtma")}>
          <Select required value={f.booking_id} onChange={(e) => setF({ ...f, booking_id: e.target.value })}>
            <option value="">{t("Tanlang")}</option>
            {(data?.items ?? []).map((b) => <option key={b.id} value={b.id}>#{b.id} · {b.title} · {b.creator.display_name}</option>)}
          </Select>
        </Field>
        <Field label={t("Sabab")}>
          <Select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>
            {Object.entries(COMPLAINT_REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label={t("Tafsilot")}><Textarea rows={4} required minLength={5} maxLength={2000} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></Field>
        <div className="row-end"><Button variant="secondary" type="button" onClick={onClose}>{t("Bekor qilish")}</Button><Button loading={busy}>{t("Yuborish")}</Button></div>
      </form>
    </Modal>
  );
}
