import { DateField } from "../components/ui";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, CalendarCheck, Camera, CheckCircle2, MapPin, MessageCircle, Quote, Search, ShieldCheck,
  Star, Users,
} from "lucide-react";
import { api } from "../api";
import { CreatorCard, CreatorCardSkeleton } from "../components/CreatorCard";
import { Avatar, Img, LinkButton, Select, Stars } from "../components/ui";
import { CATEGORIES } from "../photos";
import { useSite } from "../site";
import type { CreatorCard as C, Paged } from "../types";
import { todayISO } from "../utils";
import { t } from "../i18n";

import { AdSlot } from "../components/Ads";

export default function Home() {
  const nav = useNavigate();
  const site = useSite();
  const img = site?.images ?? {};
  const st = site?.stats;
  const [cities, setCities] = useState<string[]>([]);
  const [top, setTop] = useState<C[] | null>(null);
  const [q, setQ] = useState({ category: "", city: "", date: "" });

  useEffect(() => {
    document.title = t("PhotoMarket — fotograf va videograf buyurtma qilish");
    api.get<{ cities: string[] }>("/creators/meta").then((m) => setCities(m.cities)).catch(() => {});
    api.get<Paged<C>>("/creators", { size: 8 }).then((r) => setTop(r.items)).catch(() => setTop([]));
  }, []);

  const search = (e: FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.category) p.set("category", q.category);
    if (q.city) p.set("city", q.city);
    if (q.date) p.set("available_on", q.date);
    nav(`/creators?${p}`);
  };

  return (
    <>
      <section className="hero hero-grad">
        <div className="container hero-center">
          <span className="eyebrow-pill"><Camera size={14} /> {t("Fotograf · Videograf · Bir joyda")}</span>
          <h1>{t("Muhim lahzangizni")} <em>{t("mukammal")}</em> {t("kadrlarda saqlang")}</h1>
          <p className="lead">{t("Portfoliolarni solishtiring, bo'sh sanalarni ko'ring, narxni bilib oling va bir necha daqiqada onlayn buyurtma bering.")}</p>
          <form className="search-bar" onSubmit={search}>
            <label className="sb-field">
              <span><Camera size={13} /> {t("Kim kerak")}</span>
              <Select value={q.category} onChange={(e) => setQ({ ...q, category: e.target.value })}>
                <option value="">{t("Fotograf yoki videograf")}</option>
                <option value="photographer">{t("Fotograf")}</option>
                <option value="videographer">{t("Videograf")}</option>
              </Select>
            </label>
            <label className="sb-field">
              <span><MapPin size={13} /> {t("Shahar")}</span>
              <Select value={q.city} onChange={(e) => setQ({ ...q, city: e.target.value })}>
                <option value="">{t("Barcha shaharlar")}</option>
                {cities.map((c) => <option key={c} value={c}>{t(c)}</option>)}
              </Select>
            </label>
            <label className="sb-field">
              <span><CalendarCheck size={13} /> {t("Sana")}</span>
              <DateField min={todayISO()} value={q.date} onChange={(e) => setQ({ ...q, date: e.target.value })} />
            </label>
            <button className="btn btn-primary btn-lg" type="submit"><Search size={18} /> {t("Qidirish")}</button>
          </form>
          <div className="hero-trust">
            <span><ShieldCheck size={16} /> {t("Email bilan tasdiqlangan hisoblar")}</span>
            <span><BadgeCheck size={16} /> {t("Admin tekshirgan ijodkorlar")}</span>
            <span><CheckCircle2 size={16} /> {t("Buyurtma — shartnoma va chek bilan")}</span>
          </div>
        </div>
        <div className="container">
          <div className="hero-photos" aria-hidden>
            <div><Img src={img.cat_wedding} alt="To'y" /></div>
            <div><Img src={img.hero_main} alt="Kelin" /></div>
            <div><Img src={img.hero_side} alt="Fotograf" /></div>
            <div><Img src={img.hero_small} alt="Oilaviy" /></div>
            <div><Img src={img.cat_portrait} alt="Portret" /></div>
          </div>
        </div>
      </section>
      <div className="container"><AdSlot placement="home" /></div>

      <section className="container">
        <div className="stats-strip">
          <div><Camera /><b>{st?.creators ?? "—"}</b><span>{t("faol ijodkor")}</span></div>
          <div><MapPin /><b>{st?.cities ?? "—"}</b><span>{t("shahar")}</span></div>
          <div><Users /><b>{st?.completed ?? "—"}</b><span>{t("bajarilgan buyurtma")}</span></div>
          <div><Star /><b>{st?.rating ? st.rating.toFixed(1) : "—"}</b><span>{t("o'rtacha baho")}</span></div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div><span className="eyebrow">{t("Yo'nalishlar")}</span><h2>{t("Qanday syomka kerak?")}</h2></div>
            <LinkButton to="/creators" variant="secondary">{t("Barcha ijodkorlar")} <ArrowRight size={16} /></LinkButton>
          </div>
          <div className="cat-photos">
            {CATEGORIES.map((c) => (
              <Link key={c.name} to={`/creators?specialty=${encodeURIComponent(c.name)}`} className="cat-photo">
                <Img src={img[c.slot]} alt={c.name} />
                <div className="cat-label"><div><b>{t(c.name)}</b><span>{t(c.hint)}</span></div><ArrowRight size={16} /></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div><span className="eyebrow">{t("Tavsiya etiladi")}</span><h2>{t("Mashhur ijodkorlar")}</h2></div>
            <LinkButton to="/creators" variant="secondary">{t("Barchasi")} <ArrowRight size={16} /></LinkButton>
          </div>
          <div className="grid-cards">
            {top === null ? Array.from({ length: 4 }).map((_, i) => <CreatorCardSkeleton key={i} />) :
              top.length === 0 ? <p className="muted">{t("Hozircha ijodkorlar yo'q. Birinchi bo'ling —")} <Link to="/register?role=creator">{t("profil oching")}</Link>.</p> :
                top.map((c) => <CreatorCard key={c.id} c={c} />)}
          </div>
        </div>
      </section>

      {site && site.showcase.length >= 7 && (
        <section className="section">
          <div className="container">
            <div className="section-head"><div><span className="eyebrow">{t("Portfoliolardan")}</span><h2>{t("Ijodkorlarimiz ishlari")}</h2></div></div>
            <div className="showcase">
              {site.showcase.slice(0, 7).map((p) => (
                <div key={p.id} className="show-item">
                  <Img src={p.image_url} alt={p.title || p.creator_name} />
                  <Link to={`/creators/${p.creator_id}`} className="show-cap"><Camera size={12} /> {p.creator_name}</Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section how-band" id="how">
        <div className="container">
          <div className="section-head center"><div><span className="eyebrow">{t("3 qadam")}</span><h2>{t("PhotoMarket qanday ishlaydi?")}</h2></div></div>
          <div className="how-cards">
            <div className="how-card"><div className="hc-photo"><Img src={img.cat_portrait} alt="Ijodkorlarni toping" /></div>
              <span className="hc-n">01</span><h3><Search size={18} /> {t("Toping va solishtiring")}</h3>
              <p>{t("Shahar, narx, reyting, uslub va bo'sh sana bo'yicha filtrlang. Portfolio va sharhlarni ko'ring.")}</p></div>
            <div className="how-card"><div className="hc-photo"><Img src={img.cat_wedding} alt="Buyurtma bering" /></div>
              <span className="hc-n">02</span><h3><CalendarCheck size={18} /> {t("Buyurtma bering")}</h3>
              <p>{t("Paketni tanlang, sana va manzilni kiriting. Ijodkor kabinetida va emailida xabar oladi.")}</p></div>
            <div className="how-card"><div className="hc-photo"><Img src={img.how} alt="Syomka va natija" /></div>
              <span className="hc-n">03</span><h3><MessageCircle size={18} /> {t("Kelishing va baholang")}</h3>
              <p>{t("Chatda tafsilotlarni kelishing. Ishdan so'ng sharh qoldiring — bu boshqalarga yordam beradi.")}</p></div>
          </div>
          <div className="row center-row"><LinkButton to="/how-it-works" variant="secondary">{t("Batafsil")} <ArrowRight size={16} /></LinkButton></div>
        </div>
      </section>

      {site && site.testimonials.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head"><div><span className="eyebrow">{t("Mijozlar fikri")}</span><h2>{t("So'nggi sharhlar")}</h2></div></div>
            <div className="testimonials">
              {site.testimonials.slice(0, 3).map((r) => (
                <figure key={r.id} className="testimonial">
                  <Quote size={26} className="tq" />
                  <Stars value={r.rating} />
                  <blockquote>{r.comment}</blockquote>
                  <figcaption>
                    <Avatar src={r.client?.avatar_url} name={r.client?.name ?? t("Mijoz")} size={38} />
                    <div><b>{r.client?.name}</b><Link to={`/creators/${r.creator_id}`} className="small">{r.creator_name}</Link></div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="container"><div className="cta-band">
          <div className="cta-text">
            <span className="eyebrow">{t("Ijodkorlar uchun")}</span>
            <h2>{t("Siz fotograf yoki videografmisiz?")}</h2>
            <p>{t("Bepul profil oching, portfoliongizni joylang va yangi mijozlardan buyurtma qabul qiling. Kalendar, chat va statistika — hammasi bir kabinetda.")}</p>
            <ul className="ticks">
              <li><ShieldCheck size={18} /> {t("Tasdiqlangan belgi")}</li>
              <li><CalendarCheck size={18} /> {t("Bandlik kalendari")}</li>
              <li><Star size={18} /> {t("Sharh va reyting")}</li>
            </ul>
            <LinkButton to="/register?role=creator" size="lg">{t("Ijodkor sifatida qo'shilish")} <ArrowRight size={18} /></LinkButton>
          </div>
          <div className="cta-photo"><Img src={img.cta} alt="Fotograf" /></div>
        </div></div>
      </section>
    </>
  );
}
