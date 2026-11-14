import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, CreditCard, Printer, QrCode, ShieldCheck, FileSignature } from "lucide-react";
import { api } from "../../api";
import { BrandMark } from "../../components/Brand";
import { SignaturePad } from "../../components/Signature";
import { Alert, Badge, Button, Field, Input, Modal, Spinner, useAsync, useToast } from "../../components/ui";
import { OtpInput } from "../auth/AuthShell";
import { useAuth } from "../../auth";
import type { ContractFull } from "../../types";
import { CATEGORY_LABEL, CONTRACT_STATUS_LABEL, fmtDate, fmtDateTime, fmtMoney } from "../../utils";
import { CONTRACT_TONE } from "./Contracts";
import { t } from "../../i18n";

export default function ContractView() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: c, loading, error, reload } = useAsync(() => api.get<ContractFull>(`/contracts/${id}`), [id]);
  const [sign, setSign] = useState(false);
  if (loading && !c) return <Spinner />;
  if (error || !c) return <div className="alert alert-error">{error ?? t("Shartnoma topilmadi")}</div>;
  const verifyUrl = `${location.origin}/check/${c.number}?h=${c.doc_hash}`;
  const stamp = c.status === "signed" ? t("IMZOLANGAN") : c.status === "awaiting" ? t("IMZO KUTILMOQDA") : t("BEKOR QILINGAN");
  return (
    <>
      <div className="doc-actions no-print">
        <Button variant="ghost" onClick={() => nav(-1)}><ArrowLeft size={16} /> {t("Orqaga")}</Button>
        <div className="grow" />
        {c.can_sign && <Button onClick={() => setSign(true)}><FileSignature size={16} /> {t("Imzolash")}</Button>}
        {c.status === "signed" && c.my_side === "client" && <Link className="btn btn-primary btn-md" to={`/dashboard/payments?pay=${c.booking_id}`}><CreditCard size={16} /> {t("To'lov qilish")}</Link>}
        <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> {t("Chop etish / PDF")}</Button>
      </div>
      <article className="contract-doc print-area">
        <header className="doc-head">
          <div className="doc-brand"><BrandMark size={46} /><div><b>PhotoMarket</b><span>{t("Fotograf va videograflar bozori")}</span></div></div>
          <div className="doc-title">
            <h1>{t("ELEKTRON SHARTNOMA")}</h1>
            <div className="doc-no">№ {c.number}</div>
            <div className="muted small">{fmtDate(c.created_at.slice(0, 10))}</div>
          </div>
        </header>
        <div className={`doc-stamp st-${c.status}`}>{stamp}</div>

        <section className="doc-parties">
          <div><span className="doc-label">{t("Buyurtmachi (Mijoz)")}</span><b>{c.client.name}</b>
            {c.client_contact && <small>{c.client_contact.phone || ""} {c.client_contact.email}</small>}</div>
          <div><span className="doc-label">{t("Ijrochi (Ijodkor)")}</span><b>{c.creator.name}</b>
            {c.creator_contact && <small>{c.creator_contact.phone || ""} {c.creator_contact.email}</small>}</div>
        </section>

        <section className="doc-facts">
          <div><span>{t("Xizmat turi")}</span><b>{CATEGORY_LABEL[c.category]}</b></div>
          <div><span>{t("Sana")}</span><b>{c.event ? fmtDate(c.event.date) : "—"}{c.event?.start_time ? `, ${c.event.start_time}` : ""}</b></div>
          <div><span>{t("Manzil")}</span><b>{c.event?.location || "—"}</b></div>
          <div><span>{t("Holat")}</span><b><Badge tone={CONTRACT_TONE[c.status]}>{CONTRACT_STATUS_LABEL[c.status]}</Badge></b></div>
        </section>

        <table className="doc-money">
          <tbody>
            <tr><td>{t("Xizmat narxi")}</td><td>{fmtMoney(c.price)}</td></tr>
            <tr><td>{t("PhotoMarket xizmat haqi")} ({c.commission_percent}%)</td><td>− {fmtMoney(c.platform_fee)}</td></tr>
            <tr className="total"><td>{t("Ijodkorga o'tkaziladi")}</td><td>{fmtMoney(c.creator_amount)}</td></tr>
          </tbody>
        </table>

        <ol className="doc-clauses">
          {c.terms.map((x) => <li key={x.id}><b>{x.title}.</b> {x.text}</li>)}
        </ol>

        {c.status === "cancelled" && c.cancel_fee > 0 && (
          <div className="doc-note">
            <b>{t("Bekor qilish bo'yicha ushlab qolish")}:</b> {fmtMoney(c.cancel_fee)} — {t("platformaga")} {fmtMoney(c.cancel_to_platform)}, {t("ijodkorga")} {fmtMoney(c.cancel_to_creator)}.
          </div>
        )}

        <section className="doc-signs">
          {(["client", "creator"] as const).map((side) => {
            const at = side === "client" ? c.client_signed_at : c.creator_signed_at;
            const name = side === "client" ? c.client_sign_name : c.creator_sign_name;
            const img = side === "client" ? c.client_signature : c.creator_signature;
            return (
              <div key={side} className={`sign-box ${at ? "done" : ""}`}>
                <span className="doc-label">{side === "client" ? t("Mijoz imzosi") : t("Ijodkor imzosi")}</span>
                {at ? (
                  <>
                    {img ? <img src={img} alt="" className="sign-img" /> : <div className="sign-typed">{name}</div>}
                    <div className="sign-meta"><BadgeCheck size={14} /> {name} · {fmtDateTime(at)}</div>
                    <div className="sign-meta">{t("Email kodi orqali tasdiqlangan")}</div>
                  </>
                ) : <div className="sign-empty">{t("Imzo kutilmoqda")}</div>}
              </div>
            );
          })}
        </section>

        <footer className="doc-foot">
          <QrCode size={32} />
          <div>
            <div><ShieldCheck size={13} /> {t("Hujjat xeshi (SHA-256)")}: <code>{c.doc_hash.slice(0, 32)}…</code></div>
            <div className="muted small">{t("Tekshirish")}: <a href={verifyUrl}>{`${location.host}/check/${c.number}`}</a></div>
          </div>
        </footer>
      </article>
      {sign && <SignModal c={c} defaultName={user!.name} onClose={() => setSign(false)} onDone={() => { setSign(false); reload(); }} />}
    </>
  );
}

