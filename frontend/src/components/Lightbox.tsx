import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { mediaUrl } from "../api";
import type { PortfolioItem } from "../types";
import { t } from "../i18n";
import { useBackClose } from "./ui";

export function Lightbox({ items, index, onIndex, onClose }:
  { items: PortfolioItem[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  useEffect(() => {
    if (index === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % items.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [index, items.length, onClose, onIndex]);
  useBackClose(index !== null, onClose);
  if (index === null || !items[index]) return null;
  const it = items[index];
  return createPortal(
    <div className="lightbox" onClick={onClose}>
      <button className="lb-btn lb-close" aria-label={t("Yopish")}><X /></button>
      <button className="lb-btn lb-prev" aria-label={t("Oldingi")} onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + items.length) % items.length); }}><ChevronLeft /></button>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={mediaUrl(it.image_url)} alt={it.title || t("Portfolio")} />
        <figcaption>{it.title} <span>{index + 1} / {items.length}</span></figcaption>
      </figure>
      <button className="lb-btn lb-next" aria-label={t("Keyingi")} onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % items.length); }}><ChevronRight /></button>
    </div>,
    document.body,
  );
}
