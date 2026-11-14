import { useState } from "react";
import { Star } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Avatar, Button, Empty, PageHead, Spinner, Stars, Textarea, useAsync, useToast } from "../../components/ui";
import type { Review } from "../../types";
import { timeAgo } from "../../utils";
import { t } from "../../i18n";

export default function Reviews() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, setData, loading } = useAsync(() => api.get<Review[]>(user?.role === "client" ? "/reviews/given" : "/reviews/mine"), []);
  const [reply, setReply] = useState<Record<number, string>>({});
  const send = async (r: Review) => {
    try {
      const nr = await api.post<Review>(`/reviews/${r.id}/reply`, { reply: reply[r.id] });
      setData((o) => o!.map((x) => x.id === nr.id ? nr : x));
      toast(t("Javob saqlandi"));
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const avg = data?.length ? data.reduce((a, r) => a + r.rating, 0) / data.length : 0;
  return (
    <>
      <PageHead title={t("Sharhlar")} sub={data?.length ? <><Stars value={avg} showValue /> · {data.length} {t("ta sharh")}</> : undefined} />
      {loading ? <Spinner /> : data?.length ? (
        <div className="reviews">
          {data.map((r) => (
            <article key={r.id} className="card review">
              <div className="row gap-s">
                <Avatar src={r.client?.avatar_url} name={r.client?.name ?? t("Mijoz")} size={38} />
                <div><b>{user?.role === "client" ? r.creator_name : r.client?.name}</b><div className="muted small">{timeAgo(r.created_at)} {t("· buyurtma #")}{r.booking_id}</div></div>
                <span className="push"><Stars value={r.rating} /></span>
              </div>
              {r.comment && <p>{r.comment}</p>}
              {r.reply ? <div className="review-reply"><b>{t("Sizning javobingiz:")}</b> {r.reply}</div> : user?.role === "creator" && (
                <div className="stack">
                  <Textarea rows={2} placeholder={t("Mijozga javob yozing (ommaviy ko'rinadi)...")} value={reply[r.id] ?? ""} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} />
                  <div><Button size="sm" disabled={!reply[r.id]?.trim()} onClick={() => send(r)}>{t("Javob berish")}</Button></div>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : <Empty icon={<Star />} title={t("Hali sharhlar yo'q")} text={t("Buyurtma bajarilgandan so'ng mijozlar sharh qoldiradi.")} />}
    </>
  );
}
