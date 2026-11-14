import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Check, Copy, Plus, Receipt as ReceiptIcon, Send, Upload, X } from "lucide-react";
import { api, mediaUrl } from "../../api";
import { useAuth } from "../../auth";
import { Alert, Badge, Button, Empty, Field, Input, Modal, PageHead, Select, Spinner, Textarea, useAsync, useToast } from "../../components/ui";
import { CardVisual } from "./Cards";
import { Lightbox } from "../../components/Lightbox";
import type { BankCard, Booking, Paged } from "../../types";
import { PAY_METHOD_LABEL, PAY_STATUS_LABEL, fmtDateTime, fmtMoney } from "../../utils";
import { t } from "../../i18n";

interface Pay {
  id: number; booking_id: number; booking_title: string; amount: number; method: string; status: string;
  note: string; created_at: string; client: { name: string } | null; creator_name: string;
  proof_url: string; receipt_no: string; fee: number; creator_amount: number; payout_status: string; admin_note: string; card: string | null;
}
interface PayList { items: Pay[]; total_paid: number; pending: number }
const TONE: Record<string, "green" | "blue" | "red"> = { paid: "green", pending: "blue", rejected: "red" };

export default function Payments() {
  const { user } = useAuth();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const role = user!.role;
  const [status, setStatus] = useState("");
  const { data, loading, reload } = useAsync(
    () => api.get<PayList>(role === "admin" ? "/admin/payments" : "/payments", { status }), [status]);
  const [open, setOpen] = useState(!!sp.get("pay"));
  const [reject, setReject] = useState<Pay | null>(null);
  const [proof, setProof] = useState<string[] | null>(null);
  const act = async (fn: () => Promise<unknown>, ok = t("Saqlandi")) => {
    try { await fn(); toast(ok); reload(); } catch (e) { toast((e as Error).message, "error"); }
  };
  const decide = (p: Pay, s: "paid" | "rejected") => act(() => api.patch(`/${role === "admin" ? "admin/" : ""}payments/${p.id}`, { status: s }));
  const payout = (p: Pay) => act(() => api.post(`/admin/payments/${p.id}/payout`), t("Ijodkorga o'tkazildi deb belgilandi"));
  const needsAdmin = (p: Pay) => p.method !== "cash";
  const paidFees = data?.items.filter((p) => p.status === "paid").reduce((s, p) => s + p.fee, 0) ?? 0;
  const dueCount = data?.items.filter((p) => p.payout_status === "pending").length ?? 0;
  const dueSum = data?.items.filter((p) => p.payout_status === "pending").reduce((s, p) => s + p.creator_amount, 0) ?? 0;
  return (
    <>
      <PageHead title={t("To'lovlar tarixi")}
        sub={role === "admin" ? t("Karta/o'tkazma to'lovlarini chek bo'yicha tasdiqlang: mijoz va ijodkorga avtomatik chek yuboriladi.")
          : role === "client" ? t("To'lovni platforma kartasiga o'tkazing va chekni yuklang. Administrator tasdiqlagach elektron chek olasiz.")
          : t("Mijoz to'lovlari va ulushingiz holati")}
        actions={role !== "admin" && <Button onClick={() => setOpen(true)}><Plus size={16} /> {role === "client" ? t("To'lov qilish") : t("Naqd to'lovni qayd etish")}</Button>} />
      <div className="stats-grid">
        <div className="stat"><span>{t("To'langan")}</span><b className="money">{fmtMoney(data?.total_paid ?? 0)}</b></div>
        <div className="stat"><span>{t("Tasdiqlanmoqda")}</span><b className="money">{fmtMoney(data?.pending ?? 0)}</b></div>
        {role === "admin" && <div className="stat"><span>{t("Platforma ulushi")}</span><b className="money">{fmtMoney(paidFees)}</b></div>}
        {role !== "client" && dueCount > 0 && <div className="stat"><span>{role === "admin" ? t("Ijodkorlarga o'tkazish kerak") : t("Ulush o'tkazilishi kutilmoqda")}</span><b className="money">{fmtMoney(dueSum)}</b></div>}
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
            <thead><tr><th>{t("Sana")}</th><th>{t("Buyurtma")}</th><th>{role === "client" ? t("Ijodkor") : t("Mijoz")}</th><th>{t("Usul")}</th><th>{t("Summa")}</th><th>{t("Holat")}</th><th /></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td className="nowrap small">{fmtDateTime(p.created_at)}</td>
                  <td><b>{p.booking_title}</b>{p.note && <div className="muted small">{p.note}</div>}{p.admin_note && <div className="muted small">{t("Admin")}: {p.admin_note}</div>}</td>
                  <td>{role === "client" ? p.creator_name : role === "admin" ? `${p.client?.name} → ${p.creator_name}` : p.client?.name}</td>
                  <td>{PAY_METHOD_LABEL[p.method]}{p.card && <div className="muted small">{p.card}</div>}</td>
                  <td className="nowrap"><b>{fmtMoney(p.amount)}</b>{p.status === "paid" && role !== "client" && <div className="muted small">{t("ulush")}: {fmtMoney(p.creator_amount)}</div>}</td>
                  <td><Badge tone={TONE[p.status]}>{PAY_STATUS_LABEL[p.status]}</Badge>
                    {p.payout_status === "sent" && role !== "client" && <div className="muted small">{t("Ulush o'tkazildi")}</div>}
                    {p.payout_status === "pending" && role !== "client" && <div className="muted small">{t("Ulush kutilmoqda")}</div>}</td>
                  <td className="nowrap actions-cell">
                    {p.proof_url && <button className="proof-thumb" onClick={() => setProof([p.proof_url])} aria-label={t("Chekni ko'rish")}><img src={mediaUrl(p.proof_url)} alt="" /></button>}
                    {p.status === "paid" && <Link className="btn btn-secondary btn-sm" to={`/dashboard/payments/${p.id}/receipt`}><ReceiptIcon size={14} /> {t("Chek")}</Link>}
                    {p.status === "pending" && ((role === "admin") || (role === "creator" && !needsAdmin(p))) && <>
                      <Button size="sm" variant="success" onClick={() => decide(p, "paid")}><Check size={15} /> {t("Tasdiqlash")}</Button>
                      {role === "admin" ? <Button size="sm" variant="ghost" onClick={() => setReject(p)}><X size={15} /></Button>
                        : <Button size="sm" variant="ghost" onClick={() => decide(p, "rejected")}><X size={15} /></Button>}</>}
                    {role === "admin" && p.payout_status === "pending" && <Button size="sm" variant="secondary" onClick={() => payout(p)}><Send size={14} /> {t("Ijodkorga o'tkazildi")}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title={t("To'lovlar yo'q")} text={role === "client" ? t("Shartnomani imzolagach to'lovni shu yerda amalga oshirasiz.") : t("Qabul qilingan buyurtma bo'yicha to'lovlar shu yerda ko'rinadi.")} />}
      {open && <AddPayment pre={sp.get("pay")} role={role} onClose={() => { setOpen(false); if (sp.get("pay")) { sp.delete("pay"); setSp(sp, { replace: true }); } }} onDone={() => { setOpen(false); reload(); }} />}
      {reject && <RejectModal p={reject} onClose={() => setReject(null)} onDone={() => { setReject(null); reload(); }} />}
      <Lightbox items={proof ? proof.map((u, i) => ({ id: i, image_url: u, title: t("To'lov cheki"), category: "", position: i, created_at: "" } as never)) : []} index={proof ? 0 : null} onIndex={() => {}} onClose={() => setProof(null)} />
    </>
  );
}

