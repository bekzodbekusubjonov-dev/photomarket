import { useState, type FormEvent } from "react";
import { Clock, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../../api";
import { Alert, Badge, Button, Empty, Field, Input, Modal, PageHead, Spinner, Textarea, useAsync, useConfirm, useToast } from "../../components/ui";
import type { Service } from "../../types";
import { fmtMoney } from "../../utils";
import { t } from "../../i18n";

const blank = { title: "", description: "", price: "", duration_hours: "2", active: true };

export default function Services() {
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const { data, setData, loading } = useAsync(() => api.get<Service[]>("/creator/services"), []);
  const [edit, setEdit] = useState<{ id?: number; f: typeof blank } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setErr(""); setBusy(true);
    const body = { ...edit.f, price: Number(edit.f.price) || 0, duration_hours: Number(edit.f.duration_hours) || 1 };
    try {
      if (edit.id) { const s = await api.put<Service>(`/creator/services/${edit.id}`, body); setData((o) => o!.map((x) => x.id === s.id ? s : x)); }
      else { const s = await api.post<Service>("/creator/services", body); setData((o) => [...(o ?? []), s]); }
      toast(t("Saqlandi")); setEdit(null);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async (s: Service) => {
    if (!(await confirm(t("«{name}» xizmati o'chiriladi.",{name:s.title})))) return;
    await api.del(`/creator/services/${s.id}`);
    setData((o) => o!.filter((x) => x.id !== s.id));
  };

  return (
    <>
      <PageHead title={t("Xizmatlar (paketlar)")} sub={t("Aniq narxli paketlar mijozga tez qaror qilishga yordam beradi")}
        actions={<Button onClick={() => { setErr(""); setEdit({ f: blank }); }}><Plus size={18} /> {t("Xizmat qo'shish")}</Button>} />
      {loading ? <Spinner /> : data?.length ? (
        <div className="services card">
          {data.map((s) => (
            <div key={s.id} className="service">
              <div>
                <h3>{s.title} {!s.active && <Badge>{t("Yashirin")}</Badge>}</h3>
                {s.description && <p className="muted">{s.description}</p>}
                <span className="muted small"><Clock size={13} /> {s.duration_hours} {t("soat")}</span>
              </div>
              <div className="service-right">
                <b>{fmtMoney(s.price)}</b>
                <div className="row gap-s">
                  <button className="icon-btn" aria-label={t("Tahrirlash")} onClick={() => { setErr(""); setEdit({ id: s.id, f: { title: s.title, description: s.description, price: String(s.price), duration_hours: String(s.duration_hours), active: s.active } }); }}><Pencil size={17} /></button>
                  <button className="icon-btn danger" aria-label={t("O'chirish")} onClick={() => remove(s)}><Trash2 size={17} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : <Empty icon={<Package />} title={t("Xizmatlar yo'q")} text={t("Masalan: «Love story — 2 soat, 50 ta tahrirlangan surat»")} />}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t("Xizmatni tahrirlash") : t("Yangi xizmat")}>
        {edit && (
          <form onSubmit={save} className="stack">
            <Field label={t("Nomi")}><Input required minLength={2} maxLength={140} value={edit.f.title} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, title: e.target.value } })} /></Field>
            <div className="two">
              <Field label={t("Narx (so'm)")}><Input type="number" required min={0} step={50000} value={edit.f.price} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, price: e.target.value } })} /></Field>
              <Field label={t("Davomiyligi (soat)")}><Input type="number" required min={0.5} max={72} step={0.5} value={edit.f.duration_hours} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, duration_hours: e.target.value } })} /></Field>
            </div>
            <Field label={t("Nimalar kiradi")} hint={t("Suratlar soni, topshirish muddati, albom va h.k.")}><Textarea rows={4} maxLength={2000} value={edit.f.description} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, description: e.target.value } })} /></Field>
            <label className="check"><input type="checkbox" checked={edit.f.active} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, active: e.target.checked } })} /> {t("Profilda ko'rsatilsin")}</label>
            <Alert>{err}</Alert>
            <div className="row-end"><Button type="button" variant="secondary" onClick={() => setEdit(null)}>{t("Bekor")}</Button><Button type="submit" loading={busy}>{t("Saqlash")}</Button></div>
          </form>
        )}
      </Modal>
      {node}
    </>
  );
}
