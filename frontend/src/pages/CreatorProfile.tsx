import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AtSign, BadgeCheck, Briefcase, CalendarCheck, Clock, MapPin, MessageCircle, Send, Sparkles } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { BookingForm } from "../components/BookingForm";
import { Lightbox } from "../components/Lightbox";
import { MonthCalendar, currentMonth } from "../components/MonthCalendar";
import { Avatar, Badge, Button, Empty, Img, Pagination, Spinner, Stars, useAsync } from "../components/ui";
import type { CreatorFull, Paged, Review } from "../types";
import { CATEGORY_LABEL, fmtDate, fmtMoney, timeAgo } from "../utils";
import { useSite } from "../site";
import { FavButton } from "../favorites";
import { t } from "../i18n";

type Avail = { blocked: string[]; booked: Record<string, unknown[]> };

export default function CreatorProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const site = useSite();
  const nav = useNavigate();
  const { data: c, loading, error } = useAsync(() => api.get<CreatorFull>(`/creators/${id}`), [id]);
  const [lb, setLb] = useState<number | null>(null);
  const [book, setBook] = useState<{ open: boolean; service?: number | null }>({ open: false });
  const [month, setMonth] = useState(currentMonth());
  const [avail, setAvail] = useState<Avail | null>(null);
  const [rPage, setRPage] = useState(1);
  const reviews = useAsync(() => api.get<Paged<Review>>(`/creators/${id}/reviews`, { page: rPage, size: 6 }), [id, rPage]);

  useEffect(() => { if (c) document.title = `${c.display_name} — PhotoMarket`; }, [c]);
  useEffect(() => {
    api.get<Avail>(`/creators/${id}/availability`, { month }).then(setAvail).catch(() => {});
  }, [id, month]);

  if (loading) return <div className="container page"><Spinner /></div>;
  if (error || !c) return <div className="container page"><Empty title={t("Ijodkor topilmadi")} text={error} /></div>;

  const isOwner = user?.creator_id === c.id;
  const canBook = !user || user.role === "client";
  const startBooking = (service?: number | null) => {
    if (!user) return nav(`/login?next=/creators/${c.id}`);
    setBook({ open: true, service });
  };
  const writeMessage = () => {
    if (!user) return nav(`/login?next=/creators/${c.id}`);
    nav(`/dashboard/messages/${c.user_id}`);
  };
  const breakdown = c.rating_breakdown ?? {};
  const maxB = Math.max(1, ...Object.values(breakdown));

  return (
    <div className="profile-page">
      <div className="profile-cover"><Img src={c.cover_url || site?.images.cover} alt={c.display_name} /></div>
      <div className="container">
        <div className="profile-head">
          <Avatar src={c.avatar_url} name={c.display_name} size={112} className="profile-avatar" />
          <div className="profile-title">
            <div className="row gap-s wrap">
              <Badge tone="accent">{CATEGORY_LABEL[c.category]}</Badge>
              {c.verified && <Badge tone="green"><BadgeCheck size={13} /> {t("Tasdiqlangan")}</Badge>}
              {c.featured && <Badge tone="blue"><Sparkles size={13} /> {t("Tavsiya")}</Badge>}
            </div>
            <h1>{c.display_name}</h1>
            <div className="profile-meta">
              <span><MapPin size={15} /> {t(c.city)}</span>
              {c.experience_years > 0 && <span><Briefcase size={15} /> {c.experience_years} {t("yil tajriba")}</span>}
              <span><Stars value={c.rating} /> {c.reviews_count ? `${c.rating.toFixed(1)} · ${t("{n} sharh",{n:c.reviews_count})}` : t("Hali sharh yo'q")}</span>
              {c.completed_count > 0 && <span><CalendarCheck size={15} /> {c.completed_count} {t("ta bajarilgan buyurtma")}</span>}
            </div>
          </div>
          <div className="profile-cta">
            <div className="price-box"><span className="muted small">{t("narx")}</span><b>{c.price_from ? t("{p} dan",{p:fmtMoney(c.price_from)}) : t("Kelishiladi")}</b></div>
            {isOwner ? <Link className="btn btn-secondary btn-md" to="/dashboard/profile">{t("Profilni tahrirlash")}</Link> : (
              <>
                {canBook && <Button size="lg" onClick={() => startBooking(null)}><CalendarCheck size={18} /> {t("Buyurtma berish")}</Button>}
                <Button variant="secondary" onClick={writeMessage}><MessageCircle size={18} /> {t("Xabar yozish")}</Button>
                <FavButton id={c.id} className="fav-inline" />
              </>
            )}
          </div>
        </div>

        <div className="profile-stats">
          <div><b>{c.completed_count}</b><span>{t("bajarilgan buyurtma")}</span></div>
          <div><b>{c.reviews_count}</b><span>{t("sharh")}</span></div>
          <div><b>{c.rating ? c.rating.toFixed(1) : "—"}</b><span>{t("o'rtacha baho")}</span></div>
          <div><b>{c.experience_years || "—"}</b><span>{t("yil tajriba")}</span></div>
          <div><b>{c.portfolio.length}</b><span>{t("portfolio ishi")}</span></div>
        </div>

        <div className="profile-grid">
          <div className="profile-main">
            <section className="card">
              <h2>{t("Portfolio")} <span className="muted small">({c.portfolio.length})</span></h2>
              {c.portfolio.length ? (
                <div className={`gallery g-mod${c.portfolio.length % 3}`}>
                  {c.portfolio.map((p, i) => (
                    <button key={p.id} className="gallery-item" onClick={() => setLb(i)}>
                      <Img src={p.image_url} alt={p.title || c.display_name} />
                      {p.title && <span>{p.title}</span>}
                    </button>
                  ))}
                </div>
              ) : <p className="muted">{t("Portfolio hali qo'shilmagan.")}</p>}
            </section>

            <section className="card">
              <h2>{t("Xizmatlar va narxlar")}</h2>
              {c.services.length ? (
                <div className="services">
                  {c.services.map((s) => (
                    <div key={s.id} className="service">
                      <div>
                        <h3>{s.title}</h3>
                        {s.description && <p className="muted">{s.description}</p>}
                        <span className="muted small"><Clock size={13} /> {s.duration_hours} {t("soat")}</span>
                      </div>
                      <div className="service-right">
                        <b>{fmtMoney(s.price)}</b>
                        {canBook && !isOwner && <Button size="sm" onClick={() => startBooking(s.id)}>{t("Tanlash")}</Button>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">{t("Paketlar yo'q — narx buyurtmada kelishiladi.")}</p>}
            </section>

            <section className="card">
              <h2>{t("Sharhlar")}</h2>
              {c.reviews_count > 0 && (
                <div className="rating-summary">
                  <div className="rating-big"><b>{c.rating.toFixed(1)}</b><Stars value={c.rating} size={16} /><span className="muted small">{c.reviews_count} {t("ta sharh")}</span></div>
                  <div className="rating-bars">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <div key={n} className="rb-row"><span>{n} ★</span><div className="rb-track"><div style={{ width: `${((breakdown[n] ?? 0) / maxB) * 100}%` }} /></div><span>{breakdown[n] ?? 0}</span></div>
                    ))}
                  </div>
                </div>
              )}
              {reviews.data?.items.length ? (
                <div className="reviews">
                  {reviews.data.items.map((r) => (
                    <article key={r.id} className="review">
                      <div className="row gap-s">
                        <Avatar src={r.client?.avatar_url} name={r.client?.name ?? t("Mijoz")} size={36} />
                        <div><b>{r.client?.name ?? t("Mijoz")}</b><div className="muted small">{timeAgo(r.created_at)}</div></div>
                        <span className="push"><Stars value={r.rating} /></span>
                      </div>
                      {r.comment && <p>{r.comment}</p>}
                      {r.reply && <div className="review-reply"><b>{t("Ijodkor javobi:")}</b> {r.reply}</div>}
                    </article>
                  ))}
                  <Pagination page={reviews.data.page} pages={reviews.data.pages} onChange={setRPage} />
                </div>
              ) : <p className="muted">{t("Hali sharhlar yo'q. Bajarilgan buyurtmadan so'ng mijozlar baho qoldiradi.")}</p>}
            </section>
          </div>

          <aside className="profile-side">
            <section className="card">
              <h2>{t("Men haqimda")}</h2>
              <p className="pre">{c.bio || t("Ma'lumot kiritilmagan.")}</p>
              {c.specialties.length > 0 && <div className="chips">{c.specialties.map((s) => <span key={s} className="chip">{t(s)}</span>)}</div>}
              {(c.instagram || c.telegram) && (
                <div className="socials">
                  {c.instagram && <a href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noreferrer"><AtSign size={15} /> {c.instagram}</a>}
                  {c.telegram && <a href={`https://t.me/${c.telegram}`} target="_blank" rel="noreferrer"><Send size={15} /> {c.telegram}</a>}
                </div>
              )}
              <p className="muted small">{t("Platformada:")} {fmtDate(c.created_at.slice(0, 10))} {t("dan beri")}</p>
            </section>
            <section className="card">
              <h2>{t("Bandlik kalendari")}</h2>
              <MonthCalendar compact month={month} onMonth={setMonth}
                dayClass={(d) => avail?.blocked.includes(d) ? "busy" : avail?.booked[d] ? "partial" : undefined} />
              <div className="legend"><span><i className="lg-free" /> {t("Bo'sh")}</span><span><i className="lg-partial" /> {t("Qisman band")}</span><span><i className="lg-busy" /> {t("Band")}</span></div>
            </section>
          </aside>
        </div>
      </div>
      <Lightbox items={c.portfolio} index={lb} onIndex={setLb} onClose={() => setLb(null)} />
      <BookingForm open={book.open} onClose={() => setBook({ open: false })} creatorId={c.id} creatorName={c.display_name} creatorAvatar={c.avatar_url} services={c.services} preService={book.service} />
    </div>
  );
}
