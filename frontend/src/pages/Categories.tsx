import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api } from "../api";
import { Img, PageHead, Spinner } from "../components/ui";
import { useSite } from "../site";
import { CATEGORIES } from "../photos";
import { t } from "../i18n";

interface Cat { id: number; slug: string; name: string; name_uz: string; image_url: string; creators: number }

export default function Categories() {
  const site = useSite();
  const [cats, setCats] = useState<Cat[] | null>(null);
  useEffect(() => { api.get<Cat[]>("/categories").then(setCats).catch(() => setCats([])); }, []);
  const slotFor = (uz: string) => CATEGORIES.find((c) => c.name === uz)?.slot;
  return (
    <div className="container page">
      <PageHead title={t("Kategoriyalar")} sub={t("Qanday syomka kerak? Yo'nalishni tanlang")} />
      {!cats ? <Spinner /> : (
        <div className="cat-photos cat-page">
          {cats.map((c) => (
            <Link key={c.id} to={`/creators?specialty=${encodeURIComponent(c.name_uz)}`} className="cat-photo">
              <Img src={c.image_url || (site && slotFor(c.name_uz) ? site.images[slotFor(c.name_uz)!] : "")} alt={c.name} />
              <div className="cat-label"><div><b>{c.name}</b><span>{t("{n} ta ijodkor", { n: c.creators })}</span></div><ArrowRight size={16} /></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
