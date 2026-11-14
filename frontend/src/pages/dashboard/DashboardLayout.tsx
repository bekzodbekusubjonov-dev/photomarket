import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3, Bell, CalendarDays, Camera, ClipboardList, CreditCard, Heart, Images, LayoutDashboard, MessageCircle, Package, Search,
  Settings, ShieldAlert, ShieldCheck, SlidersHorizontal, Star, Tags, UserCircle, Users, Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../../auth";
import { BottomNav, Header } from "../../components/Layout";
import { Spinner } from "../../components/ui";
import { useUnread } from "../../components/unread";
import type { Role } from "../../types";
import { t } from "../../i18n";

type Item = { to: string; label: string; icon: ReactNode; end?: boolean; badge?: number };

export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function DashboardLayout() {
  const { user } = useAuth();
  const { counts } = useUnread();
  if (!user) return null;
  const common: Item[] = [
    { to: "/dashboard", label: t("Umumiy ko'rinish"), icon: <LayoutDashboard size={18} />, end: true },
    { to: "/dashboard/bookings", label: user.role === "admin" ? t("Barcha buyurtmalar") : t("Buyurtmalar"), icon: <ClipboardList size={18} /> },
    { to: "/dashboard/messages", label: t("Xabarlar"), icon: <MessageCircle size={18} />, badge: counts.messages },
    { to: "/dashboard/notifications", label: t("Bildirishnomalar"), icon: <Bell size={18} />, badge: counts.notifications },
  ];
  const creator: Item[] = [
    { to: "/dashboard/profile", label: t("Profilim"), icon: <UserCircle size={18} /> },
    { to: "/dashboard/portfolio", label: t("Portfolio"), icon: <Images size={18} /> },
    { to: "/dashboard/services", label: t("Xizmatlar (paketlar)"), icon: <Package size={18} /> },
    { to: "/dashboard/calendar", label: t("Bandlik kalendari"), icon: <CalendarDays size={18} /> },
    { to: "/dashboard/earnings", label: t("Daromad"), icon: <Wallet size={18} /> },
    { to: "/dashboard/payments", label: t("To'lovlar tarixi"), icon: <CreditCard size={18} /> },
    { to: "/dashboard/reviews", label: t("Sharhlar"), icon: <Star size={18} /> },
  ];
  const client: Item[] = [
    { to: "/dashboard/calendar", label: t("Kalendar"), icon: <CalendarDays size={18} /> },
    { to: "/dashboard/favorites", label: t("Sevimlilar"), icon: <Heart size={18} /> },
    { to: "/dashboard/payments", label: t("To'lovlar tarixi"), icon: <CreditCard size={18} /> },
    { to: "/dashboard/reviews", label: t("Mening sharhlarim"), icon: <Star size={18} /> },
    { to: "/dashboard/complaints", label: t("Shikoyatlar"), icon: <ShieldAlert size={18} /> },
    { to: "/creators", label: t("Ijodkor topish"), icon: <Search size={18} /> },
  ];
  const admin: Item[] = [
    { to: "/dashboard/admin/users", label: t("Foydalanuvchilar"), icon: <Users size={18} /> },
    { to: "/dashboard/admin/creators", label: t("Ijodkorlar"), icon: <Camera size={18} /> },
    { to: "/dashboard/admin/reviews", label: t("Sharhlar moderatsiyasi"), icon: <ShieldCheck size={18} /> },
    { to: "/dashboard/admin/categories", label: t("Kategoriyalar"), icon: <Tags size={18} /> },
    { to: "/dashboard/payments", label: t("To'lovlar tarixi"), icon: <CreditCard size={18} /> },
    { to: "/dashboard/complaints", label: t("Shikoyatlar"), icon: <ShieldAlert size={18} /> },
    { to: "/dashboard/admin/analytics", label: t("Tahlil"), icon: <BarChart3 size={18} /> },
    { to: "/dashboard/admin/settings", label: t("Platforma sozlamalari"), icon: <SlidersHorizontal size={18} /> },
  ];
  const groups: [string, Item[]][] = [[t("Asosiy"), common]];
  if (user.role === "creator") groups.push([t("Ijodkor"), creator]);
  if (user.role === "client") groups.push([t("Mijoz"), client]);
  if (user.role === "admin") groups.push([t("Administrator"), admin]);
  groups.push([t("Hisob"), [{ to: "/dashboard/settings", label: t("Sozlamalar"), icon: <Settings size={18} /> }]]);

  return (
    <>
      <Header />
      <div className="dash">
        <aside className="dash-side">
          {groups.map(([title, items]) => (
            <div key={title} className="side-group">
              <span className="side-title">{title}</span>
              {items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className="side-link">
                  {it.icon}<span>{it.label}</span>{!!it.badge && <span className="side-badge">{it.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </aside>
        <main className="dash-main"><Outlet /></main>
      </div>
      <BottomNav />
    </>
  );
}
