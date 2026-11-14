import { BrandMark } from "./Brand";
import type { Receipt } from "../types";
import { fmtDateTime } from "../utils";
import { t } from "../i18n";

const sum = (n: number) => Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ");

/** Chiziqli (shtrix) kod: qiymatning raqamlaridan hosil bo'ladi (bezak) */
export function Barcode({ value }: { value: string }) {
  let x = 4;
  const bars: JSX.Element[] = [];
  const src = `${value}${value}`.slice(0, 22);
  for (let i = 0; i < src.length; i++) {
    const d = Number(src[i]) || 1;
    const w = 1 + ((d * 7 + i) % 3);
    bars.push(<rect key={`a${i}`} x={x} y={0} width={w} height={46} />);
    x += w + 1 + (d % 2);
    bars.push(<rect key={`b${i}`} x={x} y={0} width={1} height={46} />);
    x += 3;
  }
  return <svg viewBox={`0 0 ${x + 4} 46`} preserveAspectRatio="none" className="rc-barcode" aria-hidden="true">{bars}</svg>;
}

/** Termal printer chekining qog'ozi (zigzag qirra, monospace) */
export function ReceiptPaper({ r }: { r: Receipt }) {
  const row = (k: string, v: string, b = false) => <div className={`rc-row ${b ? "b" : ""}`}><span>{k}</span><span>{v}</span></div>;
  return (
    <div className="rc-paper">
      <div className="rc-logo"><BrandMark size={44} /></div>
      <div className="rc-brand">P H O T O M A R K E T</div>
      <div className="rc-sub">{t("FOTO · VIDEO BOZORI · O'ZBEKISTON")}</div>
      <div className="rc-sub">{t("CHEK")} {r.receipt_no} · {fmtDateTime(r.date)}</div>
      <hr />
      <div className="rc-item"><span>1</span><span className="rc-name">{r.booking_title}</span><span>{sum(r.amount)}</span></div>
      <div className="rc-meta">{t("Mijoz")}: {r.client}</div>
      <div className="rc-meta">{t("Ijodkor")}: {r.creator}</div>
      <hr />
      {row(t("JAMI (SUMMA)"), sum(r.amount))}
      {row(t("Platforma xizmat haqi"), sum(r.fee))}
      {row(t("Ijodkorga"), sum(r.creator_amount))}
      <div className="rc-total"><span>{t("TO'LANDI")}</span><span>{sum(r.amount)}</span></div>
      <div className="rc-sub left">{t("USUL")}: {r.method_label.toUpperCase()}{r.card ? ` · ${r.card}` : ""}</div>
      {r.contract_no && <div className="rc-sub left">{t("SHARTNOMA")}: {r.contract_no}</div>}
      <hr />
      <div className="rc-approved"><span>{r.approved ? t("TASDIQLANDI") : t("KUTILMOQDA")}</span><span>{t("KOD")} {r.signature}</span></div>
      <Barcode value={r.barcode} />
      <div className="rc-thanks">{t("RAHMAT · YANA KELING")}</div>
    </div>
  );
}

/** Printer: qog'oz asta-sekin chiqib keladi, chiroq sariqdan yashilga o'tadi */
export function ReceiptPrinter({ r, animate = true }: { r: Receipt; animate?: boolean }) {
  return (
    <div className={`printer-stage ${animate ? "anim" : "static"}`}>
      <div className="paper-window"><ReceiptPaper r={r} /></div>
      <div className="printer-body"><i className="led" /><span className="slot" /></div>
    </div>
  );
}
