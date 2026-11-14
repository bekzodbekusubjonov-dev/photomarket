import { useState } from "react";
import { CreditCard, Lock, Plus, Star, Trash2 } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Alert, Badge, Button, Empty, Field, Input, Modal, PageHead, Spinner, useAsync, useConfirm, useToast } from "../../components/ui";
import type { BankCard } from "../../types";
import { CARD_BRAND_LABEL } from "../../utils";
import { t } from "../../i18n";

export function CardVisual({ c, onClick, selected }: { c: BankCard; onClick?: () => void; selected?: boolean }) {
  return (
    <div className={`bank-card brand-${c.brand} ${selected ? "sel" : ""}`} onClick={onClick} role={onClick ? "button" : undefined}>
      <div className="bc-top"><span className="bc-chip" /><b>{CARD_BRAND_LABEL[c.brand] || t("KARTA")}</b></div>
      <div className="bc-num">{c.masked}</div>
      <div className="bc-bot"><div><small>{t("EGASI")}</small><span>{c.holder}</span></div><div><small>{t("MUDDATI")}</small><span>{c.exp}</span></div></div>
      {c.is_default && <span className="bc-default"><Star size={12} /> {t("Asosiy")}</span>}
    </div>
  );
}

const fmtNum = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
const fmtExp = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };

export default function Cards() {
  const { user } = useAuth();
  const toast = useToast();
  const { confirm, node: confirmNode } = useConfirm();
  const { data, loading, reload } = useAsync(() => api.get<BankCard[]>("/cards"), []);
  const [open, setOpen] = useState(false);
  const makeDefault = async (c: BankCard) => { try { await api.post(`/cards/${c.id}/default`); reload(); } catch (e) { toast((e as Error).message, "error"); } };
  const remove = async (c: BankCard) => {
    if (!(await confirm(`${t("Kartani o'chirasizmi?")} ${c.masked}`))) return;
    try { await api.del(`/cards/${c.id}`); toast(t("Karta o'chirildi")); reload(); } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <>
      <PageHead title={t("Bank kartalarim")}
        sub={user!.role === "creator" ? t("Daromadingiz (ulush) shu kartaga o'tkaziladi") : t("To'lovlarni tez rasmiylashtirish uchun kartangizni saqlang")}
        actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> {t("Karta qo'shish")}</Button>} />
      <Alert kind="info"><Lock size={14} style={{ verticalAlign: "-2px" }} /> {t("Xavfsizlik: karta raqamining faqat boshi va oxirgi 4 raqami saqlanadi. To'liq raqam va CVV kod hech qachon saqlanmaydi.")}</Alert>
      {loading && !data ? <Spinner /> : data?.length ? (
        <div className="cards-grid">
          {data.map((c) => (
            <div key={c.id} className="card-item">
              <CardVisual c={c} />
              <div className="card-actions">
                {!c.is_default && <Button size="sm" variant="secondary" onClick={() => makeDefault(c)}><Star size={14} /> {t("Asosiy qilish")}</Button>}
                {c.is_default && <Badge tone="accent">{t("Asosiy")}</Badge>}
                <Button size="sm" variant="ghost" onClick={() => remove(c)} aria-label={t("O'chirish")}><Trash2 size={15} /></Button>
              </div>
            </div>
          ))}
        </div>
      ) : <Empty icon={<CreditCard size={28} />} title={t("Kartalar yo'q")} text={t("Karta qo'shing — to'lov va daromadni qabul qilish osonlashadi.")} action={<Button onClick={() => setOpen(true)}><Plus size={16} /> {t("Karta qo'shish")}</Button>} />}
      {confirmNode}
      {open && <AddCard onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />}
    </>
  );
}

function AddCard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const [f, setF] = useState({ number: "", holder: "", exp: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await api.post("/cards", { number: f.number.replace(/\s/g, ""), holder: f.holder || user!.name, exp: f.exp }); toast(t("Karta qo'shildi")); onDone(); }
    catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t("Karta qo'shish")}>
      <form onSubmit={submit} className="stack">
        <Alert>{err}</Alert>
        <Field label={t("Karta raqami")}><Input inputMode="numeric" autoComplete="cc-number" required placeholder="8600 0000 0000 0000" value={f.number} onChange={(e) => setF({ ...f, number: fmtNum(e.target.value) })} /></Field>
        <div className="grid-2">
          <Field label={t("Amal qilish muddati")}><Input inputMode="numeric" autoComplete="cc-exp" required placeholder="MM/YY" maxLength={5} value={f.exp} onChange={(e) => setF({ ...f, exp: fmtExp(e.target.value) })} /></Field>
          <Field label={t("Karta egasi")}><Input autoComplete="cc-name" required minLength={3} placeholder={user!.name.toUpperCase()} value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} /></Field>
        </div>
        <p className="muted small"><Lock size={13} /> {t("CVV so'ralmaydi va saqlanmaydi. Faqat boshi va oxirgi 4 raqam eslab qolinadi.")}</p>
        <div className="row-end"><Button variant="secondary" type="button" onClick={onClose}>{t("Bekor qilish")}</Button><Button loading={busy}>{t("Saqlash")}</Button></div>
      </form>
    </Modal>
  );
}
