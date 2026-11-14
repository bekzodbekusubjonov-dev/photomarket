import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, CalendarDays, Check, CheckCheck, Clock, Mail, MapPin, MessageCircle, Pencil, Phone, Send, Trash2, X } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { BookingForm } from "../../components/BookingForm";
import {
  Alert, Avatar, Button, Empty, Field, Modal, Spinner, StarInput, Stars, StatusBadge, Textarea, useAsync, useConfirm, useToast,
} from "../../components/ui";
import type { Booking, CreatorFull } from "../../types";
import { fmtDate, fmtDateTime, fmtMoney, todayISO } from "../../utils";
import { t } from "../../i18n";
import { MapCard } from "../../components/Map";
import { FileSignature } from "lucide-react";
import type { Contract } from "../../types";

function ContractStrip({ id }: { id: number }) {
  const { data: c } = useAsync(() => api.get<Contract | null>(`/contracts/by-booking/${id}`).catch(() => null), [id]);
  if (!c) return null;
  return (
    <Link to={`/dashboard/contracts/${c.id}`} className="card progress-card link-card">
      <FileSignature /><div className="grow"><b>{t("Elektron shartnoma")} {c.number}</b><p className="muted small">{c.status === "signed" ? t("Ikkala tomon imzolagan") : t("Imzo kutilmoqda — ochib imzolang")}</p></div>
    </Link>
  );
}