function SignModal({ c, defaultName, onClose, onDone }: { c: ContractFull; defaultName: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState(defaultName);
  const [sig, setSig] = useState("");
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setErr(""); setBusy(true);
    try { await api.post(`/contracts/${c.id}/sign-code`); setSent(true); toast(t("Imzo kodi emailingizga yuborildi")); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const submit = async () => {
    setErr(""); setBusy(true);
    try { await api.post(`/contracts/${c.id}/sign`, { code, name, signature: sig }); toast(t("Shartnoma imzolandi")); onDone(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${t("Shartnomani imzolash")} · ${c.number}`}>
      <div className="stack">
        <p className="muted">{t("Imzolash uchun emailingizga bir martalik kod yuboramiz. Kod va imzoingiz shartnomaga yoziladi.")}</p>
        <Alert>{err}</Alert>
        {!sent ? (
          <Button size="lg" block loading={busy} onClick={send}>{t("Emailga kod yuborish")}</Button>
        ) : (
          <>
            <Field label={t("6 xonali imzo kodi")}><OtpInput value={code} onChange={setCode} autoFocus /></Field>
            <Field label={t("Ism-familiyangiz (imzo ostida chiqadi)")}><Input value={name} onChange={(e) => setName(e.target.value)} minLength={3} /></Field>
            <Field label={t("Imzo (ixtiyoriy, barmoq bilan chizing)")}><SignaturePad onChange={setSig} /></Field>
            <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> {t("Shartnoma shartlari bilan tanishdim va roziman")}</label>
            <div className="row-end">
              <Button variant="ghost" onClick={send} loading={busy}>{t("Qayta yuborish")}</Button>
              <Button disabled={!agree || code.length !== 6 || name.trim().length < 3} loading={busy} onClick={submit}><FileSignature size={16} /> {t("Imzolayman")}</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
