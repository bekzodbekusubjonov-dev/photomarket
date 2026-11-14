import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert, Button, Field, Input, PageHead, Spinner, Textarea, useToast } from "../../components/ui";
import { t } from "../../i18n";

const blank = { platform_name: "PhotoMarket", contact_email: "", contact_phone: "", telegram: "", commission_percent: "0", allow_registration: true, terms_text: "" };

export default function AdminSettings() {
  const toast = useToast();
  const [f, setF] = useState<typeof blank | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.get<Record<string, string>>("/admin/settings").then((d) => setF({
      platform_name: d.platform_name, contact_email: d.contact_email, contact_phone: d.contact_phone, telegram: d.telegram,
      commission_percent: d.commission_percent, allow_registration: d.allow_registration !== "0", terms_text: d.terms_text,
    })).catch((e) => setErr(e.message));
  }, []);
  if (!f) return err ? <Alert>{err}</Alert> : <Spinner />;
  const set = (k: keyof typeof blank, v: string | boolean) => setF({ ...f, [k]: v });
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    try { await api.put("/admin/settings", { ...f, commission_percent: Number(f.commission_percent) }); toast(t("Saqlandi")); }
    catch (er) { setErr((er as Error).message); }
  };
  return (
    <>
      <PageHead title={t("Platforma sozlamalari")} sub={t("Umumiy ma'lumotlar va qoidalar")} />
      <form className="card stack" onSubmit={save}>
        <Alert>{err}</Alert>
        <div className="grid-2">
          <Field label={t("Platforma nomi")}><Input required minLength={2} value={f.platform_name} onChange={(e) => set("platform_name", e.target.value)} /></Field>
          <Field label={t("Komissiya (%)")} hint={t("Hozircha faqat ma'lumot sifatida saqlanadi")}><Input type="number" min={0} max={50} value={f.commission_percent} onChange={(e) => set("commission_percent", e.target.value)} /></Field>
          <Field label={t("Aloqa email")}><Input type="email" value={f.contact_email} onChange={(e) => set("contact_email", e.target.value)} /></Field>
          <Field label={t("Aloqa telefon")}><Input value={f.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} /></Field>
          <Field label="Telegram"><Input value={f.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="@photomarket" /></Field>
        </div>
        <Field label={t("Foydalanish shartlari")}><Textarea rows={5} maxLength={5000} value={f.terms_text} onChange={(e) => set("terms_text", e.target.value)} /></Field>
        <label className="check"><input type="checkbox" checked={f.allow_registration} onChange={(e) => set("allow_registration", e.target.checked)} /> {t("Yangi foydalanuvchilar ro'yxatdan o'tishi mumkin")}</label>
        <div className="row-end"><Button>{t("Saqlash")}</Button></div>
      </form>
    </>
  );
}
