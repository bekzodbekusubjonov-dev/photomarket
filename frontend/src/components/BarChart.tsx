import type { SeriesPoint } from "../types";
import { fmtShortMoney } from "../utils";
import { t } from "../i18n";

export function BarChart({ data, field, money }: { data: SeriesPoint[]; field: "bookings" | "revenue" | "completed"; money?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d[field]));
  return (
    <div className="bar-chart">
      {data.map((d) => {
        const v = d[field];
        return (
          <div className="bar-col" key={d.label} title={`${d.label}: ${money ? fmtShortMoney(v) + t(" so'm") : v}`}>
            <span className="bar-val">{v ? (money ? fmtShortMoney(v) : v) : ""}</span>
            <div className="bar-track"><div className="bar" style={{ height: `${(v / max) * 100}%` }} /></div>
            <span className="bar-label">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
