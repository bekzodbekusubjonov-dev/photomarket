import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Delete, Fingerprint, Lock } from "lucide-react";
import { useAuth } from "./auth";
import { Alert, Button, Field, Input } from "./components/ui";
import { t } from "./i18n";

/* Ilova qulfi: qurilmada saqlanadigan PIN-kod va (ixtiyoriy) barmoq izi / yuz (WebAuthn, qurilma biometriyasi).
   Bu qurilmadagi qulf — hisob parolini almashtirmaydi. */
interface LockCfg { salt: string; hash: string; cred?: string }
const keyOf = (uid: number) => `pm_lock_${uid}`;
const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const LOCK_AFTER_MS = 30_000;

async function hashPin(pin: string, salt: string) {
  const km = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: unb64(salt), iterations: 150_000, hash: "SHA-256" }, km, 256));
}
const load = (uid: number): LockCfg | null => { try { return JSON.parse(localStorage.getItem(keyOf(uid)) || "null"); } catch { return null; } };

export const biometricSupported = async () => {
  try { return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
};

async function registerBio(uid: number, name: string): Promise<string> {
  const cred = (await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { name: "PhotoMarket" },
    user: { id: enc.encode(`pm-${uid}`), name, displayName: name },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
    timeout: 60_000,
  } })) as PublicKeyCredential | null;
  if (!cred) throw new Error("cancelled");
  return b64(cred.rawId);
}
async function verifyBio(credId: string): Promise<boolean> {
  try {
    const r = await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: unb64(credId) as BufferSource }],
      userVerification: "required", timeout: 60_000,
    } });
    return !!r;
  } catch { return false; }
}

