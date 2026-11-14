import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { api } from "../../api";
import { useAuth, type TokenResponse } from "../../auth";
import { Alert, Button, Field, Input } from "../../components/ui";
import { AuthShell, OtpInput } from "./AuthShell";
import { t } from "../../i18n";

export default function Verify() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [email, setEmail] = useState(sp.get("email") ?? "");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState(sp.get("sent") ? t("Kod emailingizga yuborildi. «Spam» papkasini ham tekshiring.") : "");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(sp.get("sent") ? 60 : 0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6) return setErr(t("6 xonali kodni kiriting"));
    setErr("");
    setBusy(true);
    try {
      const r = await api.post<TokenResponse>("/auth/verify-email", { email, code });
      setSession(r);
      nav(r.user.role === "creator" ? "/dashboard/profile?welcome=1" : sp.get("next") || "/dashboard", { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (code.length === 6 && email) submit(); /* eslint-disable-next-line */ }, [code]);

  const resend = async () => {
    setErr("");
    try {
      await api.post("/auth/resend-code", { email });
      setInfo(t("Yangi kod yuborildi."));
      setWait(60);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <AuthShell title={t("Emailni tasdiqlang")} sub={<>{t("Kod yuborilgan manzil:")} <b>{email || "—"}</b></>}>
      <div className="verify-icon"><MailCheck size={34} /></div>
      <form onSubmit={submit} className="stack">
        {!sp.get("email") && <Field label={t("Email")}><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
        <Field label={t("6 xonali kod")}><OtpInput value={code} onChange={setCode} autoFocus /></Field>
        <Alert kind="info">{!err && info}</Alert>
        <Alert>{err}</Alert>
        <Button type="submit" size="lg" block loading={busy}>{t("Tasdiqlash")}</Button>
        <p className="center muted">
          {t("Kod kelmadimi?")}{" "}
          {wait > 0 ? <span>{wait} {t("soniyadan keyin qayta yuborish mumkin")}</span> :
            <button type="button" className="link-btn" onClick={resend} disabled={!email}>{t("Qayta yuborish")}</button>}
        </p>
        <p className="center muted small"><Link to="/register">{t("Boshqa email bilan ro'yxatdan o'tish")}</Link></p>
      </form>
    </AuthShell>
  );
}
