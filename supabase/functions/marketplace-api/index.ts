import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const configuredOrigins = (Deno.env.get("FRONTEND_ORIGINS") ?? "")
  .split(",").map((value) => value.trim().replace(/\/+$/, "")).filter(Boolean);
const allowedOrigins = new Set(["http://localhost:5173", ...configuredOrigins]);
const jwks = createRemoteJWKSet(new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
));

type Identity = { uid: string; email: string; emailVerified: boolean };
type ListingStatus = "available" | "sold" | "closed";

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function respond(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}
async function verifyIdentity(request: Request): Promise<Identity | null> {
  const token = (request.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || !firebaseProjectId) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId,
      algorithms: ["RS256"],
    });
    if (typeof payload.sub !== "string" || !payload.sub || typeof payload.email !== "string") return null;
    return { uid: payload.sub, email: payload.email.toLowerCase(), emailVerified: payload.email_verified === true };
  } catch { return null; }
}
function cleanText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length >= min && clean.length <= max ? clean : null;
}
function validPhone(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 9 && value.trim().length <= 20 && /^[+0-9() -]+$/.test(value.trim());
}
function parseListing(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const storeName = cleanText(item.store_name, 2, 100);
  const title = cleanText(item.title, 2, 120);
  const category = cleanText(item.category, 2, 30);
  const location = cleanText(item.location, 2, 150);
  const description = cleanText(item.description, 5, 2000);
  const whatsapp = validPhone(item.whatsapp_number) ? item.whatsapp_number.trim() : null;
  const price = Number(item.price_ksh);
  const status = item.status ?? "available";
  const allowedCategories = ["Books", "Electronics", "Fashion", "Home", "Food", "Services", "Other"];
  const imageUrls: string[] = [];
  const rawImages = Array.isArray(item.image_urls) ? item.image_urls : [];
  if (rawImages.length > 5) return null;
  for (const raw of rawImages) {
    if (typeof raw !== "string" || raw.length > 1500) return null;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
      imageUrls.push(parsed.toString());
    } catch { return null; }
  }
  if (!storeName || !title || !category || !allowedCategories.includes(category) || !location || !description || !whatsapp ||
      !Number.isSafeInteger(price) || price < 0 || !["available", "sold", "closed"].includes(String(status)) || typeof item.price_negotiable !== "boolean") return null;
  return {
    store_name: storeName, title, category, price_ksh: price,
    price_negotiable: item.price_negotiable, location, whatsapp_number: whatsapp,
    description, image_urls: imageUrls, status: status as ListingStatus,
  };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return new Response("Origin not allowed", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "GET" && request.method !== "POST") return respond({ error: "Method not allowed." }, 405, origin);
  const identity = await verifyIdentity(request);
  if (!identity || !identity.emailVerified) return respond({ error: "Sign in with a verified Google account to use the marketplace." }, 401, origin);
  if (!supabaseUrl || !serviceRoleKey) return respond({ error: "Marketplace server configuration is incomplete." }, 500, origin);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const resource = new URL(request.url).searchParams.get("resource");
  const isAdmin = identity.email === "sidneywafula30@gmail.com";

  if (resource === "store-subscription") {
    if (request.method === "GET") {
      const { data, error } = await supabase.from("marketplace_store_subscriptions").select("*").eq("created_by", identity.uid).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) return respond({ error: "Could not load your store subscription. Apply the store subscription migration and retry." }, 500, origin);
      return respond({ subscription: data ?? null }, 200, origin);
    }
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body." }, 400, origin); }
    if (body.action !== "submit-subscription-payment") return respond({ error: "Unsupported subscription action." }, 400, origin);
    const reference = typeof body.payment_reference === "string" ? body.payment_reference.trim().toUpperCase() : "";
    if (reference.length < 4 || reference.length > 80 || !/^[A-Z0-9 -]+$/.test(reference)) return respond({ error: "Enter a valid M-Pesa transaction code." }, 400, origin);
    const { data: latest, error: latestError } = await supabase.from("marketplace_store_subscriptions").select("status,expires_at").eq("created_by", identity.uid).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (latestError) return respond({ error: "Could not check your existing subscription." }, 500, origin);
    if (latest?.status === "pending") return respond({ error: "Your previous subscription payment is still awaiting admin review." }, 409, origin);
    if (latest?.status === "active" && latest.expires_at && new Date(latest.expires_at).getTime() > Date.now()) return respond({ error: "Your store subscription is already active." }, 409, origin);
    const { data, error } = await supabase.from("marketplace_store_subscriptions").insert({ created_by: identity.uid, seller_email: identity.email, amount_ksh: 300, payment_reference: reference, status: "pending" }).select("*").single();
    if (error?.code === "23505") return respond({ error: "That M-Pesa transaction code has already been submitted. Check the code or contact the administrator." }, 409, origin);
    if (error) return respond({ error: "Could not submit your subscription payment reference." }, 500, origin);
    return respond({ subscription: data }, 201, origin);
  }

  if (resource === "admin-store-subscriptions") {
    if (!isAdmin) return respond({ error: "Admin access is restricted to the authorized administrator." }, 403, origin);
    if (request.method === "GET") {
      const { data, error } = await supabase.from("marketplace_store_subscriptions").select("*").eq("status", "pending").order("submitted_at", { ascending: true }).limit(500);
      if (error) return respond({ error: "Could not load pending store subscriptions." }, 500, origin);
      return respond({ subscriptions: data ?? [] }, 200, origin);
    }
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body." }, 400, origin); }
    if (body.action !== "review-subscription" || typeof body.id !== "string" || !["approved", "rejected"].includes(String(body.decision))) return respond({ error: "Invalid subscription review request." }, 400, origin);
    const { data: existing, error: readError } = await supabase.from("marketplace_store_subscriptions").select("id,status").eq("id", body.id).maybeSingle();
    if (readError || !existing) return respond({ error: "Subscription request not found." }, 404, origin);
    if (existing.status !== "pending") return respond({ error: "Only pending subscription requests can be reviewed." }, 409, origin);
    const approved = body.decision === "approved";
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase.from("marketplace_store_subscriptions").update({ status: approved ? "active" : "rejected", starts_at: approved ? now.toISOString() : null, expires_at: approved ? expires.toISOString() : null, reviewed_at: now.toISOString(), reviewed_by: identity.email, updated_at: now.toISOString() }).eq("id", body.id).select("*").single();
    if (error) return respond({ error: "Could not save the subscription decision." }, 500, origin);
    return respond({ subscription: data }, 200, origin);
  }

  if (resource === "store") {
    if (request.method === "GET") {
      const { data, error } = await supabase.from("marketplace_stores").select("*").eq("created_by", identity.uid).maybeSingle();
      if (error) return respond({ error: "Could not load your store profile. Apply the marketplace store migration and retry." }, 500, origin);
      return respond({ store: data ?? null }, 200, origin);
    }
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body." }, 400, origin); }
    if (body.action === "delete-store") {
      const { error: listingError } = await supabase.from("marketplace_listings").delete().eq("created_by", identity.uid);
      if (listingError) return respond({ error: "Could not delete your product listings. No store data was removed." }, 500, origin);
      const { error: storeError } = await supabase.from("marketplace_stores").delete().eq("created_by", identity.uid);
      if (storeError) return respond({ error: "Listings were deleted, but the store profile could not be removed." }, 500, origin);
      return respond({ store: null }, 200, origin);
    }
    if (body.action !== "save-store" || !body.store || typeof body.store !== "object") return respond({ error: "Store profile data is missing." }, 400, origin);
    const value = body.store as Record<string, unknown>;
    const sellerName = cleanText(value.seller_name, 2, 80);
    const storeName = cleanText(value.store_name, 2, 100);
    const businessType = cleanText(value.business_type, 2, 60);
    const location = cleanText(value.location, 2, 150);
    const description = cleanText(value.description, 5, 1000);
    const phone = validPhone(value.whatsapp_number) ? value.whatsapp_number.trim() : null;
    const delivery = Array.isArray(value.delivery_options) ? value.delivery_options.filter((v): v is string => typeof v === "string" && ["Collection", "Seller delivery"].includes(v)) : [];
    if (!sellerName || !storeName || !businessType || !location || !description || !phone || delivery.length === 0) {
      return respond({ error: "Please check seller name, store name, business type, working location, WhatsApp number, description and delivery/collection options." }, 400, origin);
    }
    const payload = { created_by: identity.uid, seller_email: identity.email, seller_name: sellerName, store_name: storeName, business_type: businessType, location, whatsapp_number: phone, description, delivery_options: [...new Set(delivery)], updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("marketplace_stores").upsert(payload, { onConflict: "created_by" }).select("*").single();
    if (error) { console.error("Marketplace store save failed:", error.message); return respond({ error: "Could not save your store profile. Confirm the marketplace store migration has been applied." }, 500, origin); }
    // Keep seller details consistent across their existing product cards too.
    const { error: listingsError } = await supabase.from("marketplace_listings").update({ store_name: data.store_name, location: data.location, whatsapp_number: data.whatsapp_number, updated_at: new Date().toISOString() }).eq("created_by", identity.uid);
    if (listingsError) console.error("Store saved, but existing listing details could not be refreshed:", listingsError.message);
    return respond({ store: data }, 200, origin);
  }

  if (resource === "listings") {
    if (request.method === "GET") {
      const { data, error } = await supabase.from("marketplace_listings").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) {
        console.error("Marketplace listing read failed:", error.message);
        return respond({ error: "Could not load marketplace listings." }, 500, origin);
      }
      const listings = (data ?? []).filter((item) =>
        (item.status !== "closed" && item.admin_suspended !== true) || item.created_by === identity.uid,
      );
      return respond({ listings }, 200, origin);
    }
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body." }, 400, origin); }
    if (body.action === "create-listing") {
      const { data: subscription, error: subscriptionError } = await supabase.from("marketplace_store_subscriptions").select("status,expires_at").eq("created_by", identity.uid).eq("status", "active").order("expires_at", { ascending: false }).limit(1).maybeSingle();
      if (subscriptionError) return respond({ error: "Could not verify store subscription. Apply the store subscription migration and retry." }, 500, origin);
      if (!subscription || !subscription.expires_at || new Date(subscription.expires_at).getTime() <= Date.now()) return respond({ error: "An active KSh 300/month store subscription is required to publish products. Submit your M-Pesa payment reference in the subscription panel." }, 403, origin);
      const listing = parseListing(body.listing);
      if (!listing) return respond({ error: "Listing not saved. Check that the item title and store name have at least 2 characters, location at least 2, description at least 5, WhatsApp number has 9–20 digits/phone characters, price is a whole KSh amount (or blank/0), category is selected, and there are no more than 5 valid JPG/PNG/WebP photo URLs." }, 400, origin);
      const { data, error } = await supabase.from("marketplace_listings").insert({
        ...listing, created_by: identity.uid, seller_email: identity.email, admin_suspended: false,
      }).select("*").single();
      if (error) {
        console.error("Marketplace listing create failed:", error.message);
        return respond({ error: "Could not publish this listing. Please retry." }, 500, origin);
      }
      return respond({ listing: data, message: "Listing published. Viewers can contact you directly on WhatsApp. No payments are collected through Chuka Comrades." }, 201, origin);
    }
    if (body.action === "update-listing") {
      const id = typeof body.id === "string" ? body.id : "";
      const listing = parseListing(body.listing);
      if (!id || !listing) return respond({ error: "Listing details are invalid." }, 400, origin);
      const { data, error } = await supabase.from("marketplace_listings").update({ ...listing, updated_at: new Date().toISOString() })
        .eq("id", id).eq("created_by", identity.uid).select("*").maybeSingle();
      if (error) return respond({ error: "Could not update this listing." }, 500, origin);
      if (!data) return respond({ error: "You can edit only listings created by your account." }, 404, origin);
      return respond({ listing: data }, 200, origin);
    }
    if (body.action === "delete-listing") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return respond({ error: "Listing ID is required." }, 400, origin);
      const { data, error } = await supabase.from("marketplace_listings").delete().eq("id", id).eq("created_by", identity.uid).select("*").maybeSingle();
      if (error) return respond({ error: "Could not delete this listing." }, 500, origin);
      if (!data) return respond({ error: "You can delete only listings created by your account." }, 404, origin);
      return respond({ listing: data }, 200, origin);
    }
    return respond({ error: "Unsupported marketplace action." }, 400, origin);
  }

  if (resource === "images") {
    if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405, origin);
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body." }, 400, origin); }
    if (body.action !== "upload-image" || typeof body.base64 !== "string" || typeof body.mime_type !== "string") return respond({ error: "Image upload data is invalid." }, 400, origin);
    const allowedTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const ext = allowedTypes[body.mime_type];
    if (!ext) return respond({ error: "Use JPG, PNG or WebP photos." }, 400, origin);
    const encoded = body.base64.replace(/^data:[^;]+;base64,/, "");
    if (encoded.length > 3_500_000) return respond({ error: "Each photo must be 2.5 MB or smaller." }, 413, origin);
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)); }
    catch { return respond({ error: "The photo file could not be read." }, 400, origin); }
    const path = `${identity.uid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("marketplace-images").upload(path, bytes, {
      contentType: body.mime_type, upsert: false, cacheControl: "31536000",
    });
    if (error) {
      console.error("Marketplace image upload failed:", error.message);
      return respond({ error: "Could not upload the photo. Apply the marketplace migration and retry." }, 500, origin);
    }
    const { data } = supabase.storage.from("marketplace-images").getPublicUrl(path);
    return respond({ image_url: data.publicUrl }, 201, origin);
  }

  return respond({ error: "Unknown marketplace resource." }, 404, origin);
});
