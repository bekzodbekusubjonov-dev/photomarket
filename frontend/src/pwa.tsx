import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, Share, X } from "lucide-react";
import { Button, Modal, useToast } from "./components/ui";
import { t } from "./i18n";

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function registerSW() {
  if (!("serviceWorker" in navigator) || !import.meta.env?.PROD) return;
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIPEvent; listeners.forEach((l) => l()); });
window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((l) => l()); });

/** "Ilovani o'rnatish" tugmasi (o'rnatilgan bo'lsa ko'rinmaydi) */
export function InstallButton({ className, variant = "secondary" }: { className?: string; variant?: "primary" | "secondary" | "ghost" }) {
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => { const l = () => force((n) => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  if (isStandalone()) return null;
  const click = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => null);
      deferred = null; force((n) => n + 1);
    } else setHelp(true);
  };
  return (
    <>
      <Button variant={variant} className={className} onClick={click}><Download size={16} /> {t("Ilovani o'rnatish")}</Button>
      <Modal open={help} onClose={() => setHelp(false)} title={t("Ilovani o'rnatish")}>
        {isIOS() ? (
          <ol className="install-steps">
            <li>{t("Safari pastidagi")} <Share size={16} style={{ verticalAlign: "-3px" }} /> {t("«Ulashish» tugmasini bosing")}</li>
            <li>{t("«Bosh ekranga qo'shish» ni tanlang")}</li>
            <li>{t("«Qo'shish» ni bosing — PhotoMarket ikonasi paydo bo'ladi")}</li>
          </ol>
        ) : (
          <ol className="install-steps">
            <li>{t("Brauzer menyusini oching (⋮)")}</li>
            <li>{t("«Ilovani o'rnatish» yoki «Bosh ekranga qo'shish» ni tanlang")}</li>
            <li>{t("Tasdiqlang — PhotoMarket ikonasi paydo bo'ladi")}</li>
          </ol>
        )}
        <p className="muted small">{t("O'rnatilgach ilova alohida oynada ochiladi, Sozlamalarda PIN-kod yoki barmoq izi bilan kirishni yoqishingiz mumkin.")}</p>
        <div className="row-end"><Button variant="secondary" onClick={() => setHelp(false)}><X size={15} /> {t("Yopish")}</Button></div>
      </Modal>
    </>
  );
}

/** O'rnatilgan ilovada bosh sahifada "orqaga" bosilsa darhol chiqib ketmaydi: avval ogohlantiradi */
export function BackGuard() {
  const { pathname } = useLocation();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(() => {
    if (!isStandalone() || !(pathname === "/" || pathname === "/dashboard")) return;
    let armed = false;
    let timer: number | undefined;
    const sentinel = () => history.pushState({ ...(history.state ?? {}), pmGuard: true }, "");
    sentinel();
    const onPop = () => {
      if (history.state?.pmOverlay) return; // oyna yopilishi — boshqa mexanizm
      if (armed) { window.removeEventListener("popstate", onPop); history.back(); return; }
      armed = true;
      toastRef.current(t("Chiqish uchun yana bir marta bosing"), "success");
      sentinel();
      timer = window.setTimeout(() => { armed = false; }, 2200);
    };
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("popstate", onPop); clearTimeout(timer); };
  }, [pathname]);
  return null;
}
