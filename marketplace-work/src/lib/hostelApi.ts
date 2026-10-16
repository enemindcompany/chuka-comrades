import { auth } from "./firebase";

export type HostelManagerRole = "landlord" | "caretaker";
export type HousingStatus = "have_hostel" | "looking";
export interface RoommateProfile {
  firebase_uid: string; display_name: string; course: string; year_of_study: string;
  housing_status: HousingStatus; preferred_area: string; monthly_budget_ksh: number;
  hostel_name: string | null; bio: string; contact_phone: string | null; created_at: string; updated_at: string;
  connected?: boolean;
}
export interface ConnectionProposal {
  id: string; requester_uid: string; target_uid: string; status: "pending" | "accepted" | "declined";
  created_at: string; updated_at?: string;
}

export interface HostelManager {
  firebase_uid: string;
  email: string;
  role: HostelManagerRole;
  phone: string;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
}

export interface HostelListing {
  id: string;
  created_by: string;
  manager_email: string;
  manager_role: HostelManagerRole;
  name: string;
  area: string;
  address: string;
  rent_ksh: number;
  deposit_ksh: number;
  room_type: string;
  vacancies: number;
  phone: string;
  description: string;
  amenities: string[];
  image_url: string | null;
  image_urls: string[];
  is_available: boolean;
  listing_status: "available" | "booked" | "closed";
  listing_fee_ksh: number;
  payment_status: "unpaid" | "pending_review" | "paid" | "rejected";
  payment_reference: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  payment_verified_by: string | null;
  created_at: string;
  updated_at: string;
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, "");
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

async function request<T>(resource: "listings" | "manager" | "manager-requests" | "roommates" | "images" | "listing-payments", method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in with Google to use hostel listings.");
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Hostel service is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.");
  }

  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/hostel-api?resource=${resource}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    console.error("Hostel API network error:", error);
    const siteOrigin = typeof window !== "undefined" ? window.location.origin : "your website origin";
    throw new Error(`The browser could not connect to hostel-api. Check VITE_SUPABASE_URL, deploy hostel-api, and include exactly ${siteOrigin} in FRONTEND_ORIGINS (no trailing slash). A CORS block can look like a network error.`);
  }

  const result = await response.json().catch(() => ({})) as { error?: string; message?: string; image_url?: string; listings?: T; managers?: T; manager?: T; listing?: T; roommates?: T; roommate?: T; proposal?: T; own_profile?: RoommateProfile | null; proposals?: ConnectionProposal[] };
  if (!response.ok) {
    throw new Error(result.error || `Hostel request failed (HTTP ${response.status}).`);
  }
  if (resource === "listings" || resource === "listing-payments") return (method === "GET" ? result.listings : result.listing) as T;
  if (resource === "images") return result as T;
  if (resource === "manager-requests") return result.managers as T;
  if (resource === "roommates") return (method === "GET" ? { profiles: result.roommates, ownProfile: result.own_profile, proposals: result.proposals ?? [] } : result.roommate ?? result.proposal) as T;
  return result.manager as T;
}

export function getHostelListings() {
  return request<HostelListing[]>("listings", "GET");
}

export function getHostelManager() {
  return request<HostelManager | null>("manager", "GET");
}

export function registerHostelManager(role: HostelManagerRole, phone: string) {
  return request<HostelManager>("manager", "POST", { action: "register-manager", role, phone });
}

export function createHostelListing(listing: Omit<HostelListing, "id" | "created_by" | "manager_email" | "manager_role" | "created_at" | "updated_at" | "listing_fee_ksh" | "payment_status" | "payment_reference" | "payment_submitted_at" | "payment_verified_at" | "payment_verified_by">) {
  return request<HostelListing>("listings", "POST", { action: "create-listing", listing });
}

export function updateHostelListing(id: string, listing: Omit<HostelListing, "id" | "created_by" | "manager_email" | "manager_role" | "created_at" | "updated_at" | "listing_fee_ksh" | "payment_status" | "payment_reference" | "payment_submitted_at" | "payment_verified_at" | "payment_verified_by">) {
  return request<HostelListing>("listings", "POST", { action: "update-listing", id, listing });
}

export function deleteHostelListing(id: string) {
  return request<HostelListing>("listings", "POST", { action: "delete-listing", id });
}

export async function uploadRoomImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error("Use JPG, PNG or WebP room photos.");
  if (file.size > 2.5 * 1024 * 1024) throw new Error("Each room photo must be 2.5 MB or smaller.");
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected photo."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  const result = await request<{ image_url: string }>("images", "POST", { action: "upload-image", base64, mime_type: file.type });
  return result.image_url;
}

export function submitListingPaymentReference(id: string, payment_reference: string) {
  return request<HostelListing>("listings", "POST", { action: "submit-payment-reference", id, payment_reference });
}

export function getPendingListingPayments() {
  return request<HostelListing[]>("listing-payments", "GET");
}

export function reviewListingPayment(id: string, decision: "paid" | "rejected") {
  return request<HostelListing>("listing-payments", "POST", { id, decision });
}


export function getHostelManagerRequests() {
  return request<HostelManager[]>("manager-requests", "GET");
}

export function reviewHostelManager(firebaseUid: string, decision: "approved" | "rejected") {
  return request<HostelManager>("manager-requests", "POST", {
    action: "review-manager",
    firebase_uid: firebaseUid,
    decision,
  });
}

export function getRoommateProfiles() {
  return request<{ profiles: RoommateProfile[]; ownProfile: RoommateProfile | null; proposals: ConnectionProposal[] }>("roommates", "GET");
}

export function saveRoommateProfile(profile: Omit<RoommateProfile, "firebase_uid" | "created_at" | "updated_at">) {
  return request<RoommateProfile>("roommates", "POST", { action: "save-profile", profile });
}

export function sendConnectionProposal(target_uid: string, safety_confirmed: boolean) {
  return request<ConnectionProposal>("roommates", "POST", { action: "send-proposal", target_uid, safety_confirmed });
}

export function respondToConnectionProposal(id: string, decision: "accepted" | "declined", safety_confirmed: boolean) {
  return request<ConnectionProposal>("roommates", "POST", { action: "respond-proposal", id, decision, safety_confirmed });
}
