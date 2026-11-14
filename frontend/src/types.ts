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
  lat?: number | null;
  lng?: number | null;
  distance_km?: number | null;
}

export interface CreatorFull extends CreatorCard {
  bio: string;
  instagram: string;
  telegram: string;
  address?: string;
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
  lat?: number | null;
  lng?: number | null;
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

export interface BankCard { id: number; holder: string; brand: string; masked: string; last4: string; exp: string; is_default: boolean }

export interface ContractTerm { n: number; id: string; title: string; text: string }
export interface Contract {
  id: number; number: string; booking_id: number; title: string; category: Category; price: number;
  commission_percent: number; platform_fee: number; creator_amount: number; status: "awaiting" | "signed" | "cancelled" | "void";
  created_at: string; event_date: string | null; client: { id: number; name: string }; creator: { id: number; name: string };
  client_signed_at: string | null; creator_signed_at: string | null; cancel_fee: number; cancel_to_platform: number;
  cancel_to_creator: number; hash_short: string;
}
export interface ContractFull extends Contract {
  doc_hash: string; terms: ContractTerm[]; cancel_free_days: number; cancel_fee_percent: number; cancel_platform_share: number;
  event: { date: string; start_time: string; duration_hours: number; location: string } | null;
  client_sign_name: string; creator_sign_name: string; client_signature: string; creator_signature: string;
  client_contact: { email: string; phone: string | null } | null; creator_contact: { email: string; phone: string | null } | null;
  my_side: "client" | "creator" | ""; can_sign: boolean;
}

export interface AdItem { id: number; title: string; text: string; image_url: string; link_url: string; advertiser: string; placement: string;
  active?: boolean; starts_on?: string | null; ends_on?: string | null; views?: number; clicks?: number; position?: number; ctr?: number }

export interface Receipt {
  id: number; receipt_no: string; status: string; approved: boolean; date: string; booking_id: number; booking_title: string;
  event_date: string | null; client: string; creator: string; amount: number; fee: number; creator_amount: number;
  method: string; method_label: string; card: string; contract_no: string; barcode: string; signature: string;
}
