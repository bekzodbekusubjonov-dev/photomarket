import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, CalendarDays, ClipboardList, Heart, Home, LayoutDashboard, LogOut, Menu, MessageCircle, Search, Settings, ShieldAlert, User as UserIcon, Users, X } from "lucide-react";
import { useAuth } from "../auth";
import { ROLE_LABEL, cx } from "../utils";
import { Avatar } from "./ui";
import { LangSwitch } from "./LangSwitch";
import { BrandMark } from "./Brand";
import { InstallButton } from "../pwa";
import { useUnread } from "./unread";
import { t } from "../i18n";

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label={t("PhotoMarket bosh sahifa")}>
      <BrandMark size={34} />
      <span>Photo<b>Market</b></span>
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  if (!user) return null;
  return (
    <div className="user-menu" ref={ref}>
      <button className="user-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu">
        <Avatar src={user.avatar_url} name={user.name} size={34} />
      </button>
      {open && (
        <div className="dropdown" role="menu" onClick={() => setOpen(false)}>
          <div className="dropdown-head">
            <b>{user.name}</b>
            <span>{user.email}</span>
            <span className="badge badge-accent" style={{ marginTop: 6 }}>{ROLE_LABEL[user.role]}</span>
          </div>
          <Link to="/dashboard"><LayoutDashboard size={16} /> {t("Kabinet")}</Link>
          <Link to="/dashboard/settings"><Settings size={16} /> {t("Sozlamalar")}</Link>
          <button onClick={() => { logout(); nav("/"); }}><LogOut size={16} /> {t("Chiqish")}</button>
        </div>
      )}
    </div>
  );
}

export function Header({ drawer }: { drawer?: { open: boolean; toggle: () => void } } = {}) {
  const { user } = useAuth();
  const { counts } = useUnread();
  const [mobile, setMobile] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMobile(false); }, [loc.pathname]);
  return (
    <header className="header">
      <div className="container header-inner">
        {drawer && (
          <button className="icon-btn drawer-btn" onClick={drawer.toggle} aria-label={t("Menyu")} aria-expanded={drawer.open}>
            {drawer.open ? <X size={22} /> : <Menu size={22} />}
          </button>
        )}
        <Logo />
        <nav className={cx("main-nav", mobile && "open")}>
          <NavLink to="/" end>{t("Bosh sahifa")}</NavLink>
          <NavLink to="/creators" end>{t("Ijodkorlar")}</NavLink>
          <NavLink to="/categories">{t("Kategoriyalar")}</NavLink>
          <NavLink to="/how-it-works">{t("Qanday ishlaydi")}</NavLink>
          <NavLink to="/about">{t("Biz haqimizda")}</NavLink>
          {!user && <Link to="/register?role=creator" className="nav-cta-mobile">{t("Ijodkor sifatida qo'shiling")}</Link>}
        </nav>
        <div className="header-actions">
          <InstallButton compact />
          <LangSwitch />
          {user ? (
            <>
              <Link to="/dashboard/messages" className="icon-btn hide-sm" aria-label={t("Xabarlar")}>
                <MessageCircle size={20} />
                {counts.messages > 0 && <span className="dot-count">{counts.messages}</span>}
              </Link>
              <Link to="/dashboard/notifications" className="icon-btn" aria-label={t("Bildirishnomalar")}>
                <Bell size={20} />
                {counts.notifications > 0 && <span className="dot-count">{counts.notifications}</span>}
              </Link>
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-md hide-sm">{t("Kirish")}</Link>
              <Link to="/register" className="btn btn-primary btn-md">{t("Ro'yxatdan o'tish")}</Link>
            </>
          )}
          <button className={cx("icon-btn burger", drawer && "no-drawer-burger")} onClick={() => setMobile((m) => !m)} aria-label={t("Menyu")}>
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <Logo />
          <p className="muted">{t("O'zbekistondagi fotograf va videograflarni topish, solishtirish va onlayn buyurtma qilish platformasi.")}</p>
        </div>
        <div>
          <h4>{t("Mijozlar uchun")}</h4>
          <Link to="/creators">{t("Ijodkor topish")}</Link>
          <Link to="/how-it-works">{t("Qanday ishlaydi")}</Link>
          <Link to="/register">{t("Ro'yxatdan o'tish")}</Link>
          <Link to="/categories">{t("Kategoriyalar")}</Link>
          <Link to="/about">{t("Biz haqimizda")}</Link>
        </div>
        <div>
          <h4>{t("Ijodkorlar uchun")}</h4>
          <Link to="/register?role=creator">{t("Profil ochish")}</Link>
          <Link to="/dashboard/portfolio">{t("Portfolio")}</Link>
          <Link to="/dashboard/calendar">{t("Bandlik kalendari")}</Link>
        </div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} {t("PhotoMarket")}</span><span>{t("Namuna rasmlar:")} <a href="https://www.pexels.com" target="_blank" rel="noreferrer">{t("Pexels")}</a></span></div>
    </footer>
  );
}

export function BottomNav() {
  const { user } = useAuth();
  const { counts } = useUnread();
  if (!user) return null;
  type It = { to: string; label: string; icon: ReactNode; end?: boolean; badge?: number };
  const sets: Record<string, It[]> = {
    client: [
      { to: "/dashboard", label: t("Bosh"), icon: <Home size={20} />, end: true },
      { to: "/creators", label: t("Qidirish"), icon: <Search size={20} /> },
      { to: "/dashboard/bookings", label: t("Buyurtmalar"), icon: <ClipboardList size={20} /> },
      { to: "/dashboard/favorites", label: t("Sevimli"), icon: <Heart size={20} /> },
      { to: "/dashboard/settings", label: t("Profil"), icon: <UserIcon size={20} /> },
    ],
    creator: [
      { to: "/dashboard", label: t("Bosh"), icon: <Home size={20} />, end: true },
      { to: "/dashboard/bookings", label: t("Buyurtmalar"), icon: <ClipboardList size={20} /> },
      { to: "/dashboard/calendar", label: t("Kalendar"), icon: <CalendarDays size={20} /> },
      { to: "/dashboard/messages", label: t("Xabarlar"), icon: <MessageCircle size={20} />, badge: counts.messages },
      { to: "/dashboard/profile", label: t("Profil"), icon: <UserIcon size={20} /> },
    ],
    admin: [
      { to: "/dashboard", label: t("Bosh"), icon: <Home size={20} />, end: true },
      { to: "/dashboard/admin/users", label: t("Foydalanuvchilar"), icon: <Users size={20} /> },
      { to: "/dashboard/bookings", label: t("Buyurtmalar"), icon: <ClipboardList size={20} /> },
      { to: "/dashboard/complaints", label: t("Shikoyatlar"), icon: <ShieldAlert size={20} /> },
      { to: "/dashboard/admin/settings", label: t("Sozlamalar"), icon: <Settings size={20} /> },
    ],
  };
  return (
    <nav className="bottom-nav" aria-label="Mobile">
      {sets[user.role].map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className="bn-item">
          <span className="bn-icon">{it.icon}{!!it.badge && <i className="bn-dot">{it.badge}</i>}</span>
          <span>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function PublicLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <Header />
      <main className="main"><Outlet /></main>
      <Footer />
      <BottomNav />
    </>
  );
}
