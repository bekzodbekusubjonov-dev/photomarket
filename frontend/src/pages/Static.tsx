import { Link } from "react-router-dom";
import { Camera, CalendarCheck, Heart, Users, MessageCircle, Search, ShieldCheck, Star, UserCheck } from "lucide-react";
import { Empty, LinkButton, PageHead } from "../components/ui";
import { t } from "../i18n";

export function HowItWorks() {
  return (
    <div className="container page narrow">
      <PageHead title={t("Qanday ishlaydi")} sub={t("Mijozlar va ijodkorlar uchun qisqa yo'riqnoma")} />
      <div className="steps steps-list">
        <div className="step"><Search /><h3>{t("1. Ijodkorni toping")}</h3><p>{t("Katalogda shahar, yo'nalish (to'y, portret, reklama...), narx, reyting va bo'sh sana bo'yicha filtrlang. Portfolio, xizmat paketlari va mijozlar sharhlarini solishtiring.")}</p></div>
        <div className="step"><UserCheck /><h3>{t("2. Ro'yxatdan o'ting")}</h3><p>{t("Email manzilingizga 6 xonali kod keladi — uni kiritib hisobingizni tasdiqlaysiz. Bu soxta hisoblardan himoya qiladi.")}</p></div>
        <div className="step"><CalendarCheck /><h3>{t("3. Buyurtma bering")}</h3><p>{t("Paketni tanlang, sana, vaqt va manzilni kiriting. Ijodkor emailiga va kabinetiga xabar boradi. U qabul qilsa, kontaktlar ochiladi va sana kalendarda band bo'ladi.")}</p></div>
        <div className="step"><MessageCircle /><h3>{t("4. Kelishib oling")}</h3><p>{t("Ichki chat orqali tafsilotlarni (uslub, joy, kiyim, suratlar soni) muhokama qiling. Holat o'zgarishi haqida bildirishnoma olasiz.")}</p></div>
        <div className="step"><Star /><h3>{t("5. Baho qoldiring")}</h3><p>{t("Ish bajarilgach, sharh va 1–5 yulduzli baho qoldiring. Reyting boshqa mijozlarga to'g'ri tanlov qilishga yordam beradi.")}</p></div>
        <div className="step"><ShieldCheck /><h3>{t("Ijodkorlar uchun")}</h3><p>{t("Bepul profil, portfolio galereyasi, narx paketlari, bandlik kalendari, statistika va sharhlarga javob — barchasi bitta kabinetda. Admin tekshirgan profillar «Tasdiqlangan» belgisini oladi.")}</p></div>
      </div>
      <div className="row gap-s center-row"><LinkButton to="/creators">{t("Ijodkor topish")}</LinkButton><LinkButton to="/register?role=creator" variant="secondary">{t("Ijodkor bo'lib qo'shilish")}</LinkButton></div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="container page">
      <Empty title={t("Sahifa topilmadi (404)")} text={t("Manzil noto'g'ri yoki sahifa o'chirilgan.")} action={<LinkButton to="/">{t("Bosh sahifa")}</LinkButton>} />
    </div>
  );
}

export function About() {
  return (
    <div className="container page narrow">
      <PageHead title={t("Biz haqimizda")} sub={t("PhotoMarket — fotograf va videograflarni mijozlar bilan bog'laydigan platforma")} />
      <div className="steps steps-list">
        <div className="step"><Camera /><h3>{t("Maqsadimiz")}</h3><p>{t("O'zbekistondagi ijodkorlarga mijoz topishni, mijozlarga esa ishonchli fotograf va videograf tanlashni oson va shaffof qilish.")}</p></div>
        <div className="step"><ShieldCheck /><h3>{t("Ishonch")}</h3><p>{t("Email bilan tasdiqlangan hisoblar, admin tekshirgan profillar, haqiqiy mijoz sharhlari va shikoyat tizimi xavfsiz tanlovni ta'minlaydi.")}</p></div>
        <div className="step"><Users /><h3>{t("Jamoa uchun")}</h3><p>{t("Ijodkorlar bepul profil, portfolio, narx paketlari va bandlik kalendariga ega bo'ladi; mijozlar esa buyurtmalar, to'lovlar va sevimlilarni bir joyda boshqaradi.")}</p></div>
        <div className="step"><Heart /><h3>{t("Aloqa")}</h3><p>{t("Savol yoki takliflaringiz bo'lsa, kabinetdagi chat orqali yoki administratorga murojaat qiling.")}</p></div>
      </div>
      <div className="row gap-s center-row"><LinkButton to="/creators">{t("Ijodkor topish")}</LinkButton><Link className="btn btn-secondary btn-md" to="/how-it-works">{t("Qanday ishlaydi")}</Link></div>
    </div>
  );
}
