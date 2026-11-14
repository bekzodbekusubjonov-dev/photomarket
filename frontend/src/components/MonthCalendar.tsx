import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS_CAP, WEEKDAYS, cx, toISODate, todayISO } from "../utils";
import { t } from "../i18n";

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export const currentMonth = () => todayISO().slice(0, 7);

export function MonthCalendar({ month, onMonth, renderDay, dayClass, onDayClick, compact }: {
  month: string;
  onMonth: (m: string) => void;
  renderDay?: (iso: string) => ReactNode;
  dayClass?: (iso: string) => string | undefined;
  onDayClick?: (iso: string) => void;
  compact?: boolean;
}) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7; // dushanbadan boshlanadi
  const days = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(toISODate(new Date(y, m - 1, d)));
  while (cells.length % 7) cells.push(null);
  const today = todayISO();
  return (
    <div className={cx("cal", compact && "cal-compact")}>
      <div className="cal-head">
        <button className="icon-btn" onClick={() => onMonth(shiftMonth(month, -1))} aria-label={t("Oldingi oy")}><ChevronLeft size={18} /></button>
        <b>{MONTHS_CAP[m - 1]} {y}</b>
        <button className="icon-btn" onClick={() => onMonth(shiftMonth(month, 1))} aria-label={t("Keyingi oy")}><ChevronRight size={18} /></button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w}</div>)}
        {cells.map((iso, i) => iso ? (
          <div key={i}
            className={cx("cal-day", iso === today && "today", iso < today && "past", dayClass?.(iso), onDayClick && "clickable")}
            onClick={() => onDayClick?.(iso)}>
            <span className="cal-num">{Number(iso.slice(8))}</span>
            {renderDay?.(iso)}
          </div>
        ) : <div key={i} className="cal-day empty" />)}
      </div>
    </div>
  );
}
