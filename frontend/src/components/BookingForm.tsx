import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck } from "lucide-react";
import { api } from "../api";
import type { Booking, Service } from "../types";
import { fmtDate, fmtMoney, todayISO } from "../utils";
import { LocationPicker } from "./Map";
import { Alert, Avatar, Button, Field, DateField, Input, Modal, Select, Textarea, useToast } from "./ui";
import { t } from "../i18n";

type Avail = { blocked: string[]; booked: Record<string, { start_time: string; duration_hours: number }[]> };

const EVENT_TYPES = ["To'y", "Nikoh (ZAGS)", "Love story", "Portret", "Oilaviy fotosessiya", "Tug'ilgan kun",
  "Bolalar fotosessiyasi", "Korporativ tadbir", "Reklama / mahsulot", "Bitiruv", "Klip", "Boshqa"];

export function BookingForm({ open, onClose, creatorId, creatorName, creatorAvatar, services, preService, existing, onSaved }: {
  open: boolean;
  creatorName?: string;
  creatorAvatar?: string;
  onClose: () => void;
  creatorId: number;
  services: Service[];
  preService?: number | null;
  existing?: Booking | null;
  onSaved?: (b: Booking) => void;
}) {
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({
    service_id: "", title: "", event_date: "", start_time: "", duration_hours: "2", location: "", details: "", price: "",
  });
  const [pos, setPos] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [avail, setAvail] = useState<Avail | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr("");
    if (existing) {
      setF({
        service_id: existing.service ? String(existing.service.id) : "", title: existing.title,
        event_date: existing.event_date, start_time: existing.start_time, duration_hours: String(existing.duration_hours),
        location: existing.location, details: existing.details || "", price: existing.price ? String(existing.price) : "",
      });
      setPos({ lat: existing.lat ?? null, lng: existing.lng ?? null });
    } else {
      const s = services.find((x) => x.id === preService);
      setF((o) => ({ ...o, service_id: s ? String(s.id) : "", title: s ? s.title : o.title,
        duration_hours: s ? String(s.duration_hours) : o.duration_hours }));
    }
  }, [open, existing, preService, services]);

  useEffect(() => {
    if (!open || !f.event_date) return;
    api.get<Avail>(`/creators/${creatorId}/availability`, { month: f.event_date.slice(0, 7) }).then(setAvail).catch(() => {});
  }, [open, creatorId, f.event_date]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((o) => ({ ...o, [k]: e.target.value }));
  const svc = services.find((s) => String(s.id) === f.service_id);
  const dayBlocked = !!f.event_date && avail?.blocked.includes(f.event_date);
  const dayBooked = f.event_date ? avail?.booked[f.event_date] : undefined;

  const onService = (id: string) => {
    const s = services.find((x) => String(x.id) === id);
    setF((o) => ({ ...o, service_id: id, title: s ? s.title : o.title, duration_hours: s ? String(s.duration_hours) : o.duration_hours }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const body = {
      title: f.title, event_date: f.event_date, start_time: f.start_time, duration_hours: Number(f.duration_hours) || 1,
      location: f.location, details: f.details, price: svc ? null : f.price ? Number(f.price) : null, lat: pos.lat, lng: pos.lng,
    };
    try {
      const b = existing
        ? await api.put<Booking>(`/bookings/${existing.id}`, body)
        : await api.post<Booking>("/bookings", { ...body, creator_id: creatorId, service_id: svc ? svc.id : null });
      toast(existing ? t("Buyurtma yangilandi") : t("Buyurtma yuborildi! Ijodkor javobini kuting"));
      onSaved?.(b);
      onClose();
      if (!existing) nav(`/dashboard/bookings/${b.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={existing ? t("Buyurtmani tahrirlash") : t("Buyurtma berish")} xl>
      <div className="bf-layout">
      <form onSubmit={submit} className="form-grid" id="booking-form">
        {services.length > 0 && !existing && (
          <Field label={t("Xizmat paketi")} className="span-2">
            <Select value={f.service_id} onChange={(e) => onService(e.target.value)}>
              <option value="">{t("— Paketsiz (o'z byudjetim bilan) —")}</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.title} — {fmtMoney(s.price)}</option>)}
            </Select>
          </Field>
        )}
        <Field label={t("Tadbir / syomka turi")} className="span-2">
          <Input list="event-types" value={f.title} onChange={set("title")} required minLength={2} maxLength={140}
            placeholder={t("Masalan: To'y, Love story, Portret")} />
          <datalist id="event-types">{EVENT_TYPES.map((et) => <option key={et} value={et} label={t(et)} />)}</datalist>
        </Field>
        <Field label={t("Sana")}>
          <DateField min={todayISO()} value={f.event_date} onChange={set("event_date")} required />
        </Field>
        <Field label={t("Boshlanish vaqti")} hint={t("Ixtiyoriy")}>
          <Input type="time" value={f.start_time} onChange={set("start_time")} />
        </Field>
        {(dayBlocked || dayBooked) && (
          <div className="span-2">
            <Alert kind={dayBlocked ? "error" : "info"}>
              {dayBlocked ? t("Ijodkor bu kunni band deb belgilagan. Boshqa sanani tanlang.") :
                t("Bu kunda tasdiqlangan buyurtma bor: {list}. Vaqt kesishmasligi kerak.", { list: dayBooked!.map((b) => b.start_time ? `${b.start_time} (${b.duration_hours} ${t("soat")})` : t("kun bo'yi")).join(", ") })}
            </Alert>
          </div>
        )}
        <Field label={t("Davomiyligi (soat)")}>
          <Input type="number" min={0.5} max={72} step={0.5} value={f.duration_hours} onChange={set("duration_hours")} required />
        </Field>
        <Field label={svc ? t("Narx (paket bo'yicha)") : t("Byudjet (so'm)")} hint={svc ? undefined : t("Ixtiyoriy")}>
          {svc ? <Input value={fmtMoney(svc.price)} disabled /> :
            <Input type="number" min={0} step={50000} value={f.price} onChange={set("price")} placeholder="1 000 000" />}
        </Field>
        <Field label={t("Manzil")} className="span-2">
          <Input value={f.location} onChange={set("location")} required minLength={2} placeholder={t("Shahar, tuman, to'yxona / joy nomi")} />
        </Field>
        <div className="span-2"><LocationPicker lat={pos.lat} lng={pos.lng} onChange={(lat, lng) => setPos({ lat, lng })} label={t("Tadbir joyi xaritada (ixtiyoriy)")} /></div>
        <Field label={t("Qo'shimcha ma'lumot")} className="span-2" hint={t("Kishilar soni, uslub, maxsus istaklar")}>
          <Textarea rows={4} value={f.details} onChange={set("details")} maxLength={3000} />
        </Field>
        <div className="span-2"><Alert>{err}</Alert></div>
      </form>
      <aside className="bf-summary">
        <h4>{t("Buyurtma xulosasi")}</h4>
        {creatorName && (
          <div className="row gap-s bf-creator"><Avatar src={creatorAvatar} name={creatorName} size={40} /><div><b>{creatorName}</b><div className="muted small">{t("Ijodkor")}</div></div></div>
        )}
        <dl>
          <div><dt>{t("Xizmat")}</dt><dd>{svc?.title ?? (f.title || "—")}</dd></div>
          <div><dt>{t("Sana")}</dt><dd>{f.event_date ? fmtDate(f.event_date) : "—"}</dd></div>
          <div><dt>{t("Vaqt")}</dt><dd>{f.start_time || t("Kelishiladi")}</dd></div>
          <div><dt>{t("Davomiylik")}</dt><dd>{f.duration_hours || "—"} {t("soat")}</dd></div>
          <div><dt>{t("Manzil")}</dt><dd>{f.location || "—"}</dd></div>
        </dl>
        <div className="bf-total"><span>{svc ? t("Paket narxi") : t("Byudjet")}</span><b>{svc ? fmtMoney(svc.price) : f.price ? fmtMoney(Number(f.price)) : t("Kelishiladi")}</b></div>
        <p className="muted small">{t("To'lov hozircha ijodkor bilan to'g'ridan-to'g'ri amalga oshiriladi. Ijodkor qabul qilgach, kontaktlar ochiladi.")}</p>
        <Button type="submit" form="booking-form" block size="lg" loading={busy} disabled={!!dayBlocked}><CalendarCheck size={18} /> {existing ? t("Saqlash") : t("Buyurtma yuborish")}</Button>
        <Button type="button" variant="ghost" block onClick={onClose}>{t("Bekor qilish")}</Button>
      </aside>
      </div>
    </Modal>
  );
}
