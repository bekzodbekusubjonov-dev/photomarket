import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth, type TokenResponse } from "../../auth";
import { Alert, Button, Field, Input, useToast } from "../../components/ui";
import { AuthShell, OtpInput } from "./AuthShell";
import { t } from "../../i18n";

export default function Forgot() {
  const nav = useNavigate();
  const toast = useToast();
  const { setSession } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState({ a: "", b: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setStep(2);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (pw.a !== pw.b) return setErr(t("Parollar mos kelmadi"));
    setBusy(true);
    try {
      const r = await api.post<TokenResponse>("/auth/reset-password", { email, code, new_password: pw.a });
      setSession(r);
      toast(t("Parol yangilandi"));
      nav("/dashboard", { replace: true });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <AuthShell title={t("Parolni tiklash")} sub={step === 1 ? t("Emailingizni kiriting — tiklash kodi yuboramiz") : <>{t("Kod yuborildi:")} <b>{email}</b></>}>
      {step === 1 ? (
        <form onSubmit={sendCode} className="stack">
          <Field label={t("Email")}><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
          <Alert>{err}</Alert>
          <Button type="submit" size="lg" block loading={busy}>{t("Kod yuborish")}</Button>
        </form>
      ) : (
        <form onSubmit={reset} className="stack">
          <Field label={t("6 xonali kod")}><OtpInput value={code} onChange={setCode} autoFocus /></Field>
          <Field label={t("Yangi parol")} hint={t("Kamida 8 belgi, harf va raqam")}><Input type="password" required minLength={8} autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></Field>
          <Field label={t("Yangi parolni takrorlang")}><Input type="password" required minLength={8} autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></Field>
          <Alert>{err}</Alert>
          <Button type="submit" size="lg" block loading={busy}>{t("Parolni yangilash")}</Button>
          <button type="button" className="link-btn center" onClick={() => setStep(1)}>{t("Emailni o'zgartirish")}</button>
        </form>
      )}
      <p className="center muted"><Link to="/login">{t("Kirish sahifasiga qaytish")}</Link></p>
    </AuthShell>
  );
}