export default function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { confirm, node: confirmNode } = useConfirm();
  const { data: b, setData, loading, error } = useAsync(() => api.get<Booking>(`/bookings/${id}`), [id]);
  const [action, setAction] = useState<null | "rejected" | "cancelled">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [services, setServices] = useState<CreatorFull["services"]>([]);
  const [review, setReview] = useState({ rating: 5, comment: "" });
  const [err, setErr] = useState("");

  if (loading) return <Spinner />;
  if (error || !b) return <Empty title={t("Buyurtma topilmadi")} text={error} />;
  const role = user!.role;
  const isCreator = role === "creator";
  const isClient = role === "client";
  const isAdmin = role === "admin";
  const other = isCreator ? { id: b.client?.id, name: b.client?.name ?? t("Mijoz"), avatar: b.client?.avatar_url } :
    { id: b.creator.user_id, name: b.creator.display_name, avatar: b.creator.avatar_url };

  const changeStatus = async (status: string, n = "") => {
    setBusy(true);
    setErr("");
    try {
      const r = await api.post<Booking>(`/bookings/${b.id}/status`, { status, note: n });
      setData(r);
      toast(t("Holat: {s}", { s: r.status_label }));
      setAction(null);
      setNote("");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!(await confirm(t("Buyurtma butunlay o'chiriladi. Davom etasizmi?")))) return;
    try { await api.del(`/bookings/${b.id}`); toast(t("Buyurtma o'chirildi")); nav("/dashboard/bookings"); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  const openEdit = async () => {
    try { setServices((await api.get<CreatorFull>(`/creators/${b.creator.id}`)).services); } catch { setServices([]); }
    setEdit(true);
  };
  const sendReview = async () => {
    setBusy(true);
    try {
      await api.post(`/bookings/${b.id}/review`, review);
      setData(await api.get<Booking>(`/bookings/${b.id}`));
      toast(t("Rahmat! Sharhingiz qabul qilindi"));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const past = b.event_date <= todayISO();
  const steps = ["pending", "accepted", "completed"];
  const stepIdx = b.status === "rejected" || b.status === "cancelled" ? -1 : steps.indexOf(b.status);

  return (
    <>
      <Link to="/dashboard/bookings" className="back"><ArrowLeft size={16} /> {t("Buyurtmalar")}</Link>
      <div className="detail-head">
        <div>
          <span className="muted small">{t("Buyurtma #")}{b.id} · {fmtDateTime(b.created_at)}</span>
          <h1>{b.title}</h1>
        </div>
        <StatusBadge status={b.status} />
      </div>

      {stepIdx >= 0 ? (
        <ol className="timeline">
          {[t("So'rov yuborildi"), t("Ijodkor qabul qildi"), t("Bajarildi")].map((lbl, i) => (
            <li key={i} className={i <= stepIdx ? "done" : ""}><span>{i < stepIdx || b.status === "completed" ? <Check size={14} /> : i + 1}</span>{lbl}</li>
          ))}
        </ol>
      ) : <Alert kind="error">{b.status === "rejected" ? t("Bu buyurtma rad etilgan.") : t("Bu buyurtma bekor qilingan.")}{b.status_note && ` ${t("Izoh")}: ${b.status_note}`}</Alert>}

      {(b.status === "accepted" || b.status === "completed" || b.status === "cancelled") && <ContractStrip id={b.id} />}
      {b.lat != null && b.lng != null && <section className="card"><h2>{t("Manzilga borish")}</h2><MapCard lat={b.lat} lng={b.lng} title={b.location} /></section>}

      <div className="dash-grid">
        <section className="card">
          <h2>{t("Tafsilotlar")}</h2>
          <dl className="dl">
            <div><dt><CalendarDays size={16} /> {t("Sana")}</dt><dd>{fmtDate(b.event_date)}</dd></div>
            <div><dt><Clock size={16} /> {t("Vaqt")}</dt><dd>{b.start_time || t("Kelishiladi")} · {b.duration_hours} {t("soat")}</dd></div>
            <div><dt><MapPin size={16} /> {t("Manzil")}</dt><dd>{b.location}</dd></div>
            <div><dt>{t("Paket")}</dt><dd>{b.service?.title ?? "—"}</dd></div>
            <div><dt>{t("Narx")}</dt><dd><b>{fmtMoney(b.price)}</b></dd></div>
          </dl>
          {b.details && <><h3>{t("Qo'shimcha")}</h3><p className="pre">{b.details}</p></>}
          {b.status_note && stepIdx >= 0 && <p className="muted small">{t("Izoh:")} {b.status_note}</p>}
        </section>

        <section className="card">
          <h2>{isCreator ? t("Mijoz") : isClient ? t("Ijodkor") : t("Ishtirokchilar")}</h2>
          {isAdmin ? (
            <div className="stack">
              <div className="row gap-s"><Avatar src={b.client?.avatar_url} name={b.client?.name ?? "?"} /><div><b>{b.client?.name}</b><div className="muted small">{t("Mijoz ·")} {b.client_contact?.email}</div></div></div>
              <Link to={`/creators/${b.creator.id}`} className="row gap-s"><Avatar src={b.creator.avatar_url} name={b.creator.display_name} /><div><b>{b.creator.display_name}</b><div className="muted small">{t("Ijodkor ·")} {b.creator.city}</div></div></Link>
            </div>
          ) : (
            <>
              <div className="row gap-s">
                <Avatar src={other.avatar} name={other.name} size={52} />
                <div><b>{other.name}</b>{isClient && <div><Link to={`/creators/${b.creator.id}`} className="small">{t("Profilni ko'rish")}</Link></div>}</div>
              </div>
              {(b.client_contact || b.creator_contact) ? (
                <div className="contacts">
                  {(() => { const ct = b.client_contact ?? b.creator_contact!; return (<>
                    <a href={`mailto:${ct.email}`}><Mail size={16} /> {ct.email}</a>
                    {ct.phone && <a href={`tel:${ct.phone}`}><Phone size={16} /> {ct.phone}</a>}
                    {b.creator_contact?.telegram ? <a href={`https://t.me/${b.creator_contact.telegram}`} target="_blank" rel="noreferrer"><Send size={16} /> @{b.creator_contact.telegram}</a> : null}
                  </>); })()}
                </div>
              ) : <p className="muted small">{t("Kontaktlar buyurtma qabul qilingandan so'ng ko'rinadi.")}</p>}
              {other.id && <Button variant="secondary" block onClick={() => nav(`/dashboard/messages/${other.id}`)}><MessageCircle size={17} /> {t("Xabar yozish")}</Button>}
            </>
          )}

          <h3 className="mt">{t("Amallar")}</h3>
          <Alert>{err}</Alert>
          <div className="actions-col">
            {(isCreator || isAdmin) && b.status === "pending" && <>
              <Button variant="success" loading={busy} onClick={() => changeStatus("accepted")}><Check size={17} /> {t("Qabul qilish")}</Button>
              <Button variant="danger" onClick={() => setAction("rejected")}><X size={17} /> {t("Rad etish")}</Button>
            </>}
            {(isCreator || isAdmin) && b.status === "accepted" && (
              <Button variant="success" loading={busy} disabled={!past && !isAdmin} onClick={() => changeStatus("completed")} title={!past ? t("Tadbir kunidan keyin") : ""}>
                <CheckCheck size={17} /> {t("Bajarildi deb belgilash")}
              </Button>
            )}
            {(isClient || isCreator || isAdmin) && (b.status === "pending" || b.status === "accepted") && !(isCreator && b.status === "pending") &&
              <Button variant="secondary" onClick={() => setAction("cancelled")}><Ban size={17} /> {t("Bekor qilish")}</Button>}
            {(isClient || isAdmin) && b.status === "pending" && <Button variant="secondary" onClick={openEdit}><Pencil size={17} /> {t("Tahrirlash")}</Button>}
            {((isClient && ["pending", "cancelled", "rejected"].includes(b.status)) || isAdmin) &&
              <Button variant="ghost" onClick={remove}><Trash2 size={17} /> {t("O'chirish")}</Button>}
            {isCreator && b.status === "accepted" && !past && <p className="muted small">{t("«Bajarildi» tugmasi tadbir kunidan boshlab faollashadi.")}</p>}
          </div>
        </section>
      </div>

      {b.status === "completed" && (
        <section className="card">
          <h2>{t("Sharh")}</h2>
          {b.review ? (
            <div className="review">
              <Stars value={b.review.rating} size={18} />
              {b.review.comment && <p>{b.review.comment}</p>}
              {b.review.reply && <div className="review-reply"><b>{t("Ijodkor javobi:")}</b> {b.review.reply}</div>}
            </div>
          ) : isClient ? (
            <div className="stack" style={{ maxWidth: 520 }}>
              <p className="muted">{t("Ish yoqdimi? Baho qoldiring — bu boshqa mijozlarga yordam beradi.")}</p>
              <StarInput value={review.rating} onChange={(rating) => setReview({ ...review, rating })} />
              <Field label={t("Izoh")}><Textarea rows={3} value={review.comment} maxLength={2000} onChange={(e) => setReview({ ...review, comment: e.target.value })} /></Field>
              <Button loading={busy} onClick={sendReview}>{t("Sharhni yuborish")}</Button>
            </div>
          ) : <p className="muted">{t("Mijoz hali sharh qoldirmagan.")}</p>}
        </section>
      )}

      <Modal open={!!action} onClose={() => setAction(null)} title={action === "rejected" ? t("Buyurtmani rad etish") : t("Buyurtmani bekor qilish")}>
        <Field label={t("Sabab (ikkinchi tomonga ko'rinadi)")}>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
            placeholder={action === "rejected" ? t("Masalan: bu sanada boshqa shaharda bo'laman") : t("Masalan: tadbir ko'chirildi")} />
        </Field>
        <div className="row-end">
          <Button variant="secondary" onClick={() => setAction(null)}>{t("Ortga")}</Button>
          <Button variant="danger" loading={busy} onClick={() => changeStatus(action!, note)}>{t("Tasdiqlash")}</Button>
        </div>
      </Modal>
      <BookingForm open={edit} onClose={() => setEdit(false)} creatorId={b.creator.id} creatorName={b.creator.display_name} creatorAvatar={b.creator.avatar_url} services={services} existing={b}
        onSaved={(nb) => setData({ ...b, ...nb })} />
      {confirmNode}
    </>
  );
}
