import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Unlock } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { MonthCalendar, currentMonth } from "../../components/MonthCalendar";
import { Button, Field, Input, PageHead, StatusBadge, useToast } from "../../components/ui";
import type { Booking } from "../../types";
import { fmtDate, todayISO } from "../../utils";
import { t } from "../../i18n";

type Cal = { bookings: Booking[]; blocked: { id: number; day: string; note: string }[] };

export default function Calendar() {
  const { user } = useAuth();
  const toast = useToast();
  const isCreator = user?.role === "creator";
  const [month, setMonth] = useState(currentMonth());
  const [cal, setCal] = useState<Cal>({ bookings: [], blocked: [] });
  const [day, setDay] = useState<string>(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get<Cal>("/bookings/calendar", { month }).then(setCal).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);

  const byDay = (d: string) => cal.bookings.filter((b) => b.event_date === d);
  const blockedOf = (d: string) => cal.blocked.find((b) => b.day === d);
  const sel = byDay(day);
  const selBlocked = blockedOf(day);

  const block = async () => {
    setBusy(true);
    try { await api.post("/creator/blocked", { day, note }); setNote(""); toast(t("Kun band qilindi")); load(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const unblock = async () => {
    if (!selBlocked) return;
    setBusy(true);
    try { await api.del(`/creator/blocked/${selBlocked.id}`); toast(t("Kun bo'shatildi")); load(); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title={isCreator ? t("Bandlik kalendari") : t("Kalendar")}
        sub={isCreator ? t("Kunni tanlang: buyurtmalarni ko'ring yoki dam olish kunini band qiling — mijozlar u kunga buyurtma bera olmaydi.") : t("Buyurtmalaringiz sanalar bo'yicha")} />
      <div className="cal-layout">
        <section className="card">
          <MonthCalendar month={month} onMonth={setMonth} onDayClick={setDay}
            dayClass={(d) => [d === day ? "selected" : "", blockedOf(d) ? "busy" : ""].join(" ")}
            renderDay={(d) => {
              const items = byDay(d);
              return (
                <div className="cal-items">
                  {blockedOf(d) && <span className="cal-pill blocked">{t("Band")}</span>}
                  {items.slice(0, 2).map((b) => <span key={b.id} className={`cal-pill st-${b.status}`}>{b.start_time || "•"} {b.title}</span>)}
                  {items.length > 2 && <span className="cal-more">+{items.length - 2}</span>}
                </div>
              );
            }} />
        </section>
        <aside className="card">
          <h2>{fmtDate(day)}</h2>
          {sel.length ? (
            <div className="list">
              {sel.map((b) => (
                <Link key={b.id} to={`/dashboard/bookings/${b.id}`} className="list-row">
                  <div className="grow"><b>{b.start_time || t("Vaqt kelishiladi")} · {b.title}</b>
                    <div className="muted small">{isCreator ? b.client?.name : b.creator.display_name} · {b.location}</div></div>
                  <StatusBadge status={b.status} />
                </Link>
              ))}
            </div>
          ) : <p className="muted">{t("Bu kunda buyurtma yo'q.")}</p>}
          {isCreator && day >= todayISO() && (
            <div className="mt stack">
              {selBlocked ? (
                <>
                  <p className="muted small">{t("Bu kun band qilingan")}{selBlocked.note && `: ${selBlocked.note}`}</p>
                  <Button variant="secondary" loading={busy} onClick={unblock}><Unlock size={16} /> {t("Kunni bo'shatish")}</Button>
                </>
              ) : !sel.some((b) => b.status === "accepted") && (
                <>
                  <Field label={t("Izoh (faqat sizga ko'rinadi)")}><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Masalan: ta'til")} maxLength={200} /></Field>
                  <Button variant="secondary" loading={busy} onClick={block}><Lock size={16} /> {t("Kunni band qilish")}</Button>
                </>
              )}
            </div>
          )}
          <div className="legend mt">
            <span><i className="lg-pending" /> {t("Kutilmoqda")}</span><span><i className="lg-accepted" /> {t("Qabul qilingan")}</span>
            <span><i className="lg-completed" /> {t("Bajarilgan")}</span>{isCreator && <span><i className="lg-busy" /> {t("Band kun")}</span>}
          </div>
        </aside>
      </div>
    </>
  );
}
