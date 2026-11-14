import { useState } from "react";
import { Eye, MousePointerClick, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { api, mediaUrl } from "../../api";
import { Alert, Badge, Button, Empty, Field, Input, Modal, PageHead, Select, Spinner, Textarea, useAsync, useConfirm, useToast } from "../../components/ui";
import type { AdItem } from "../../types";
import { t } from "../../i18n";

const PLACE: Record<string, string> = { home: "Bosh sahifa", dashboard: "Kabinet", creators: "Ijodkorlar ro'yxati" };
const blank = { title: "", text: "", image_url: "", link_url: "", advertiser: "", placement: "home", active: true, starts_on: "", ends_on: "", position: 0 };

export default function AdminAds() {
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const { data, loading, reload } = useAsync(() => api.get<AdItem[]>("/admin/ads"), []);
  const [edit, setEdit] = useState<(typeof blank & { id?: number }) | null>(null);
  const del = async (a: AdItem) => { if (await confirm(`${t("E'lonni o'chirasizmi?")} ${a.title}`)) { await api.del(`/admin/ads/${a.id}`); reload(); } };
  const toggle = async (a: AdItem) => {
    try { await api.put(`/admin/ads/${a.id}`, { title: a.title, text: a.text, image_url: a.image_url, link_url: a.link_url, advertiser: a.advertiser, placement: a.placement, active: !a.active, starts_on: a.starts_on || null, ends_on: a.ends_on || null, position: a.position ?? 0 }); reload(); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <>
      <PageHead title={t("E'lon va reklamalar")} sub={t("Bosh sahifa, kabinet va ijodkorlar ro'yxatida chiqadigan bannerlar")}
        actions={<Button onClick={() => setEdit({ ...blank })}><Plus size={16} /> {t("Yangi e'lon")}</Button>} />
      {loading && !data ? <Spinner /> : data?.length ? (
        <div className="ads-admin">
          {data.map((a) => (
            <div key={a.id} className="card ad-admin-row">
              {a.image_url ? <img src={mediaUrl(a.image_url)} alt="" /> : <div className="ad-noimg" />}
              <div className="grow">
                <b>{a.title}</b> <Badge tone={a.active ? "green" : "neutral"}>{a.active ? t("Faol") : t("O'chiq")}</Badge>
                <div className="muted small">{t(PLACE[a.placement])} · {a.advertiser || "—"}</div>
                <div className="muted small"><Eye size={12} /> {a.views ?? 0} · <MousePointerClick size={12} /> {a.clicks ?? 0} · CTR {a.ctr ?? 0}%</div>
              </div>
              <div className="row-actions">
                <Button size="sm" variant="secondary" onClick={() => toggle(a)}>{a.active ? t("O'chirish") : t("Yoqish")}</Button>
                <Button size="sm" variant="ghost" onClick={() => setEdit({ ...blank, ...a, text: a.text, starts_on: a.starts_on ?? "", ends_on: a.ends_on ?? "", position: a.position ?? 0, active: !!a.active })} aria-label={t("Tahrirlash")}><Pencil size={15} /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(a)} aria-label={t("O'chirish")}><Trash2 size={15} /></Button>
              </div>
            </div>
          ))}
        </div>
      ) : <Empty title={t("E'lonlar yo'q")} text={t("Birinchi e'lonni qo'shing.")} />}
      {node}
      {edit && <AdForm init={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function AdForm({ init, onClose, onDone }: { init: typeof blank & { id?: number }; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(init);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });
  const upload = async (fl?: File) => {
    if (!fl) return; const fd = new FormData(); fd.append("file", fl);
    try { set("image_url", (await api.upload<{ url: string }>("/admin/upload?folder=ads", fd)).url); } catch (e) { setErr((e as Error).message); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const body = { title: f.title, text: f.text, image_url: f.image_url, link_url: f.link_url, advertiser: f.advertiser, placement: f.placement, active: f.active, starts_on: f.starts_on || null, ends_on: f.ends_on || null, position: Number(f.position) };
    try { f.id ? await api.put(`/admin/ads/${f.id}`, body) : await api.post("/admin/ads", body); toast(t("Saqlandi")); onDone(); }
    catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={f.id ? t("E'lonni tahrirlash") : t("Yangi e'lon")}>
      <form className="stack" onSubmit={submit}>
        <Alert>{err}</Alert>
        <Field label={t("Sarlavha")}><Input required minLength={2} maxLength={140} value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label={t("Matn")}><Textarea rows={2} maxLength={400} value={f.text} onChange={(e) => set("text", e.target.value)} /></Field>
        <Field label={t("Rasm")}>
          <div className="logo-set">{f.image_url && <img src={mediaUrl(f.image_url)} alt="" />}<label className="btn btn-secondary btn-sm"><Upload size={14} /> {t("Yuklash")}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload(e.target.files?.[0])} /></label></div>
        </Field>
        <div className="grid-2">
          <Field label={t("Havola")}><Input placeholder="https://..." value={f.link_url} onChange={(e) => set("link_url", e.target.value)} /></Field>
          <Field label={t("Reklama beruvchi")}><Input value={f.advertiser} onChange={(e) => set("advertiser", e.target.value)} /></Field>
          <Field label={t("Joylashuv")}><Select value={f.placement} onChange={(e) => set("placement", e.target.value)}>{Object.entries(PLACE).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</Select></Field>
          <Field label={t("Tartib raqami")}><Input type="number" min={0} max={999} value={f.position} onChange={(e) => set("position", e.target.value)} /></Field>
          <Field label={t("Boshlanish sanasi")}><Input type="date" value={f.starts_on} onChange={(e) => set("starts_on", e.target.value)} /></Field>
          <Field label={t("Tugash sanasi")}><Input type="date" value={f.ends_on} onChange={(e) => set("ends_on", e.target.value)} /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> {t("Faol")}</label>
        <div className="row-end"><Button variant="secondary" type="button" onClick={onClose}>{t("Bekor qilish")}</Button><Button loading={busy}>{t("Saqlash")}</Button></div>
      </form>
    </Modal>
  );
}
