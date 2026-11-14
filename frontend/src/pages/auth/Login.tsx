import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth, type TokenResponse } from "../../auth";
import { Alert, Button, Field, Input } from "../../components/ui";
import { AuthShell } from "./AuthShell";
import { t } from "../../i18n";

export default function Login() {
  const { user, setSession } = useAuth();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const next = sp.get("next") || "/dashboard";
  if (user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await api.post<TokenResponse>("/auth/login", f);
      setSession(r);
      nav(next, { replace: true });
    } catch (e) {
      const m = (e as Error).message;
      if (m === "EMAIL_NOT_VERIFIED") nav(`/verify?email=${encodeURIComponent(f.email)}&sent=1&next=${encodeURIComponent(next)}`);
      else setErr(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t("Tizimga kirish")} sub={t("Hisobingizga kiring va buyurtmalaringizni boshqaring")}>
      <form onSubmit={submit} className="stack">
        <Field label={t("Email")}><Input type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label={t("Parol")} hint={<Link to="/forgot-password">{t("Parolni unutdingizmi?")}</Link>}>
          <Input type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        <Alert>{err}</Alert>
        <Button type="submit" size="lg" block loading={busy}>{t("Kirish")}</Button>
        <p className="center muted">{t("Hisobingiz yo'qmi?")} <Link to="/register">{t("Ro'yxatdan o'ting")}</Link></p>
      </form>
    </AuthShell>
  );
}
