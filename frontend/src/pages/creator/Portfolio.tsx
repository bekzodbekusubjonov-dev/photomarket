import { useRef, useState } from "react";
import { ImagePlus, Images, Trash2 } from "lucide-react";
import { api } from "../../api";
import { Button, Empty, Img, Input, PageHead, Spinner, useAsync, useConfirm, useToast } from "../../components/ui";
import type { PortfolioItem } from "../../types";
import { t } from "../../i18n";

export default function Portfolio() {
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const { data, setData, loading } = useAsync(() => api.get<PortfolioItem[]>("/creator/portfolio"), []);
  const [uploading, setUploading] = useState({ done: 0, total: 0 });
  const ref = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 20);
    setUploading({ done: 0, total: list.length });
    for (const f of list) {
      const fd = new FormData(); fd.append("file", f); fd.append("title", "");
      try { const it = await api.upload<PortfolioItem>("/creator/portfolio", fd); setData((o) => [...(o ?? []), it]); }
      catch (e) { toast(`${f.name}: ${(e as Error).message}`, "error"); }
      setUploading((u) => ({ ...u, done: u.done + 1 }));
    }
    setUploading({ done: 0, total: 0 });
    if (ref.current) ref.current.value = "";
  };
  const saveTitle = async (it: PortfolioItem, title: string) => {
    if (title === it.title) return;
    try { const r = await api.put<PortfolioItem>(`/creator/portfolio/${it.id}`, { title, category: it.category }); setData((o) => o!.map((x) => x.id === r.id ? r : x)); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  const remove = async (it: PortfolioItem) => {
    if (!(await confirm(t("Rasm portfoliodan o'chiriladi.")))) return;
    await api.del(`/creator/portfolio/${it.id}`);
    setData((o) => o!.filter((x) => x.id !== it.id));
    toast(t("O'chirildi"));
  };

  return (
    <>
      <PageHead title={t("Portfolio")} sub={t("{n} / 60 rasm · Eng yaxshi ishlaringizni joylang. Birinchi rasm katalogda muqova bo'ladi.",{n:data?.length ?? 0})}
        actions={<Button loading={uploading.total > 0} onClick={() => ref.current?.click()}><ImagePlus size={18} /> {t("Rasm yuklash")}</Button>} />
      <input ref={ref} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files)} />
      {uploading.total > 0 && <div className="alert alert-info">{t("Yuklanmoqda:")} {uploading.done} / {uploading.total}</div>}
      {loading ? <Spinner /> : data && data.length ? (
        <div className="portfolio-grid">
          {data.map((it) => (
            <div key={it.id} className="pf-item">
              <Img src={it.image_url} alt={it.title} />
              <div className="pf-bar">
                <Input defaultValue={it.title} placeholder={t("Sarlavha...")} onBlur={(e) => saveTitle(it, e.target.value)} />
                <button className="icon-btn danger" onClick={() => remove(it)} aria-label={t("O'chirish")}><Trash2 size={17} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dropzone" onClick={() => ref.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}>
          <Empty icon={<Images />} title={t("Portfolio bo'sh")} text={t("Rasmlarni shu yerga tashlang yoki bosing (JPG, PNG, WEBP · 8 MB gacha)")} />
        </div>
      )}
      {node}
    </>
  );
}
