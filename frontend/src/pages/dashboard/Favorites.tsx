import { api } from "../../api";
import { CreatorCard } from "../../components/CreatorCard";
import { Empty, LinkButton, PageHead, Spinner, useAsync } from "../../components/ui";
import type { CreatorCard as C } from "../../types";
import { useFavorites } from "../../favorites";
import { t } from "../../i18n";

export default function Favorites() {
  const { ids } = useFavorites();
  const { data, loading } = useAsync(() => api.get<C[]>("/favorites"), []);
  const items = (data ?? []).filter((c) => ids.has(c.id) || !ids.size);
  return (
    <>
      <PageHead title={t("Sevimli ijodkorlar")} sub={t("Yoqqan fotograf va videograflaringiz bir joyda")} />
      {loading ? <Spinner /> : items.length ? (
        <div className="grid-cards">{items.map((c) => <CreatorCard key={c.id} c={c} />)}</div>
      ) : <Empty title={t("Hali sevimlilar yo'q")} text={t("Ijodkor kartasidagi yurakcha tugmasini bosing — u shu yerga tushadi.")}
          action={<LinkButton to="/creators">{t("Ijodkor topish")}</LinkButton>} />}
    </>
  );
}
