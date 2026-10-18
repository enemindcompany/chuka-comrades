import { auth } from "./firebase";

export type MarketplaceCategory = "Books" | "Electronics" | "Fashion" | "Home" | "Food" | "Services" | "Other";
export type MarketplaceStatus = "available" | "sold" | "closed";

export interface MarketplaceListing {
  id: string;
  created_by: string;
  seller_email: string;
  store_name: string;
  title: string;
  category: MarketplaceCategory;
  price_ksh: number;
  price_negotiable: boolean;
  location: string;
  whatsapp_number: string;
  description: string;
  image_urls: string[];
  status: MarketplaceStatus;
  admin_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export type MarketplaceDraftPayload = Omit<MarketplaceListing,
  "id" | "created_by" | "seller_email" | "admin_suspended" | "created_at" | "updated_at">;

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, "");
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export interface MarketplaceStore {
  created_by: string;
  seller_email: string;
  seller_name: string;
  store_name: string;
  business_type: string;
  location: string;
  whatsapp_number: string;
  description: string;
  delivery_options: string[];
  updated_at: string;
}
export type MarketplaceStoreDraft = Omit<MarketplaceStore, "created_by" | "seller_email" | "updated_at">;
type Resource = "listings" | "images" | "store";

async function request<T>(resource: Resource, method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in with Google to use the marketplace.");
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Marketplace service is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.");
  }
  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/marketplace-api?resource=${resource}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error("Could not connect to marketplace-api. Deploy the function and check FRONTEND_ORIGINS in Supabase.");
  }
  const result = await response.json().catch(() => ({})) as { error?: string; listings?: T; listing?: T; store?: T; image_url?: string };
  if (!response.ok) throw new Error(result.error || `Marketplace request failed (HTTP ${response.status}).`);
  if (resource === "listings") return (method === "GET" ? result.listings : result.listing) as T;
  if (resource === "store") return result.store as T;
  return result as T;
}

export function getMarketplaceStore() {
  return request<MarketplaceStore | null>("store", "GET");
}
export function saveMarketplaceStore(store: MarketplaceStoreDraft) {
  return request<MarketplaceStore>("store", "POST", { action: "save-store", store });
}
export function deleteMarketplaceStore() {
  return request<null>("store", "POST", { action: "delete-store" });
}

export function getMarketplaceListings() {
  return request<MarketplaceListing[]>("listings", "GET");
}

export function createMarketplaceListing(listing: MarketplaceDraftPayload) {
  return request<MarketplaceListing>("listings", "POST", { action: "create-listing", listing });
}

export function updateMarketplaceListing(id: string, listing: MarketplaceDraftPayload) {
  return request<MarketplaceListing>("listings", "POST", { action: "update-listing", id, listing });
}

export function deleteMarketplaceListing(id: string) {
  return request<MarketplaceListing>("listings", "POST", { action: "delete-listing", id });
}

export async function uploadMarketplaceImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use JPG, PNG or WebP product photos.");
  if (file.size > 2.5 * 1024 * 1024) throw new Error("Each photo must be 2.5 MB or smaller.");
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected photo."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  const result = await request<{ image_url: string }>("images", "POST", {
    action: "upload-image", base64, mime_type: file.type,
  });
  return result.image_url;
}
