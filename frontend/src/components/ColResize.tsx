import { useEffect } from "react";

/**
 * Barcha `.table` jadvallar ustunlarini sichqoncha yoki barmoq bilan surib kengaytirish.
 * Ustun sarlavhasining o'ng chetidagi tutqichni torting.
 */
export function ColResize() {
  useEffect(() => {
    const decorate = (table: HTMLTableElement) => {
      if (table.dataset.rs) return;
      const heads = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th"));
      if (!heads.length) return;
      table.dataset.rs = "1";
      heads.forEach((th, i) => {
        if (i === heads.length - 1 && !th.textContent?.trim()) return;
        const grip = document.createElement("span");
        grip.className = "col-grip";
        grip.title = "↔";
        grip.addEventListener("pointerdown", (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          const all = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th"));
          if (table.style.tableLayout !== "fixed") {
            all.forEach((h) => { h.style.width = `${h.offsetWidth}px`; });
            table.style.tableLayout = "fixed";
            table.style.minWidth = "0";
          }
          const startX = ev.clientX, startW = th.offsetWidth;
          const move = (e: PointerEvent) => {
            const w = Math.max(60, startW + (e.clientX - startX));
            th.style.width = `${w}px`;
            table.style.width = `${all.reduce((s, h) => s + (parseFloat(h.style.width) || h.offsetWidth), 0)}px`;
          };
          const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); table.classList.remove("rs-drag"); };
          table.classList.add("rs-drag");
          window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
        });
        th.appendChild(grip);
      });
    };
    // Telefonda jadval kartochkaga aylanadi: har bir katak o'z sarlavhasini ko'rsatadi
    const label = (table: HTMLTableElement) => {
      const names = Array.from(table.querySelectorAll("thead th")).map((h) => (h.textContent ?? "").trim());
      table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => {
        Array.from(tr.children).forEach((td, i) => { if (!td.hasAttribute("data-label")) td.setAttribute("data-label", names[i] ?? ""); });
      });
    };
    const scan = () => document.querySelectorAll<HTMLTableElement>("table.table").forEach((t) => { decorate(t); label(t); });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