function RejectModal({ p, onClose, onDone }: { p: Pay; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { await api.patch(`/admin/payments/${p.id}`, { status: "rejected", note }); toast(t("To'lov rad etildi")); onDone(); } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); } };
  return (
    <Modal open onClose={onClose} title={t("To'lovni rad etish")}>
      <div className="stack">
        <p className="muted">{p.booking_title} · {fmtMoney(p.amount)}</p>
        <Field label={t("Sabab (mijozga yuboriladi)")}><Textarea rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="row-end"><Button variant="secondary" onClick={onClose}>{t("Bekor qilish")}</Button><Button variant="danger" loading={busy} onClick={go}>{t("Rad etish")}</Button></div>
      </div>
    </Modal>
  );
}

function AddPayment({ pre, role, onClose, onDone }: { pre: string | null; role: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { data } = useAsync(() => api.get<Paged<Booking>>("/bookings", { size: 100 }), []);
  const { data: cards } = useAsync(() => (role === "client" ? api.get<BankCard[]>("/cards") : Promise.resolve([] as BankCard[])), []);
  const { data: ins } = useAsync(() => api.get<{ card_number: string; card_holder: string; commission_percent: number }>("/payments/instructions"), []);
  const list = (data?.items ?? []).filter((b) => b.status === "accepted" || b.status === "completed");
  const [f, setF] = useState({ booking_id: pre ?? "", amount: "", method: role === "client" ? "card" : "cash", note: "", card_id: "" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const online = f.method !== "cash";
  useEffect(() => {
    if (!pre || !list.length || f.amount) return;
    const b = list.find((x) => String(x.id) === pre);
    if (b?.price) setF((o) => ({ ...o, amount: String(b.price) }));
  }, [list.length]); // eslint-disable-line
  useEffect(() => { if (cards?.length && !f.card_id) setF((o) => ({ ...o, card_id: String((cards.find((c) => c.is_default) ?? cards[0]).id) })); }, [cards]); // eslint-disable-line
  const pick = (fl?: File) => { if (!fl) return; setFile(fl); setPreview(URL.createObjectURL(fl)); };
  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v.replace(/\s/g, "")); toast(t("Nusxalandi")); } catch { /* */ } };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (role === "client" && online && !file) return setErr(t("To'lov chekini (skrinshot) yuklang"));
    setBusy(true);
    try {
      let proof_url = "";
      if (file) { const fd = new FormData(); fd.append("file", file); proof_url = (await api.upload<{ url: string }>("/payments/proof", fd)).url; }
      await api.post("/payments", { booking_id: Number(f.booking_id), amount: Number(f.amount), method: f.method, note: f.note, proof_url,
        card_id: role === "client" && f.card_id && online ? Number(f.card_id) : null });
      toast(online ? t("Chek yuborildi. Administrator tasdiqlashini kuting") : t("To'lov qo'shildi")); onDone();
    } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
  };
  const methods = role === "client" ? Object.entries(PAY_METHOD_LABEL) : [["cash", PAY_METHOD_LABEL.cash]];
  return (
    <Modal open onClose={onClose} title={role === "client" ? t("To'lov qilish") : t("Naqd to'lovni qayd etish")}>
      <form onSubmit={submit} className="stack">
        <Alert>{err}</Alert>
        <Field label={t("Buyurtma")}>
          <Select required value={f.booking_id} onChange={(e) => {
            const b = list.find((x) => String(x.id) === e.target.value);
            setF({ ...f, booking_id: e.target.value, amount: b?.price ? String(b.price) : f.amount });
          }}>
            <option value="">{t("Tanlang")}</option>
            {list.map((b) => <option key={b.id} value={b.id}>#{b.id} · {b.title} · {b.creator.display_name}</option>)}
          </Select>
        </Field>
        <div className="grid-2">
          <Field label={t("Summa")}><Input type="number" required min={1000} step={1000} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label={t("Usul")}>
            <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              {methods.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
        </div>
        {role === "client" && online && (
          <>
            <div className="pay-ins">
              <span className="muted small">{t("To'lov rekvizitlari (PhotoMarket)")}</span>
              {ins?.card_number ? (
                <>
                  <div className="pay-ins-num"><b>{ins.card_number.replace(/(.{4})/g, "$1 ").trim()}</b><button type="button" onClick={() => copy(ins.card_number)} aria-label={t("Nusxalash")}><Copy size={16} /></button></div>
                  {ins.card_holder && <div className="muted small">{ins.card_holder}</div>}
                </>
              ) : <p className="field-error">{t("Administrator hali to'lov kartasini kiritmagan. Biroz kutib qayta urinib ko'ring.")}</p>}
            </div>
            {!!cards?.length && (
              <Field label={t("Qaysi kartangizdan to'ladingiz")}>
                <div className="card-pick">{cards.map((c) => <CardVisual key={c.id} c={c} selected={String(c.id) === f.card_id} onClick={() => setF({ ...f, card_id: String(c.id) })} />)}</div>
              </Field>
            )}
            <Field label={t("To'lov cheki (skrinshot)")} hint={t("Majburiy")}>
              <div className="proof-up" onClick={() => fileRef.current?.click()}>
                {preview ? <img src={preview} alt="" /> : <><Upload size={22} /><span>{t("Chek rasmini yuklang")}</span></>}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
            </Field>
          </>
        )}
        <Field label={t("Izoh")} hint={t("Ixtiyoriy")}><Textarea rows={2} maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="row-end"><Button variant="secondary" type="button" onClick={onClose}>{t("Bekor qilish")}</Button><Button loading={busy}>{online ? t("Chekni yuborish") : t("Saqlash")}</Button></div>
      </form>
    </Modal>
  );
}
