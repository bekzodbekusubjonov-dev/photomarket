import { useRef, useState, type FormEvent } from "react";
import { Camera } from "lucide-react";
import { api } from "../../api";
import { useAuth, type TokenResponse } from "../../auth";
import { Alert, Avatar, Button, Field, Input, PageHead, useToast } from "../../components/ui";
import type { User } from "../../types";
import { ROLE_LABEL, fmtDateTime } from "../../utils";
import { t } from "../../i18n";
import { AppLockSettings } from "../../applock";
import { InstallButton } from "../../pwa";

export default function Settings() {
  const { user, setUser, setSession } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [p, setP] = useState({ name: user!.name, phone: user!.phone ?? "" });
  const [pw, setPw] = useState({ old: "", a: "", b: "" });
  const [err, setErr] = useState({ p: "", pw: "" });
  const [busy, setBusy] = useState("");

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("p"); setErr({ ...err, p: "" });
    try { setUser(await api.put<User>("/auth/me", { name: p.name, phone: p.phone || null })); toast(t("Ma'lumotlar saqlandi")); }
    catch (e) { setErr({ ...err, p: (e as Error).message }); } finally { setBusy(""); }
  };
  const upload = async (f?: File) => {
    if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    setBusy("a");
    try { setUser(await api.upload<User>("/auth/me/avatar", fd)); toast(t("Rasm yangilandi")); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(""); }
  };
  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    setErr({ ...err, pw: "" });
    if (pw.a !== pw.b) return setErr({ ...err, pw: t("Yangi parollar mos kelmadi") });
    setBusy("pw");
    try {
      setSession(await api.post<TokenResponse>("/auth/me/password", { old_password: pw.old, new_password: pw.a }));
      setPw({ old: "", a: "", b: "" });
      toast(t("Parol o'zgartirildi. Boshqa qurilmalardagi sessiyalar yopildi"));
    } catch (e) { setErr({ ...err, pw: (e as Error).message }); } finally { setBusy(""); }
  };

  return (
    <>
      <PageHead title={t("Sozlamalar")} sub={`${ROLE_LABEL[user!.role]} · ${user!.email}`} />
      <div className="dash-grid">
        <section className="card">
          <h2>{t("Shaxsiy ma'lumotlar")}</h2>
          <div className="avatar-edit">
            <Avatar src={user!.avatar_url} name={user!.name} size={84} />
            <Button variant="secondary" loading={busy === "a"} onClick={() => fileRef.current?.click()}><Camera size={17} /> {t("Rasmni o'zgartirish")}</Button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </div>
          <form onSubmit={saveProfile} className="stack">
            <Field label={t("Ism")}><Input required minLength={2} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
            <Field label={t("Telefon")}><Input type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} placeholder="+998 90 123 45 67" /></Field>
            <Field label={t("Email")} hint={t("Email o'zgartirilmaydi")}><Input value={user!.email} disabled /></Field>
            <Alert>{err.p}</Alert>
            <Button type="submit" loading={busy === "p"}>{t("Saqlash")}</Button>
          </form>
        </section>
        <AppLockSettings />
        <section className="card">
          <h2>{t("Ilovani o'rnatish")}</h2>
          <p className="muted small">{t("PhotoMarket ni telefon yoki kompyuteringizga ilova sifatida o'rnating — bosh ekrandan bir bosishda ochiladi.")}</p>
          <InstallButton variant="primary" />
        </section>
        <section className="card">
          <h2>{t("Parolni o'zgartirish")}</h2>
          <form onSubmit={changePw} className="stack">
            <Field label={t("Joriy parol")}><Input type="password" required autoComplete="current-password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} /></Field>
            <Field label={t("Yangi parol")} hint={t("Kamida 8 belgi, harf va raqam")}><Input type="password" required minLength={8} autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></Field>
            <Field label={t("Yangi parolni takrorlang")}><Input type="password" required minLength={8} autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></Field>
            <Alert>{err.pw}</Alert>
            <Button type="submit" loading={busy === "pw"}>{t("Parolni yangilash")}</Button>
          </form>
          {user!.last_login_at && <p className="muted small mt">{t("Oxirgi kirish:")} {fmtDateTime(user!.last_login_at)}</p>}
        </section>
      </div>
    </>
  );
}
