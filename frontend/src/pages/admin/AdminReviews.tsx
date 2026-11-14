import { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { api } from "../../api";
import { Avatar, Button, Empty, PageHead, Pagination, Spinner, Stars, useAsync, useConfirm, useToast } from "../../components/ui";
import type { Paged, Review } from "../../types";
import { timeAgo } from "../../utils";
import { t } from "../../i18n";

export default function AdminReviews() {
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useAsync(() => api.get<Paged<Review>>("/admin/reviews", { page }), [page]);
  const remove = async (r: Review) => {
    if (!(await confirm(t("Sharh o'chiriladi va ijodkor reytingi qayta hisoblanadi.")))) return;
    await api.del(`/admin/reviews/${r.id}`);
    toast(t("Sharh o'chirildi"));
    reload();
  };
  return (
    <>
      <PageHead title={t("Sharhlar moderatsiyasi")} sub={t("Haqoratli yoki soxta sharhlarni o'chiring")} />
      {loading && !data ? <Spinner /> : data?.items.length ? (
        <div className="reviews">
          {data.items.map((r) => (
            <article key={r.id} className="card review">
              <div className="row gap-s">
                <Avatar src={r.client?.avatar_url} name={r.client?.name ?? "?"} size={36} />
                <div><b>{r.client?.name}</b> → <Link to={`/creators/${r.creator_id}`}>{r.creator_name}</Link><div className="muted small">{timeAgo(r.created_at)}</div></div>
                <span className="push"><Stars value={r.rating} /></span>
                <Button size="sm" variant="ghost" onClick={() => remove(r)}><Trash2 size={16} /></Button>
              </div>
              {r.comment && <p>{r.comment}</p>}
              {r.reply && <div className="review-reply"><b>{t("Javob:")}</b> {r.reply}</div>}
            </article>
          ))}
        </div>
      ) : <Empty title={t("Sharhlar yo'q")} />}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
      {node}
    </>
  );
}
