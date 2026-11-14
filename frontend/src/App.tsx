import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { PublicLayout } from "./components/Layout";
import { BackGuard } from "./pwa";
import { Spinner } from "./components/ui";
import Home from "./pages/Home";
import { About, HowItWorks, NotFound } from "./pages/Static";
import DashboardLayout, { RequireAuth } from "./pages/dashboard/DashboardLayout";

const Categories = lazy(() => import("./pages/Categories"));
const Favorites = lazy(() => import("./pages/dashboard/Favorites"));
const Payments = lazy(() => import("./pages/dashboard/Payments"));
const Complaints = lazy(() => import("./pages/dashboard/Complaints"));
const Earnings = lazy(() => import("./pages/creator/Earnings"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const Creators = lazy(() => import("./pages/Creators"));
const CreatorProfile = lazy(() => import("./pages/CreatorProfile"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const Verify = lazy(() => import("./pages/auth/Verify"));
const Forgot = lazy(() => import("./pages/auth/Forgot"));
const Overview = lazy(() => import("./pages/dashboard/Overview"));
const Bookings = lazy(() => import("./pages/dashboard/Bookings"));
const BookingDetail = lazy(() => import("./pages/dashboard/BookingDetail"));
const Messages = lazy(() => import("./pages/dashboard/Messages"));
const Notifications = lazy(() => import("./pages/dashboard/Notifications"));
const Settings = lazy(() => import("./pages/dashboard/Settings"));
const ProfileEdit = lazy(() => import("./pages/creator/ProfileEdit"));
const Portfolio = lazy(() => import("./pages/creator/Portfolio"));
const Services = lazy(() => import("./pages/creator/Services"));
const Calendar = lazy(() => import("./pages/creator/Calendar"));
const Reviews = lazy(() => import("./pages/creator/Reviews"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminCreators = lazy(() => import("./pages/admin/AdminCreators"));
const Contracts = lazy(() => import("./pages/dashboard/Contracts"));
const ContractView = lazy(() => import("./pages/dashboard/ContractView"));
const Cards = lazy(() => import("./pages/dashboard/Cards"));
const ReceiptPage = lazy(() => import("./pages/dashboard/Receipt"));
const ContractCheck = lazy(() => import("./pages/Verify"));
const AdminReport = lazy(() => import("./pages/admin/AdminReport"));
const AdminAds = lazy(() => import("./pages/admin/AdminAds"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <BackGuard />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="creators" element={<Creators />} />
          <Route path="creators/:id" element={<CreatorProfile />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="about" element={<About />} />
          <Route path="categories" element={<Categories />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="verify" element={<Verify />} />
        <Route path="check/:number" element={<ContractCheck />} />
        <Route path="forgot-password" element={<Forgot />} />
        <Route path="dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
          <Route index element={<Overview />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="bookings/:id" element={<BookingDetail />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:userId" element={<Messages />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
          <Route path="calendar" element={<RequireAuth roles={["creator", "client"]}><Calendar /></RequireAuth>} />
          <Route path="profile" element={<RequireAuth roles={["creator"]}><ProfileEdit /></RequireAuth>} />
          <Route path="portfolio" element={<RequireAuth roles={["creator"]}><Portfolio /></RequireAuth>} />
          <Route path="services" element={<RequireAuth roles={["creator"]}><Services /></RequireAuth>} />
          <Route path="reviews" element={<RequireAuth roles={["creator", "client"]}><Reviews /></RequireAuth>} />
          <Route path="favorites" element={<RequireAuth roles={["client"]}><Favorites /></RequireAuth>} />
          <Route path="payments" element={<Payments />} />
          <Route path="payments/:id/receipt" element={<ReceiptPage />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="contracts/:id" element={<ContractView />} />
          <Route path="cards" element={<RequireAuth roles={["creator", "client"]}><Cards /></RequireAuth>} />
          <Route path="admin/reports/:kind" element={<RequireAuth roles={["admin"]}><AdminReport /></RequireAuth>} />
          <Route path="admin/ads" element={<RequireAuth roles={["admin"]}><AdminAds /></RequireAuth>} />
          <Route path="complaints" element={<RequireAuth roles={["client", "admin"]}><Complaints /></RequireAuth>} />
          <Route path="earnings" element={<RequireAuth roles={["creator"]}><Earnings /></RequireAuth>} />
          <Route path="admin/categories" element={<RequireAuth roles={["admin"]}><AdminCategories /></RequireAuth>} />
          <Route path="admin/settings" element={<RequireAuth roles={["admin"]}><AdminSettings /></RequireAuth>} />
          <Route path="admin/analytics" element={<RequireAuth roles={["admin"]}><AdminAnalytics /></RequireAuth>} />
          <Route path="admin/users" element={<RequireAuth roles={["admin"]}><AdminUsers /></RequireAuth>} />
          <Route path="admin/creators" element={<RequireAuth roles={["admin"]}><AdminCreators /></RequireAuth>} />
          <Route path="admin/reviews" element={<RequireAuth roles={["admin"]}><AdminReviews /></RequireAuth>} />
        </Route>
      </Routes>
    </Suspense>
  );
}
