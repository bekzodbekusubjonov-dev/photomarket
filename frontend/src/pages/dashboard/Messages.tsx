import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, SendHorizontal } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Avatar, Empty, Spinner } from "../../components/ui";
import { useUnread } from "../../components/unread";
import type { Conversation, Message, PublicUser } from "../../types";
import { ROLE_LABEL, clockTime, cx, fmtDate, timeAgo } from "../../utils";
import { t } from "../../i18n";

type Thread = { user: PublicUser; can_send: boolean; messages: Message[] };

export default function Messages() {
  const { userId } = useParams();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const { refresh } = useUnread();
  const loadConvs = useCallback(() => api.get<Conversation[]>("/messages/conversations").then(setConvs).catch(() => setConvs([])), []);
  useEffect(() => {
    document.title = t("Xabarlar — PhotoMarket");
    loadConvs();
    const iv = setInterval(() => document.visibilityState === "visible" && loadConvs(), 10000);
    return () => clearInterval(iv);
  }, [loadConvs]);

  return (
    <div className={cx("chat", userId && "has-thread")}>
      <aside className="chat-list">
        <h2>{t("Xabarlar")}</h2>
        {convs === null ? <Spinner /> : convs.length === 0 ? (
          <p className="muted small" style={{ padding: "0 16px" }}>{t("Hali suhbatlar yo'q. Ijodkor profilidan «Xabar yozish» tugmasini bosing.")}</p>
        ) : convs.map((c) => (
          <Link key={c.user.id} to={`/dashboard/messages/${c.user.id}`} className={cx("conv", String(c.user.id) === userId && "active")}>
            <Avatar src={c.user.avatar_url} name={c.user.display_name ?? c.user.name} size={42} />
            <div className="grow">
              <div className="row"><b className="ellipsis">{c.user.display_name ?? c.user.name}</b><span className="muted small push">{timeAgo(c.last_message.created_at)}</span></div>
              <div className="row"><span className="muted small ellipsis">{c.last_message.body}</span>{c.unread > 0 && <span className="side-badge push">{c.unread}</span>}</div>
            </div>
          </Link>
        ))}
      </aside>
      <section className="chat-thread">
        {userId ? <ThreadView key={userId} otherId={Number(userId)} onActivity={() => { loadConvs(); refresh(); }} /> :
          <Empty icon={<MessageCircle />} title={t("Suhbatni tanlang")} text={t("Chap tomondagi ro'yxatdan suhbatni tanlang.")} />}
      </section>
    </div>
  );
}

function ThreadView({ otherId, onActivity }: { otherId: number; onActivity: () => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [th, setT] = useState<Thread | null>(null);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  useEffect(() => {
    api.get<Thread>(`/messages/with/${otherId}`).then((r) => {
      setT(r);
      lastId.current = r.messages.at(-1)?.id ?? 0;
      onActivity();
    }).catch((e) => setErr(e.message));
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await api.get<Thread>(`/messages/with/${otherId}`, { after_id: lastId.current });
        if (r.messages.length) {
          lastId.current = r.messages.at(-1)!.id;
          setT((o) => o && { ...o, messages: [...o.messages, ...r.messages.filter((m) => !o.messages.some((x) => x.id === m.id))] });
          onActivity();
        }
      } catch { /* */ }
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [th?.messages.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const m = await api.post<Message>("/messages", { recipient_id: otherId, body });
      lastId.current = Math.max(lastId.current, m.id);
      setT((o) => o && { ...o, messages: [...o.messages, m] });
      setText("");
      onActivity();
    } catch (e) { setErr((e as Error).message); } finally { setSending(false); }
  };

  if (err && !th) return <Empty title={t("Suhbatni ochib bo'lmadi")} text={err} />;
  if (!th) return <Spinner />;
  const name = th.user.display_name ?? th.user.name;
  let lastDay = "";

  return (
    <>
      <div className="thread-head">
        <button className="icon-btn back-mobile" onClick={() => nav("/dashboard/messages")} aria-label={t("Ortga")}><ArrowLeft size={20} /></button>
        <Avatar src={th.user.avatar_url} name={name} size={40} />
        <div><b>{name}</b><div className="muted small">{ROLE_LABEL[th.user.role]}</div></div>
        {th.user.creator_id && <Link to={`/creators/${th.user.creator_id}`} className="btn btn-secondary btn-sm push">{t("Profil")}</Link>}
      </div>
      <div className="thread-body">
        {th.messages.length === 0 && <p className="muted center small">{t("Suhbatni boshlang — salomlashing va savolingizni yozing.")}</p>}
        {th.messages.map((m) => {
          const day = m.created_at.slice(0, 10);
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {sep && <div className="day-sep"><span>{fmtDate(day)}</span></div>}
              <div className={cx("bubble", m.sender_id === user!.id ? "mine" : "theirs")}>
                <p>{m.body}</p>
                <span>{clockTime(m.created_at)}{m.sender_id === user!.id && (m.is_read ? " ✓✓" : " ✓")}</span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {th.can_send ? (
        <form className="thread-input" onSubmit={send}>
          <textarea className="input" rows={1} placeholder={t("Xabar yozing...")} value={text} maxLength={4000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }} />
          <button className="btn btn-primary btn-md" disabled={sending || !text.trim()} aria-label={t("Yuborish")}><SendHorizontal size={18} /></button>
        </form>
      ) : <p className="muted small center thread-note">{t("Bu foydalanuvchiga hozircha yozib bo'lmaydi (mijoz birinchi yozishi yoki buyurtma berishi kerak).")}</p>}
      {err && th && <p className="field-error center">{err}</p>}
    </>
  );
}
