export type Role = "client" | "creator" | "admin";
export type Category = "photographer" | "videographer" | "both";
export type BookingStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed";

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  avatar_url: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  creator_id: number | null;
}

export interface PublicUser {
  id: number;
  name: string;
  avatar_url: string;
  role: Role;
  creator_id?: number;
  display_name?: string;
}

export interface PortfolioItem {
  id: number;
  image_url: string;
  title: string;
  category: string;
  position: number;
  created_at: string;
}

export interface Service {
  id: number;
  title: string;
  description: string;
  price: number;
  duration_hours: number;
  active: boolean;
}

export interface CreatorCard {
  id: number;
  user_id: number;
  display_name: string;
  category: Category;
  city: string;
  price_from: number;
  rating: number;
  reviews_count: number;
  completed_count: number;
  specialties: string[];
  experience_years: number;
  avatar_url: string;
  cover_url: string;
  verified: boolean;
  featured: boolean;
  active: boolean;
  preview: string[];
  email?: string;
  user_active?: boolean;
  portfolio_count?: number;
}

export interface CreatorFull extends CreatorCard {
  bio: string;
  instagram: string;
  telegram: string;
  own_cover_url: string;
  created_at: string;
  portfolio: PortfolioItem[];
  services: Service[];
  rating_breakdown?: Record<string, number>;
  completeness?: number;
}

export interface Review {
  id: number;
  booking_id: number;
  creator_id: number;
  rating: number;
  comment: string;
  reply: string;
  created_at: string;
  client: PublicUser | null;
  creator_name: string;
}

export interface Booking {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  duration_hours: number;
  location: string;
  price: number | null;
  status: BookingStatus;
  status_label: string;
  status_note: string;
  created_at: string;
  updated_at: string;
  client: PublicUser | null;
  creator: { id: number; display_name: string; user_id: number; avatar_url: string; city: string };
  service: { id: number; title: string } | null;
  has_review: boolean;
  details?: string;
  review?: Review | null;
  client_contact?: { email: string; phone: string | null } | null;
  creator_contact?: { email: string; phone: string | null; telegram: string } | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface Message {
  id: number;
  sender_id: number;
  recipient_id: number;
  booking_id: number | null;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  user: PublicUser;
  last_message: Message;
  unread: number;
}

export interface Notification {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface SeriesPoint {
  label: string;
  bookings: number;
  completed: number;
  revenue: number;
}
