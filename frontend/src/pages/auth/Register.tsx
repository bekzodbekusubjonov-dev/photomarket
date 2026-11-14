import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Camera, User as UserIcon } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Alert, Button, Field, Input } from "../../components/ui";
import { cx } from "../../utils";
import { AuthShell } from "./AuthShell";
import { t } from "../../i18n";

export default function Register() {
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", password2: "",
    role: sp.get("role") === "creator" ? "creator" : "client" });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (f.password !== f.password2) return setErr(t("Parollar mos kelmadi"));
    if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) return setErr(t("Parolda kamida bitta harf va bitta raqam bo'lsin"));
    setBusy(true);
    try {
      await api.post("/auth/register", { name: f.name, email: f.email, phone: f.phone || null, password: f.password, role: f.role });
      nav(`/verify?email=${encodeURIComponent(f.email.trim().toLowerCase())}&sent=1`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t("Ro'yxatdan o'tish")} sub={t("Emailingizga tasdiqlash kodi yuboriladi")} slot="auth_register">
      <form onSubmit={submit} className="stack">
        <div className="role-pick">
          <button type="button" className={cx(f.role === "client" && "active")} onClick={() => setF({ ...f, role: "client" })}>
            <UserIcon size={22} /><b>{t("Mijozman")}</b><span>{t("Fotograf/videograf qidiryapman")}</span>
          </button>
          <button type="button" className={cx(f.role === "creator" && "active")} onClick={() => setF({ ...f, role: "creator" })}>
            <Camera size={22} /><b>{t("Ijodkorman")}</b><span>{t("Buyurtma qabul qilmoqchiman")}</span>
          </button>
        </div>
        <Field label={f.role === "creator" ? t("Ism yoki studiya nomi") : t("Ism familiya")}>
          <Input required minLength={2} maxLength={120} autoComplete="name" value={f.name} onChange={set("name")} />
        </Field>
        <div className="two">
          <Field label={t("Email")}><Input type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></Field>
          <Field label={t("Telefon")} hint={t("Ixtiyoriy")}><Input type="tel" placeholder="+998 90 123 45 67" autoComplete="tel" value={f.phone} onChange={set("phone")} /></Field>
        </div>
        <div className="two">
          <Field label={t("Parol")} hint={t("Kamida 8 belgi, harf va raqam")}><Input type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set("password")} /></Field>
          <Field label={t("Parolni takrorlang")}><Input type="password" required minLength={8} autoComplete="new-password" value={f.password2} onChange={set("password2")} /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required /> {t("Foydalanish shartlari va maxfiylik siyosatiga roziman")}</label>
        <Alert>{err}</Alert>
        <Button type="submit" size="lg" block loading={busy} disabled={!agree}>{t("Davom etish")}</Button>
        <p className="center muted">{t("Hisobingiz bormi?")} <Link to="/login">{t("Kirish")}</Link></p>
      </form>
    </AuthShell>
  );
}
