import { useEffect, useState } from "react";
import { api, mediaUrl } from "../../api";
import { Alert, Button, Field, Input, PageHead, Spinner, Textarea, useToast } from "../../components/ui";
import { t } from "../../i18n";

const blank = { platform_name: "PhotoMarket", contact_email: "", contact_phone: "", telegram: "", commission_percent: "0", allow_registration: true, terms_text: "", cancel_free_days: "3", cancel_fee_percent: "30", cancel_platform_share: "40", pay_card_number: "", pay_card_holder: "", logo_url: "" };

export default function AdminSettings() {
  const toast = useToast();
  const [f, setF] = useState<typeof blank | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.get<Record<string, string>>("/admin/settings").then((d) => setF({
      platform_name: d.platform_name, contact_email: d.contact_email, contact_phone: d.contact_phone, telegram: d.telegram,
      commission_percent: d.commission_percent, allow_registration: d.allow_registration !== "0", terms_text: d.terms_text,
      cancel_free_days: d.cancel_free_days ?? "3", cancel_fee_percent: d.cancel_fee_percent ?? "30", cancel_platform_share: d.cancel_platform_share ?? "40",
      pay_card_number: d.pay_card_number ?? "", pay_card_holder: d.pay_card_holder ?? "", logo_url: d.logo_url ?? "",
    })).catch((e) => setErr(e.message));
  }, []);
  if (!f) return err ? <Alert>{err}</Alert> : <Spinner />;
  const set = (k: keyof typeof blank, v: string | boolean) => setF({ ...f, [k]: v });
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    try { await api.put("/admin/settings", { ...f, commission_percent: Number(f.commission_percent), cancel_free_days: Number(f.cancel_free_days), cancel_fee_percent: Number(f.cancel_fee_percent), cancel_platform_share: Number(f.cancel_platform_share) }); toast(t("Saqlandi")); }
    catch (er) { setErr((er as Error).message); }
  };
  return (
    <>
      <PageHead title={t("Platforma sozlamalari")} sub={t("Umumiy ma'lumotlar va qoidalar")} />
      <form className="card stack" onSubmit={save}>
        <Alert>{err}</Alert>
        <div className="grid-2">
          <Field label={t("Platforma nomi")}><Input required minLength={2} value={f.platform_name} onChange={(e) => set("platform_name", e.target.value)} /></Field>
          <Field label={t("Komissiya (%)")} hint={t("Har bir shartnomada platforma ulushi")}><Input type="number" min={0} max={50} value={f.commission_percent} onChange={(e) => set("commission_percent", e.target.value)} /></Field>
          <Field label={t("Aloqa email")}><Input type="email" value={f.contact_email} onChange={(e) => set("contact_email", e.target.value)} /></Field>
          <Field label={t("Aloqa telefon")}><Input value={f.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} /></Field>
          <Field label="Telegram"><Input value={f.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="@photomarket" /></Field>
        </div>
        <h3>{t("Bekor qilish qoidalari (shartnomaga yoziladi)")}</h3>
        <div className="grid-2">
          <Field label={t("Bepul bekor qilish (voqeagacha necha kun)")}><Input type="number" min={0} max={60} value={f.cancel_free_days} onChange={(e) => set("cancel_free_days", e.target.value)} /></Field>
          <Field label={t("Kech bekor qilsa ushlab qolinadi (%)")}><Input type="number" min={0} max={100} value={f.cancel_fee_percent} onChange={(e) => set("cancel_fee_percent", e.target.value)} /></Field>
          <Field label={t("Ushlab qolingan summadan platforma ulushi (%)")} hint={t("Qolgani ijodkorga")}><Input type="number" min={0} max={100} value={f.cancel_platform_share} onChange={(e) => set("cancel_platform_share", e.target.value)} /></Field>
        </div>
        <h3>{t("To'lov rekvizitlari")}</h3>
        <div className="grid-2">
          <Field label={t("Platforma kartasi raqami")} hint={t("Mijozlarga ko'rsatiladi")}><Input inputMode="numeric" value={f.pay_card_number} onChange={(e) => set("pay_card_number", e.target.value)} placeholder="8600 0000 0000 0000" /></Field>
          <Field label={t("Karta egasi")}><Input value={f.pay_card_holder} onChange={(e) => set("pay_card_holder", e.target.value)} /></Field>
        </div>
        <Field label={t("Platforma logotipi")} hint={t("Bo'sh qolsa standart logotip ishlatiladi")}>
          <div className="logo-set">
            {f.logo_url && <img src={mediaUrl(f.logo_url)} alt="" />}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (e) => {
              const fl = e.target.files?.[0]; if (!fl) return;
              const fd = new FormData(); fd.append("file", fl);
              try { const r = await api.upload<{ url: string }>("/admin/upload?folder=branding", fd); set("logo_url", r.url); } catch (er) { setErr((er as Error).message); }
            }} />
          </div>
        </Field>
        <Field label={t("Foydalanish shartlari")}><Textarea rows={5} maxLength={5000} value={f.terms_text} onChange={(e) => set("terms_text", e.target.value)} /></Field>
        <label className="check"><input type="checkbox" checked={f.allow_registration} onChange={(e) => set("allow_registration", e.target.checked)} /> {t("Yangi foydalanuvchilar ro'yxatdan o'tishi mumkin")}</label>
        <div className="row-end"><Button>{t("Saqlash")}</Button></div>
      </form>
    </>
  );
}
