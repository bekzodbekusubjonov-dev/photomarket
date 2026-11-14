import { useState } from "react";
import { Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Alert, Avatar, Badge, Button, Input, Modal, PageHead, Pagination, Select, Spinner, useAsync, useConfirm, useDebounced, useToast } from "../../components/ui";
import type { Paged, User } from "../../types";
import { ROLE_LABEL, fmtDateTime } from "../../utils";
import { t } from "../../i18n";

export default function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, setData, loading } = useAsync(() => api.get<Paged<User>>("/admin/users", { q: dq, role, page }), [dq, role, page]);

  const [pw, setPw] = useState<{ user: User; password: string } | null>(null);
  const resetPw = async (u: User) => {
    if (!(await confirm(t("{name} uchun yangi vaqtinchalik parol yaratilsinmi? Eski parol ishlamay qoladi.", { name: u.name })))) return;
    try { const r = await api.post<{ password: string }>(`/admin/users/${u.id}/reset-password`); setPw({ user: u, password: r.password }); }
    catch (e) { toast((e as Error).message, "error"); }
  };

  const patch = async (u: User, body: Partial<Pick<User, "role" | "is_active" | "is_verified">>, text?: string) => {
    if (text && !(await confirm(text))) return;
    try {
      const nu = await api.patch<User>(`/admin/users/${u.id}`, body);
      setData((o) => o && { ...o, items: o.items.map((x) => x.id === nu.id ? nu : x) });
      toast(t("Saqlandi"));
    } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <>
      <PageHead title={t("Foydalanuvchilar")} sub={data ? t("{n} ta",{n:data.total}) : undefined} />
      <div className="toolbar">
        <Input placeholder={t("Ism, email yoki telefon...")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">{t("Barcha rollar")}</option><option value="client">{t("Mijozlar")}</option><option value="creator">{t("Ijodkorlar")}</option><option value="admin">{t("Adminlar")}</option>
        </Select>
      </div>
      {loading && !data ? <Spinner /> : (
        <div className="table-wrap card flush">
          <table className="table">
            <thead><tr><th>{t("Foydalanuvchi")}</th><th>{t("Rol")}</th><th>{t("Parol")}</th><th>{t("Holat")}</th><th>{t("Ro'yxatdan o'tgan")}</th><th>{t("Amallar")}</th></tr></thead>
            <tbody>
              {data?.items.map((u) => (
                <tr key={u.id}>
                  <td className="user-cell"><div className="row gap-s"><Avatar src={u.avatar_url} name={u.name} size={32} /><div><b>{u.name}</b><div className="muted small">{u.email}{u.phone && ` · ${u.phone}`}</div></div></div></td>
                  <td>
                    <Select value={u.role} disabled={u.id === me?.id} onChange={(e) => patch(u, { role: e.target.value as User["role"] }, t("{name} roli «{role}» ga o'zgartirilsinmi?",{name:u.name,role:ROLE_LABEL[e.target.value as User["role"]]}))}>
                      <option value="client">{t("Mijoz")}</option><option value="creator">{t("Ijodkor")}</option><option value="admin">{t("Admin")}</option>
                    </Select>
                  </td>
                  <td><PwCell u={u} onReset={() => resetPw(u)} /></td>
                  <td>
                    {!u.is_active ? <Badge tone="red">{t("Bloklangan")}</Badge> : u.is_verified ? <Badge tone="green">{t("Faol")}</Badge> : <Badge>{t("Email tasdiqlanmagan")}</Badge>}
                  </td>
                  <td className="nowrap small">{fmtDateTime(u.created_at)}</td>
                  <td className="nowrap">
                    {u.id !== me?.id && (u.is_active ?
                      <Button size="sm" variant="danger" onClick={() => patch(u, { is_active: false }, t("{name} bloklansinmi? U tizimga kira olmaydi.",{name:u.name}))}>{t("Bloklash")}</Button> :
                      <Button size="sm" variant="secondary" onClick={() => patch(u, { is_active: true })}>{t("Blokdan chiqarish")}</Button>)}
                    {!u.is_verified && <Button size="sm" variant="ghost" onClick={() => patch(u, { is_verified: true })}>{t("Emailni tasdiqlash")}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
      {node}
      {pw && <PwModal info={pw} onClose={() => setPw(null)} />}
    </>
  );
}

const DEMO_DOMAIN = "@demo.photomarket.uz";

function PwCell({ u, onReset }: { u: User; onReset: () => void }) {
  const [show, setShow] = useState(false);
  const demo = u.email.endsWith(DEMO_DOMAIN);
  return (
    <div className="pw-cell">
      {demo ? (
        <span className="pw-demo"><code>{show ? "Demo12345" : "••••••••"}</code>
          <button type="button" className="mini-eye" onClick={() => setShow((s) => !s)} aria-label={show ? t("Parolni yashirish") : t("Parolni ko'rsatish")}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button></span>
      ) : <span className="muted small" title={t("Parollar shifrlangan saqlanadi")}>••••••••</span>}
      <Button size="sm" variant="ghost" onClick={onReset}><KeyRound size={14} /> {t("Yangi parol")}</Button>
    </div>
  );
}

function PwModal({ info, onClose }: { info: { user: User; password: string }; onClose: () => void }) {
  const toast = useToast();
  const [show, setShow] = useState(true);
  const copy = async () => { try { await navigator.clipboard.writeText(info.password); toast(t("Nusxalandi")); } catch { /* */ } };
  return (
    <Modal open onClose={onClose} title={t("Yangi parol")}>
      <div className="stack">
        <p>{info.user.name} · <span className="muted">{info.user.email}</span></p>
        <div className="pay-ins-num">
          <b>{show ? info.password : "•".repeat(info.password.length)}</b>
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={t("Parolni ko'rsatish")}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          <button type="button" onClick={copy} aria-label={t("Nusxalash")}><Copy size={16} /></button>
        </div>
        <Alert kind="info">{t("Parol faqat hozir ko'rsatiladi. Uni foydalanuvchiga yuboring; u kirgach Sozlamalarda o'zgartirishi mumkin. Parollar xavfsizlik uchun shifrlangan saqlanadi, asl matnini ko'rib bo'lmaydi.")}</Alert>
        <div className="row-end"><Button onClick={onClose}>{t("Tayyor")}</Button></div>
      </div>
    </Modal>
  );
}