interface Ctx { enabled: boolean; hasBio: boolean; enable: (pin: string, bio: boolean) => Promise<void>; setBio: (on: boolean) => Promise<void>; disable: () => void; lockNow: () => void }
const LockCtx = createContext<Ctx>(null!);
export const useAppLock = () => useContext(LockCtx);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const uid = user?.id ?? 0;
  const [cfg, setCfg] = useState<LockCfg | null>(null);
  const [locked, setLocked] = useState(false);
  const hiddenAt = useRef(0);

  useEffect(() => {
    const c = uid ? load(uid) : null;
    setCfg(c);
    setLocked(!!c);               // ilova ochilganda (kirgan foydalanuvchi uchun) qulf so'raladi
  }, [uid]);

  useEffect(() => {
    if (!cfg) return;
    const h = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > LOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [cfg]);

  const save = (c: LockCfg | null) => {
    if (c) localStorage.setItem(keyOf(uid), JSON.stringify(c)); else localStorage.removeItem(keyOf(uid));
    setCfg(c);
  };
  const enable = useCallback(async (pin: string, bio: boolean) => {
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    const c: LockCfg = { salt, hash: await hashPin(pin, salt) };
    if (bio) c.cred = await registerBio(uid, user?.name ?? "user");
    save(c);
  }, [uid, user?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const setBio = useCallback(async (on: boolean) => {
    if (!cfg) return;
    save({ ...cfg, cred: on ? await registerBio(uid, user?.name ?? "user") : undefined });
  }, [cfg, uid, user?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const value: Ctx = { enabled: !!cfg, hasBio: !!cfg?.cred, enable, setBio, disable: () => save(null), lockNow: () => cfg && setLocked(true) };
  return (
    <LockCtx.Provider value={value}>
      {children}
      {user && cfg && locked && <LockScreen cfg={cfg} onUnlock={() => setLocked(false)} onForgot={() => { localStorage.removeItem(keyOf(uid)); setLocked(false); logout(); }} />}
    </LockCtx.Provider>
  );
}

function LockScreen({ cfg, onUnlock, onForgot }: { cfg: LockCfg; onUnlock: () => void; onForgot: () => void }) {
  const { user } = useAuth();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [fails, setFails] = useState(0);
  const tried = useRef(false);

  const bio = useCallback(async () => { if (cfg.cred && (await verifyBio(cfg.cred))) onUnlock(); }, [cfg.cred, onUnlock]);
  useEffect(() => { if (cfg.cred && !tried.current) { tried.current = true; bio(); } }, [bio, cfg.cred]);

  const submit = async (p: string) => {
    if ((await hashPin(p, cfg.salt)) === cfg.hash) { onUnlock(); return; }
    const n = fails + 1;
    setFails(n); setPin(""); setErr(t("PIN-kod noto'g'ri"));
    if (n >= 5) onForgot();
  };
  const press = (d: string) => {
    if (pin.length >= 6) return;
    const p = pin + d; setPin(p); setErr("");
    if (p.length >= 4 && p.length === 6) submit(p);
  };
  return (
    <div className="lock-screen" role="dialog" aria-modal="true">
      <div className="lock-card">
        <div className="lock-ico"><Lock size={26} /></div>
        <h2>PhotoMarket</h2>
        <p className="muted">{t("Davom etish uchun PIN-kodni kiriting")}{user ? ` · ${user.name}` : ""}</p>
        <div className="pin-dots" aria-label="PIN">{Array.from({ length: 6 }).map((_, i) => <i key={i} className={i < pin.length ? "on" : ""} />)}</div>
        {err && <p className="field-error center">{err}</p>}
        <div className="pin-pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
          {cfg.cred ? <button onClick={bio} aria-label={t("Barmoq izi")}><Fingerprint size={24} /></button> : <span />}
          <button onClick={() => press("0")}>0</button>
          <button onClick={() => { setPin((p) => p.slice(0, -1)); setErr(""); }} aria-label={t("O'chirish")}><Delete size={22} /></button>
        </div>
        <Button block onClick={() => pin.length >= 4 && submit(pin)} disabled={pin.length < 4}>{t("Kirish")}</Button>
        <button className="link-btn" onClick={onForgot}>{t("PIN-kodni unutdim (qayta kirish)")}</button>
      </div>
    </div>
  );
}

/** Sozlamalar sahifasidagi blok */
export function AppLockSettings() {
  const lock = useAppLock();
  const [pin, setPin] = useState({ a: "", b: "" });
  const [bio, setBioWanted] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { biometricSupported().then(setBioOk); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setOk("");
    if (!/^\d{4,6}$/.test(pin.a)) return setErr(t("PIN-kod 4–6 raqamdan iborat bo'lsin"));
    if (pin.a !== pin.b) return setErr(t("PIN-kodlar mos kelmadi"));
    setBusy(true);
    try { await lock.enable(pin.a, bio && bioOk); setPin({ a: "", b: "" }); setOk(t("Ilova qulfi yoqildi")); }
    catch { setErr(t("Barmoq izini yoqib bo'lmadi. PIN-kod bilan davom eting yoki qurilma sozlamalarini tekshiring.")); }
    finally { setBusy(false); }
  };
  const toggleBio = async () => {
    setErr(""); setBusy(true);
    try { await lock.setBio(!lock.hasBio); } catch { setErr(t("Barmoq izini yoqib bo'lmadi. PIN-kod bilan davom eting yoki qurilma sozlamalarini tekshiring.")); } finally { setBusy(false); }
  };
  return (
    <section className="card">
      <h2><Fingerprint size={18} style={{ verticalAlign: "-3px" }} /> {t("Ilova qulfi")}</h2>
      <p className="muted small">{t("Ilova ochilganda yoki fondan qaytganda PIN-kod yoki barmoq izi so'raladi. Faqat shu qurilmada ishlaydi.")}</p>
      {lock.enabled ? (
        <div className="stack">
          <Alert kind="success">{t("Ilova qulfi yoqilgan")}{lock.hasBio ? ` · ${t("Barmoq izi yoqilgan")}` : ""}</Alert>
          {bioOk && <div><Button variant="secondary" loading={busy} onClick={toggleBio}>{lock.hasBio ? t("Barmoq izini o'chirish") : t("Barmoq izini yoqish")}</Button></div>}
          <div className="row gap-s wrap">
            <Button variant="secondary" onClick={lock.lockNow}>{t("Hozir qulflash")}</Button>
            <Button variant="danger" onClick={lock.disable}>{t("Qulfni o'chirish")}</Button>
          </div>
          <Alert>{err}</Alert>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <div className="grid-2">
            <Field label={t("PIN-kod (4–6 raqam)")}><Input type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} autoComplete="off" value={pin.a} onChange={(e) => setPin({ ...pin, a: e.target.value.replace(/\D/g, "") })} /></Field>
            <Field label={t("PIN-kodni takrorlang")}><Input type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} autoComplete="off" value={pin.b} onChange={(e) => setPin({ ...pin, b: e.target.value.replace(/\D/g, "") })} /></Field>
          </div>
          {bioOk && <label className="check"><input type="checkbox" checked={bio} onChange={(e) => setBioWanted(e.target.checked)} /> {t("Barmoq izi / yuz bilan ham kirish")}</label>}
          <Alert>{err}</Alert><Alert kind="success">{ok}</Alert>
          <div><Button loading={busy}>{t("Qulfni yoqish")}</Button></div>
        </form>
      )}
    </section>
  );
}
