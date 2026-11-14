import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "../../api";
import { Button, Empty, PageHead, Pagination, Spinner, useAsync } from "../../components/ui";
import { useUnread } from "../../components/unread";
import type { Notification, Paged } from "../../types";
import { cx, timeAgo } from "../../utils";
import { t } from "../../i18n";

export default function Notifications() {
  const nav = useNavigate();
  const { refresh } = useUnread();
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useAsync(() => api.get<Paged<Notification>>("/notifications", { page }), [page]);
  const open = async (n: Notification) => {
    if (!n.is_read) { await api.post(`/notifications/${n.id}/read`).catch(() => {}); refresh(); }
    if (n.link) nav(n.link); else reload();
  };
  const readAll = async () => { await api.post("/notifications/read-all"); refresh(); reload(); };
  return (
    <>
      <PageHead title={t("Bildirishnomalar")} actions={<Button variant="secondary" onClick={readAll}><CheckCheck size={17} /> {t("Barchasini o'qilgan qilish")}</Button>} />
      {loading && !data ? <Spinner /> : data?.items.length ? (
        <div className="card flush">
          {data.items.map((n) => (
            <button key={n.id} className={cx("notif", !n.is_read && "unread")} onClick={() => open(n)}>
              <span className="notif-dot" />
              <div className="grow"><b>{n.title}</b>{n.body && <p className="muted small">{n.body}</p>}</div>
              <span className="muted small nowrap">{timeAgo(n.created_at)}</span>
            </button>
          ))}
        </div>
      ) : <Empty icon={<Bell />} title={t("Bildirishnomalar yo'q")} text={t("Buyurtma, xabar va sharhlar haqida shu yerda xabar beramiz.")} />}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </>
  );
}
