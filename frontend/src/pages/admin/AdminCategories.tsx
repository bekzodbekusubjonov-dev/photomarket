import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../../api";
import { Alert, Badge, Button, Empty, Field, Input, Modal, PageHead, Spinner, useAsync, useConfirm, useToast } from "../../components/ui";
import { t } from "../../i18n";

interface Cat { id: number; name_uz: string; name_ru: string; name_en: string; image_url: string; position: number; active: boolean }
const blank = { name_uz: "", name_ru: "", name_en: "", image_url: "", position: 0, active: true };

export default function AdminCategories() {
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const { data, loading, reload } = useAsync(() => api.get<Cat[]>("/admin/categories"), []);
  const [edit, setEdit] = useState<{ id?: number; f: typeof blank } | null>(null);
  const [err, setErr] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    try {
      edit!.id ? await api.put(`/admin/categories/${edit!.id}`, edit!.f) : await api.post("/admin/categories", edit!.f);
      toast(t("Saqlandi")); setEdit(null); reload();
    } catch (er) { setErr((er as Error).message); }
  };
  const del = async (c: Cat) => {
    if (!(await confirm(t("«{name}» kategoriyasi o'chiriladi.", { name: c.name_uz })))) return;
    await api.del(`/admin/categories/${c.id}`); toast(t("O'chirildi")); reload();
  };
  const f = edit?.f;
  const set = (k: keyof typeof blank, v: string | number | boolean) => setEdit({ ...edit!, f: { ...edit!.f, [k]: v } });
  return (
    <>
      <PageHead title={t("Kategoriyalar")} sub={t("Xizmat yo'nalishlari — uch tilda nomlanadi")}
        actions={<Button onClick={() => { setErr(""); setEdit({ f: { ...blank, position: (data?.length ?? 0) } }); }}><Plus size={16} /> {t("Yangi kategoriya")}</Button>} />
      {loading && !data ? <Spinner /> : data?.length ? (
        <div className="table-wrap card flush">
          <table className="table">
            <thead><tr><th>#</th><th>O‘zbekcha</th><th>Русский</th><th>English</th><th>{t("Holat")}</th><th /></tr></thead>
            <tbody>{data.map((c) => (
              <tr key={c.id}>
                <td>{c.position}</td><td><b>{c.name_uz}</b></td><td>{c.name_ru}</td><td>{c.name_en}</td>
                <td>{c.active ? <Badge tone="green">{t("Faol")}</Badge> : <Badge>{t("Yashirin")}</Badge>}</td>
                <td className="nowrap">
                  <Button size="sm" variant="ghost" onClick={() => { setErr(""); setEdit({ id: c.id, f: { name_uz: c.name_uz, name_ru: c.name_ru, name_en: c.name_en, image_url: c.image_url, position: c.position, active: c.active } }); }}><Pencil size={15} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(c)}><Trash2 size={15} /></Button>
                </td>
              </tr>))}
            </tbody>
          </table>
        </div>
      ) : <Empty title={t("Kategoriyalar yo'q")} />}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t("Kategoriyani tahrirlash") : t("Yangi kategoriya")}>
        {f && (
          <form onSubmit={save} className="stack">
            <Alert>{err}</Alert>
            <Field label="O‘zbekcha"><Input required minLength={2} value={f.name_uz} onChange={(e) => set("name_uz", e.target.value)} /></Field>
            <Field label="Русский"><Input value={f.name_ru} onChange={(e) => set("name_ru", e.target.value)} /></Field>
            <Field label="English"><Input value={f.name_en} onChange={(e) => set("name_en", e.target.value)} /></Field>
            <div className="grid-2">
              <Field label={t("Tartib raqami")}><Input type="number" min={0} value={f.position} onChange={(e) => set("position", Number(e.target.value))} /></Field>
              <Field label={t("Rasm havolasi")} hint={t("Ixtiyoriy")}><Input value={f.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://" /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> {t("Saytda ko'rsatish")}</label>
            <div className="row-end"><Button variant="secondary" type="button" onClick={() => setEdit(null)}>{t("Bekor qilish")}</Button><Button>{t("Saqlash")}</Button></div>
          </form>
        )}
      </Modal>
      {node}
    </>
  );
}
