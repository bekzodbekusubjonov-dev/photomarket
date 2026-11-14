import { Eye } from "lucide-react";
import { useAuth } from "../auth";
import { t } from "../i18n";

/** Administrator foydalanuvchi ko'zi bilan (faqat o'qish) ko'rayotganda yuqorida chiqadi */
export function ViewAsBanner() {
  const { user, viewingAs, exitViewAs } = useAuth();
  if (!viewingAs || !user) return null;
  return (
    <div className="viewas-bar" role="status">
      <Eye size={16} />
      <span><b>{user.name}</b> ({user.role === "creator" ? t("ijodkor") : t("mijoz")}) {t("ko'zi bilan ko'rmoqdasiz — faqat o'qish rejimi, o'zgartirib bo'lmaydi")}</span>
      <button onClick={exitViewAs}>{t("Admin paneliga qaytish")}</button>
    </div>
  );
}
