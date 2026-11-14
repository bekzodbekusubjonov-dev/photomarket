import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Camera, ExternalLink, ImagePlus } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Alert, Avatar, Button, Field, Img, Input, PageHead, Select, Spinner, Textarea, useToast } from "../../components/ui";
import type { CreatorFull, User } from "../../types";
import { cx } from "../../utils";
import { t } from "../../i18n";

const CITIES = ["Toshkent", "Samarqand", "Buxoro", "Andijon", "Farg'ona", "Namangan", "Qarshi", "Navoiy", "Jizzax",
  "Guliston", "Termiz", "Urganch", "Nukus", "Xiva", "Qo'qon", "Chirchiq"];

export default function ProfileEdit() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [c, setC] = useState<CreatorFull | null>(null);
  const [specs, setSpecs] = useState<string[]>([]);
  const [f, setF] = useState({ display_name: "", category: "photographer", city: "Toshkent", price_from: "0", bio: "",
    experience_years: "0", instagram: "", telegram: "", active: true, specialties: [] as string[] });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const avRef = useRef<HTMLInputElement>(null);
  const covRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<CreatorFull>("/creator/profile").then((d) => {
      setC(d);
      setF({ display_name: d.display_name, category: d.category, city: d.city, price_from: String(d.price_from), bio: d.bio,
        experience_years: String(d.experience_years), instagram: d.instagram, telegram: d.telegram, active: d.active, specialties: d.specialties });
    });
    api.get<{ specialties: string[] }>("/creators/meta").then((m) => setSpecs(m.specialties)).catch(() => {});
  }, []);

  const toggleSpec = (s: string) => setF((o) => ({ ...o, specialties: o.specialties.includes(s) ? o.specialties.filter((x) => x !== s) : [...o.specialties, s].slice(0, 12) }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy("save");
    try {
      const d = await api.put<CreatorFull>("/creator/profile", { ...f, price_from: Number(f.price_from) || 0, experience_years: Number(f.experience_years) || 0 });
      setC((o) => o && { ...o, ...d });
      toast(t("Profil saqlandi"));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  };
  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file); setBusy("av");
    try { setUser(await api.upload<User>("/auth/me/avatar", fd)); toast(t("Rasm yangilandi")); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(""); }
  };
  const uploadCover = async (file?: File) => {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file); setBusy("cov");
    try { const r = await api.upload<{ cover_url: string }>("/creator/cover", fd); setC((o) => o && { ...o, own_cover_url: r.cover_url }); toast(t("Muqova yangilandi")); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(""); }
  };

  if (!c) return <Spinner />;
  return (
    <>
      <PageHead title={t("Profilim")} sub={t("Mijozlar katalogda va profil sahifangizda ko'radigan ma'lumotlar")}
        actions={<Link className="btn btn-secondary btn-md" to={`/creators/${c.id}`}><ExternalLink size={16} /> {t("Ko'rish")}</Link>} />
      {sp.get("welcome") && <Alert kind="success">{t("Xush kelibsiz! Profilingizni to'ldiring, portfolio va xizmatlarni qo'shing — shundan so'ng mijozlar sizga buyurtma bera oladi.")}</Alert>}
      <section className="card cover-edit">
        <div className="cover-preview"><Img src={c.own_cover_url || c.cover_url} alt="Muqova" />
          <Button variant="secondary" size="sm" loading={busy === "cov"} onClick={() => covRef.current?.click()}><ImagePlus size={16} /> {t("Muqova rasmi")}</Button></div>
        <div className="avatar-edit">
          <Avatar src={user!.avatar_url} name={f.display_name || user!.name} size={84} />
          <Button variant="secondary" size="sm" loading={busy === "av"} onClick={() => avRef.current?.click()}><Camera size={16} /> {t("Profil rasmi")}</Button>
        </div>
        <input ref={avRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => uploadAvatar(e.target.files?.[0])} />
        <input ref={covRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => uploadCover(e.target.files?.[0])} />
      </section>
      <form className="card form-grid" onSubmit={save}>
        <Field label={t("Ko'rinadigan ism / studiya nomi")}><Input required minLength={2} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
        <Field label={t("Yo'nalish")}>
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="photographer">{t("Fotograf")}</option><option value="videographer">{t("Videograf")}</option><option value="both">{t("Foto + video")}</option>
          </Select>
        </Field>
        <Field label={t("Shahar")}>
          <Input list="cities" required value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          <datalist id="cities">{CITIES.map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <Field label={t("Tajriba (yil)")}><Input type="number" min={0} max={60} value={f.experience_years} onChange={(e) => setF({ ...f, experience_years: e.target.value })} /></Field>
        <Field label={t("Boshlang'ich narx (so'm)")} hint={t("Xizmat qo'shsangiz eng arzoni avtomatik qo'yiladi")}><Input type="number" min={0} step={50000} value={f.price_from} onChange={(e) => setF({ ...f, price_from: e.target.value })} /></Field>
        <div className="two">
          <Field label={t("Instagram")}><Input placeholder={t("username")} value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} /></Field>
          <Field label={t("Telegram")}><Input placeholder={t("username")} value={f.telegram} onChange={(e) => setF({ ...f, telegram: e.target.value })} /></Field>
        </div>
        <Field label={t("O'zingiz haqingizda")} className="span-2" hint={`${f.bio.length}/3000 · Uslubingiz, texnikangiz, topshirish muddati`}>
          <Textarea rows={5} maxLength={3000} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
        </Field>
        <div className="span-2">
          <span className="field-label">{t("Yo'nalishlar (ko'pi bilan 12)")}</span>
          <div className="chips selectable">
            {specs.map((s) => <button type="button" key={s} className={cx("chip", f.specialties.includes(s) && "on")} onClick={() => toggleSpec(s)}>{t(s)}</button>)}
          </div>
        </div>
        <label className="check span-2"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> {t("Profil faol (katalogda ko'rinadi va buyurtma qabul qiladi)")}</label>
        <div className="span-2"><Alert>{err}</Alert></div>
        <div className="span-2 row-end"><Button type="submit" loading={busy === "save"}>{t("Saqlash")}</Button></div>
      </form>
    </>
  );
}
