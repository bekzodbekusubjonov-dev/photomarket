import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { t } from "../i18n";

/** Barmoq/sichqoncha bilan imzo chizish maydoni. onChange: PNG data URL yoki "" (bo'sh). */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr); g.lineWidth = 2.4; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#1e1b4b";
  }, []);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const down = (e: React.PointerEvent) => { ref.current!.setPointerCapture(e.pointerId); drawing.current = true; const g = ref.current!.getContext("2d")!; const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.01, y); g.stroke(); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const g = ref.current!.getContext("2d")!; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); if (empty) setEmpty(false); };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const c = ref.current!;
    // kichraytirilgan PNG (≈ 30-60 KB dan oshmasin)
    const out = document.createElement("canvas");
    out.width = 360; out.height = Math.round((360 * c.height) / c.width);
    out.getContext("2d")!.drawImage(c, 0, 0, out.width, out.height);
    onChange(out.toDataURL("image/png"));
  };
  const clear = () => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setEmpty(true); onChange(""); };
  return (
    <div className="sig-pad">
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {empty && <span className="sig-hint">{t("Shu yerga imzo chizing")}</span>}
      <button type="button" className="sig-clear" onClick={clear} aria-label={t("Tozalash")}><Eraser size={15} /> {t("Tozalash")}</button>
    </div>
  );
}
