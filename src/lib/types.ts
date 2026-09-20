export type Visibility =
  "private" | "friends_status" | "friends_status_and_venue";
export type AvailabilityMode =
  "available" | "open_to_join" | "busy" | "dnd" | null;
export interface User {
  password_enabled?: number;
  id: string;
  name: string;
  handle: string;
  email: string;
  verified: number;
  role: "student" | "admin";
  sharing: number;
  notify: number;
  created_at: number;
}
export interface Spot {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  timezone: string;
  power: string;
  wifi: string;
  coffee: string;
  noise: number;
  access: string;
  access_note: string;
  hours: string;
  website: string;
  accessibility: string;
  image: string;
  demo: number;
  published: number;
  verified_at: number | null;
  source: string;
  group_size: number | null;
  booking_url: string;
  mapped?: number;
  city?: string;
  photo_url?: string;
  photo_credit?: string;
  photo_source?: string;
  imported_at?: number | null;
}
export interface Room {
  id: string;
  spot_id: string;
  name: string;
  capacity: number;
  demo: number;
  enabled: number;
  policy_version: number;
}
export interface Booking {
  id: string;
  user_id: string;
  room_id: string;
  starts_at: number;
  ends_at: number;
  party_size: number;
  status: string;
  policy_version: number;
  created_at: number;
  room_name?: string;
  spot_name?: string;
  spot_id?: string;
  demo?: number;
}
export interface StudySession {
  id: string;
  user_id: string;
  spot_id: string | null;
  state:
    | "running"
    | "paused"
    | "awaiting_confirmation"
    | "completed"
    | "cancelled"
    | "abandoned";
  visibility: Visibility;
  target_seconds: number;
  focus_seconds: number;
  started_at: number;
  segment_started_at: number | null;
  last_heartbeat_at: number;
  ended_at: number | null;
  revision: number;
  share_completion: number;
  spot_name?: string;
}
export interface Availability {
  user_id: string;
  mode: AvailabilityMode;
  session_id: string | null;
  expires_at: number | null;
  revision: number;
}
export interface Hop {
  id: string;
  user_id: string;
  spot_id: string;
  target_user_id: string;
  target_session_id: string;
  state: "on_way" | "arrived" | "cancelled" | "expired";
  eta_at: number | null;
  expires_at: number;
  revision: number;
  created_at: number;
  ended_at: number | null;
  spot_name?: string;
  target_name?: string;
  delivery?: string;
}
export interface Review {
  id: string;
  user_id: string;
  spot_id: string;
  rating: number;
  noise: number;
  crowd: number;
  notes: string;
  visit_date: string;
  created_at: number;
  updated_at: number;
  hidden: number;
  name?: string;
  handle?: string;
  likes?: number;
  liked?: number;
  spot_name?: string;
}
export interface Friend {
  id: string;
  name: string;
  handle: string;
  relationship: string;
  sender_id: string;
  status: string;
  expires_at: number | null;
  session_id?: string;
  spot_id?: string;
  spot_name?: string;
  can_hop: boolean;
}
export interface Conditions {
  state: "insufficient_data" | "conflicting_reports" | "recent_reports";
  level?: number;
  noise?: number;
  evidence?: string;
  sampleBucket?: string;
  asOf?: number;
  expiresAt?: number;
}
export interface SpotSummary extends Spot {
  saved: boolean;
  conditions: Conditions;
  rating: number | null;
  review_count: number;
  rooms: number;
  distance?: number;
  fit?: string[];
  open?: boolean | null;
}
export interface Notification {
  id: string;
  kind: string;
  message: string;
  href: string;
  read_at: number | null;
  created_at: number;
}
export interface Bootstrap {
  user: User | null;
  session: StudySession | null;
  hop: Hop | null;
  availability: Availability | null;
  notifications: Notification[];
  serverTime: number;
  demo: boolean;
  emailEnabled: boolean;
  premium?: boolean;
  billingEnabled?: boolean;
  aiEnabled?: boolean;
  googleEnabled?: boolean;
  firebase?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  } | null;
  progress?: import("./rewards").Progress | null;
}

export type DirectorySpot = Omit<
  SpotSummary,
  | "source"
  | "hours"
  | "access_note"
  | "accessibility"
  | "website"
  | "timezone"
  | "published"
  | "booking_url"
  | "imported_at"
>;
