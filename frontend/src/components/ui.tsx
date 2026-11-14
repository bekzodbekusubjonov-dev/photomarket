import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AlertCircle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Star, X } from "lucide-react";
import { mediaUrl } from "../api";
import type { BookingStatus } from "../types";
import { STATUS_LABEL, cx, fmtDate, initials, toISODate } from "../utils";
import { getLang, t } from "../i18n";

/* ---------------- Button ---------------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  block?: boolean;
};
export function Button({ variant = "primary", size = "md", loading, block, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button className={cx("btn", `btn-${variant}`, `btn-${size}`, block && "btn-block", className)}
      disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="spin" size={16} />}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = "primary", size = "md", className, children }:
  { to: string; variant?: BtnProps["variant"]; size?: BtnProps["size"]; className?: string; children: ReactNode }) {
  return <Link to={to} className={cx("btn", `btn-${variant}`, `btn-${size}`, className)}>{children}</Link>;
}

/* ---------------- Form fields ---------------- */
export function Field({ label, hint, error, children, className }:
  { label?: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("field", className)}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
/** type="password" bo'lsa avtomatik «ko'z» tugmasi chiqadi (parolni ko'rsatish/yashirish) */
export function Input({ className, type, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  if (type === "password") {
    return (
      <div className="pw-wrap">
        <input className={cx("input", className)} type={show ? "text" : "password"} {...p} />
        <button type="button" className="pw-eye" tabIndex={-1} onClick={() => setShow((s) => !s)}
          aria-label={show ? t("Parolni yashirish") : t("Parolni ko'rsatish")} aria-pressed={show}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  }
  return <input className={cx("input", className)} type={type} {...p} />;
}
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) =>
  <textarea className={cx("input textarea", className)} {...p} />;
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) =>
  <select className={cx("input select", className)} {...p}>{children}</select>;

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className={cx("alert", `alert-${kind}`)} role={kind === "error" ? "alert" : "status"}>
      {kind === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <div>{children}</div>
    </div>
  );
}

/* ---------------- Display ---------------- */
export function Avatar({ src, name, size = 40, className }: { src?: string; name: string; size?: number; className?: string }) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);
  const url = mediaUrl(src);
  return (
    <span className={cx("avatar", className)} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {url && !err ? <img src={url} alt={name} onError={() => setErr(true)} /> : initials(name)}
    </span>
  );
}

export function Img({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);
  const url = mediaUrl(src);
  if (!url || err) {
    // Rasm yuklanmasa — tayyor namunaviy foto (public/photos), shunda bo'shliq qolmaydi
    let h = 0;
    for (const ch of `${alt}${src ?? ""}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return <img src={`/photos/f${(h % 4) + 1}.webp`} alt={alt} className={className} loading="lazy" />;
  }
  return <img src={url} alt={alt} className={className} loading="lazy" onError={() => setErr(true)} />;
}

export function Stars({ value, size = 14, showValue }: { value: number; size?: number; showValue?: boolean }) {
  return (
    <span className="stars" aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(value) ? "star-on" : "star-off"} />
      ))}
      {showValue && <b>{value ? value.toFixed(1) : "—"}</b>}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="star-input" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button type="button" key={i} onMouseEnter={() => setHover(i)} onClick={() => onChange(i)} aria-label={t("{n} yulduz", { n: i })}>
          <Star size={30} className={i <= (hover || value) ? "star-on" : "star-off"} />
        </button>
      ))}
    </div>
  );
}

export const StatusBadge = ({ status }: { status: BookingStatus }) =>
  <span className={cx("badge", `st-${status}`)}>{STATUS_LABEL[status]}</span>;

export const Badge = ({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "green" | "blue" | "red" }) =>
  <span className={cx("badge", `badge-${tone}`)}>{children}</span>;

export const Spinner = ({ label = t("Yuklanmoqda...") }: { label?: string }) =>
  <div className="spinner-wrap"><Loader2 className="spin" size={26} /><span>{label}</span></div>;

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <nav className="pagination" aria-label={t("Sahifalar")}>
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={t("Oldingi")}><ChevronLeft size={16} /></button>
      {nums.map((n, i) => n === "…" ? <span key={i}>…</span> :
        <button key={i} className={cx(n === page && "active")} onClick={() => onChange(n)}>{n}</button>)}
      <button disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={t("Keyingi")}><ChevronRight size={16} /></button>
    </nav>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, wide, xl }:
  { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean; xl?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  useBackClose(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx("modal", wide && "modal-wide", xl && "modal-xl")} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t("Yopish")}><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ text: string; resolve: (v: boolean) => void } | null>(null);
  const confirm = useCallback((text: string) => new Promise<boolean>((resolve) => setState({ text, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  const node = (
    <Modal open={!!state} onClose={() => close(false)} title={t("Tasdiqlang")}>
      <p className="muted" style={{ marginTop: 0 }}>{state?.text}</p>
      <div className="row-end">
        <Button variant="secondary" onClick={() => close(false)}>{t("Yo'q")}</Button>
        <Button variant="danger" onClick={() => close(true)}>{t("Ha, davom etish")}</Button>
      </div>
    </Modal>
  );
  return { confirm, node };
}

/* ---------------- Toast ---------------- */
type Toast = { id: number; kind: "success" | "error"; text: string };
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const push = useCallback((text: string, kind: Toast["kind"] = "success") => {
    const id = ++idRef.current;
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx("toast", `toast-${t.kind}`)}>
            {t.kind === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------------- Hooks ---------------- */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fn().then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, setData, error, loading, reload: () => setTick((t) => t + 1) };
}

export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  useEffect(() => { document.title = `${title} — PhotoMarket`; }, [title]);
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}


/* ---------------- Sana maydoni (barcha tillarda bir xil ko'rinish) ---------------- */
export function DateField({ value, onChange, min, max, required, placeholder, className, ...rest }: {
  value: string; onChange: (e: { target: { value: string } }) => void; min?: string; max?: string; required?: boolean;
  placeholder?: string; className?: string; title?: string; "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // namunaviy sana: bir oy keyingi kun (til bo'yicha formatlanadi)
  const sample = fmtDate(toISODate(new Date(Date.now() + 30 * 864e5)));
  return (
    <div className={cx("input date-field", !value && "empty", className)} onClick={() => { try { ref.current?.showPicker(); } catch { ref.current?.focus(); } }}>
      <span>{value ? fmtDate(value) : (placeholder ?? t("Masalan: {d}", { d: sample }))}</span>
      <CalendarDays size={17} />
      <input ref={ref} type="date" tabIndex={-1} value={value} min={min} max={max} required={required} lang={getLang()}
        onChange={(e) => onChange({ target: { value: e.target.value } })} {...rest} />
    </div>
  );
}

/** Orqaga tugmasi ochiq oynani (modal, galereya, filtr) yopsin, ilovadan chiqarib yubormasin */
export function useBackClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const marker = { pmOverlay: Math.random() };
    history.pushState({ ...(history.state ?? {}), ...marker }, "");
    let popped = false;
    const onPop = () => { popped = true; closeRef.current(); };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // oyna tugma orqali yopilgan bo'lsa, qo'shilgan tarix yozuvini olib tashlaymiz
      if (!popped && history.state?.pmOverlay === marker.pmOverlay) history.back();
    };
  }, [open]);
}
