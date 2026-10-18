import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const adminEmail = "sidneywafula30@gmail.com";
// Keep local Vite development available even when FRONTEND_ORIGINS is set
// only to production domains. Production origins must still be explicitly listed.
const configuredOrigins = (Deno.env.get("FRONTEND_ORIGINS") ?? "")
  .split(",").map((value) => value.trim().replace(/\/+$/, "")).filter(Boolean);
const allowedOrigins = new Set(["http://localhost:5173", ...configuredOrigins]);
const jwks = createRemoteJWKSet(new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
));

type Identity = { uid: string; email: string; emailVerified: boolean };
type ManagerRole = "landlord";

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
  } catch {
    return null;
  }
}
function isRole(value: unknown): value is ManagerRole {
  return value === "landlord";
}
const isAdmin = (identity: Identity) => identity.email === adminEmail && identity.emailVerified;
function validPhone(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 9 &&
    value.trim().length <= 20 && /^[+0-9() -]+$/.test(value.trim());
}
function cleanText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length >= min && clean.length <= max ? clean : null;
}
function parseListing(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const name = cleanText(item.name, 2, 100);
  const area = cleanText(item.area, 2, 100);
  const address = cleanText(item.address, 2, 250);
  const roomType = cleanText(item.room_type, 2, 80);
  const description = cleanText(item.description, 5, 2000);
  const phone = validPhone(item.phone) ? item.phone.trim() : null;
  const rent = Number(item.rent_ksh);
  const deposit = Number(item.deposit_ksh ?? 0);
  const amenities = Array.isArray(item.amenities)
    ? item.amenities.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean).slice(0, 15)
    : [];
  const rawImages = Array.isArray(item.image_urls) ? item.image_urls : (item.image_url ? [item.image_url] : []);
  if (rawImages.length > 5) return null;
  const imageUrls: string[] = [];
  for (const raw of rawImages) {
    if (typeof raw !== "string" || raw.length > 1500) return null;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
      imageUrls.push(parsed.toString());
    } catch { return null; }
  }
  const status = item.listing_status ?? (item.is_available === false ? "booked" : "available");
  if (!name || !area || !address || !roomType || !description || !phone ||
      !Number.isSafeInteger(rent) || rent < 1 ||
      !Number.isSafeInteger(deposit) || deposit < 0 ||
      !["available", "booked", "closed"].includes(String(status))) return null;
  return {
    name, area, address, rent_ksh: rent, deposit_ksh: deposit,
    room_type: roomType, vacancies: 1, phone, description, amenities,
    image_urls: imageUrls, image_url: imageUrls[0] ?? null,
    listing_status: status, is_available: status === "available",
  };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return new Response("Origin not allowed", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "GET" && request.method !== "POST") return respond({ error: "Method not allowed" }, 405, origin);

  const identity = await verifyIdentity(request);
  if (!identity || !identity.emailVerified) return respond({ error: "Your verified Google session could not be checked. Sign in again and verify your email." }, 401, origin);
  if (!supabaseUrl || !serviceRoleKey) return respond({ error: "Server hostel configuration is incomplete." }, 500, origin);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const resource = new URL(request.url).searchParams.get("resource");

  if (resource === "listings") {
    if (request.method === "GET") {
      const { data, error } = await supabase.from("hostel_listings").select("*")
        .order("created_at", { ascending: false }).limit(500);
      if (error) {
        console.error("Hostel listing read failed:", error.message);
        return respond({ error: "Could not load hostel listings." }, 500, origin);
      }
      const now = Date.now();
      const listings = (data ?? []).filter((item) => {
        if (item.created_by === identity.uid) return true;
        const notExpired = !item.expires_at || new Date(item.expires_at).getTime() > now;
        return item.listing_status !== "closed" && item.admin_suspended !== true && notExpired;
      });
      return respond({ listings }, 200, origin);
    }

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body." }, 400, origin); }
    if (body.action === "create-listing") {
      const parsed = parseListing(body.listing);
      if (!parsed) return respond({ error: "Check the listing details. Rent, room count, phone, description or photo URL is invalid." }, 400, origin);
      const { data: manager, error: managerError } = await supabase.from("hostel_managers")
        .select("role,phone,email,status").eq("firebase_uid", identity.uid).maybeSingle();
      if (managerError) return respond({ error: "Could not verify your hostel manager account." }, 500, origin);
      if (!manager || manager.status !== "approved" || manager.role !== "landlord") return respond({ error: "Your landlord access must be approved by the administrator before publishing listings." }, 403, origin);
      const { data, error } = await supabase.from("hostel_listings").insert({
        ...parsed, created_by: identity.uid, manager_email: identity.email, manager_role: manager.role,
        listing_fee_ksh: 0, payment_status: "unpaid", payment_reference: null,
        payment_submitted_at: null, payment_verified_at: null, payment_verified_by: null,
        expires_at: null, admin_suspended: false, admin_suspension_reason: null,
      }).select("*").single();
      if (error) {
        console.error("Hostel listing create failed:", error.message);
        return respond({ error: "Could not publish this listing. Please retry." }, 500, origin);
      }
      return respond({ listing: data, message: "Room listing published. Viewers can contact the landlord directly on WhatsApp. No payments are collected through Chuka Comrades." }, 201, origin);
    }

    if (body.action === "update-listing") {
      const id = typeof body.id === "string" ? body.id : "";
      const parsed = parseListing(body.listing);
      if (!id || !parsed) return respond({ error: "Listing details are invalid." }, 400, origin);
      const { data, error } = await supabase.from("hostel_listings").update({
        ...parsed, updated_at: new Date().toISOString(),
      }).eq("id", id).eq("created_by", identity.uid).select("*").maybeSingle();
      if (error) {
        console.error("Hostel listing update failed:", error.message);
        return respond({ error: "Could not update this listing." }, 500, origin);
      }
      if (!data) return respond({ error: "You can edit only listings created by your account." }, 404, origin);
      return respond({ listing: data }, 200, origin);
    }

    if (body.action === "delete-listing") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return respond({ error: "Listing ID is required." }, 400, origin);
      const { data, error } = await supabase.from("hostel_listings").delete()
        .eq("id", id).eq("created_by", identity.uid).select("*").maybeSingle();
      if (error) {
        console.error("Hostel listing delete failed:", error.message);
        return respond({ error: "Could not delete this listing." }, 500, origin);
      }
      if (!data) return respond({ error: "You can delete only listings created by your account." }, 404, origin);
      return respond({ listing: data }, 200, origin);
    }
    return respond({ error: "Unsupported hostel listing action." }, 400, origin);
  }

  if (resource === "images") {
    if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405, origin);
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body." }, 400, origin); }
    if (body.action !== "upload-image" || typeof body.base64 !== "string" || typeof body.mime_type !== "string") {
      return respond({ error: "Image upload data is invalid." }, 400, origin);
    }
    const allowedTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const ext = allowedTypes[body.mime_type];
    if (!ext) return respond({ error: "Use a JPG, PNG, or WebP image." }, 400, origin);
    const encoded = body.base64.replace(/^data:[^;]+;base64,/, "");
    if (encoded.length > 3_500_000) return respond({ error: "Each photo must be 2.5 MB or smaller." }, 413, origin);
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)); }
    catch { return respond({ error: "The image file could not be read." }, 400, origin); }
    const path = `${identity.uid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("room-images").upload(path, bytes, {
      contentType: body.mime_type, upsert: false, cacheControl: "31536000",
    });
    if (error) {
      console.error("Room image upload failed:", error.message);
      return respond({ error: "Could not upload the photo. Check the room-images storage bucket migration and retry." }, 500, origin);
    }
    const { data } = supabase.storage.from("room-images").getPublicUrl(path);
    return respond({ image_url: data.publicUrl }, 201, origin);
  }

  if (resource === "manager") {
    if (request.method === "GET") {
      const { data, error } = await supabase.from("hostel_managers")
        .select("firebase_uid,email,role,phone,status,reviewed_at,reviewed_by,created_at")
        .eq("firebase_uid", identity.uid).maybeSingle();
      if (error) return respond({ error: "Could not load your hostel manager profile." }, 500, origin);
      return respond({ manager: data }, 200, origin);
    }
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body." }, 400, origin); }
    if (body.action !== "register-manager" || !isRole(body.role) || !validPhone(body.phone)) {
      return respond({ error: "Choose landlord / property owner and enter a valid WhatsApp number." }, 400, origin);
    }
    const { data, error } = await supabase.from("hostel_managers").upsert({
      firebase_uid: identity.uid,
      email: identity.email,
      role: body.role,
      phone: body.phone.trim(),
      status: "pending",
      reviewed_at: null,
      reviewed_by: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "firebase_uid" })
      .select("firebase_uid,email,role,phone,status,reviewed_at,reviewed_by,created_at").single();
    if (error) {
      console.error("Hostel manager registration failed:", error.message);
      return respond({ error: "Could not register your manager account." }, 500, origin);
    }
    return respond({ manager: data }, 200, origin);
  }
  if (resource === "manager-requests") {
    if (!isAdmin(identity)) return respond({ error: "Only the verified administrator can review hostel manager requests." }, 403, origin);
    if (request.method === "GET") {
      const { data, error } = await supabase.from("hostel_managers")
        .select("firebase_uid,email,role,phone,status,reviewed_at,reviewed_by,created_at")
        .order("created_at", { ascending: false }).limit(500);
      if (error) return respond({ error: "Could not load hostel manager requests." }, 500, origin);
      return respond({ managers: data ?? [] }, 200, origin);
    }
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body." }, 400, origin); }
    if (body.action !== "review-manager" || typeof body.firebase_uid !== "string" ||
        (body.decision !== "approved" && body.decision !== "rejected")) {
      return respond({ error: "Invalid manager review request." }, 400, origin);
    }
    const { data: existing, error: readError } = await supabase.from("hostel_managers")
      .select("status").eq("firebase_uid", body.firebase_uid).maybeSingle();
    if (readError || !existing) return respond({ error: "Hostel manager request not found." }, 404, origin);
    if (existing.status !== "pending") return respond({ error: "Only pending manager requests can be reviewed." }, 409, origin);
    const { data, error } = await supabase.from("hostel_managers").update({
      status: body.decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: identity.email,
      updated_at: new Date().toISOString(),
    }).eq("firebase_uid", body.firebase_uid)
      .select("firebase_uid,email,role,phone,status,reviewed_at,reviewed_by,created_at").single();
    if (error) return respond({ error: "Could not save the manager review decision." }, 500, origin);
    return respond({ manager: data }, 200, origin);
  }

  if (resource === "roommates") {
    if (request.method === "GET") {
      const columns = "firebase_uid,display_name,course,year_of_study,gender,housing_status,preferred_area,monthly_budget_ksh,hostel_name,bio,contact_phone,created_at,updated_at";
      const [{ data, error }, { data: ownProfile, error: ownError }, { data: proposals, error: proposalError }] = await Promise.all([
        supabase.from("roommate_profiles").select(columns).neq("firebase_uid", identity.uid).order("updated_at", { ascending: false }).limit(500),
        supabase.from("roommate_profiles").select(columns).eq("firebase_uid", identity.uid).maybeSingle(),
        supabase.from("roommate_connection_proposals").select("id,requester_uid,target_uid,status,created_at,updated_at")
          .or(`requester_uid.eq.${identity.uid},target_uid.eq.${identity.uid}`).order("created_at", { ascending: false }).limit(500),
      ]);
      if (error || ownError || proposalError) {
        console.error("Roommate data read failed:", error?.message ?? ownError?.message ?? proposalError?.message);
        return respond({ error: "Could not load connection profiles. Apply the latest Supabase migration and redeploy hostel-api." }, 500, origin);
      }
      const proposalRows = proposals ?? [];
      const accepted = new Set<string>();
      for (const proposal of proposalRows) if (proposal.status === "accepted") accepted.add(proposal.requester_uid === identity.uid ? proposal.target_uid : proposal.requester_uid);
      const safeProfiles = (data ?? []).map((profile) => accepted.has(profile.firebase_uid)
        ? { ...profile, connected: true }
        : { ...profile, course: "", year_of_study: "", preferred_area: "", monthly_budget_ksh: 0, hostel_name: null, bio: "", contact_phone: null, connected: false });
      return respond({ roommates: safeProfiles, own_profile: ownProfile ?? null, proposals: proposalRows }, 200, origin);
    }
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body." }, 400, origin); }
    if (body.action === "send-proposal") {
      const targetUid = typeof body.target_uid === "string" ? body.target_uid : "";
      if (!targetUid || targetUid === identity.uid || body.safety_confirmed !== true) return respond({ error: "Confirm the safety guidance before sending a proposal." }, 400, origin);
      const { data: target } = await supabase.from("roommate_profiles").select("firebase_uid").eq("firebase_uid", targetUid).maybeSingle();
      if (!target) return respond({ error: "That profile is no longer available." }, 404, origin);
      const { data: existing } = await supabase.from("roommate_connection_proposals").select("id,status,requester_uid,target_uid,created_at,updated_at")
        .or(`and(requester_uid.eq.${identity.uid},target_uid.eq.${targetUid}),and(requester_uid.eq.${targetUid},target_uid.eq.${identity.uid})`).in("status", ["pending", "accepted"]).maybeSingle();
      if (existing) return respond({ proposal: existing, message: existing.status === "accepted" ? "You are already connected." : "A proposal between you is already pending." }, 200, origin);
      const { data, error } = await supabase.from("roommate_connection_proposals").insert({ requester_uid: identity.uid, target_uid: targetUid, status: "pending" })
        .select("id,requester_uid,target_uid,status,created_at,updated_at").single();
      if (error) return respond({ error: "Could not send proposal. Refresh and try again." }, 500, origin);
      return respond({ proposal: data }, 201, origin);
    }
    if (body.action === "respond-proposal") {
      const id = typeof body.id === "string" ? body.id : "";
      const decision = body.decision;
      if (!id || (decision !== "accepted" && decision !== "declined") || body.safety_confirmed !== true) return respond({ error: "Confirm the safety guidance and choose accept or decline." }, 400, origin);
      const { data, error } = await supabase.from("roommate_connection_proposals").update({ status: decision, updated_at: new Date().toISOString() })
        .eq("id", id).eq("target_uid", identity.uid).eq("status", "pending")
        .select("id,requester_uid,target_uid,status,created_at,updated_at").maybeSingle();
      if (error) return respond({ error: "Could not update this proposal." }, 500, origin);
      if (!data) return respond({ error: "Proposal not found, already handled, or you are not its recipient." }, 404, origin);
      return respond({ proposal: data }, 200, origin);
    }
    if (body.action !== "save-profile" || !body.profile || typeof body.profile !== "object") {
      return respond({ error: "Unsupported roommate profile action." }, 400, origin);
    }
    const profile = body.profile as Record<string, unknown>;
    const { data: existingRoommate } = await supabase.from("roommate_profiles").select("firebase_uid").eq("firebase_uid", identity.uid).maybeSingle();
    const { data: paidRequest, error: paidRequestError } = await supabase.from("paid_request_payments").select("id").eq("firebase_uid", identity.uid).eq("request_type", "roommate_finder").eq("status", "approved").is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (paidRequestError) return respond({ error: "Roommate payment service is not ready. Apply the paid-request migration and redeploy community-api and hostel-api." }, 500, origin);
    if (!existingRoommate && !paidRequest) return respond({ error: "Submit the KSh 100 roommate finder fee and wait for admin approval before publishing your request." }, 403, origin);
    const displayName = cleanText(profile.display_name, 2, 80);
    const course = "";
    const year = "";
    const gender = profile.gender === "Woman" || profile.gender === "Man" || profile.gender === "Non-binary" || profile.gender === "Prefer not to say" ? profile.gender : "Prefer not to say";
    const area = cleanText(profile.preferred_area, 2, 100);
    const bio = typeof profile.bio === "string" && profile.bio.trim().length <= 500 ? profile.bio.trim() : null;
    const phone = validPhone(profile.contact_phone) ? profile.contact_phone.trim() : null;
    const budget = Number(profile.monthly_budget_ksh);
    const status = profile.housing_status;
    const hostelName = typeof profile.hostel_name === "string" ? profile.hostel_name.trim().slice(0, 100) : "";
    if (!displayName || !area || bio === null || !phone ||
        !Number.isSafeInteger(budget) || budget < 0 || budget > 100000 ||
        (status !== "have_hostel" && status !== "looking")) {
      return respond({ error: "Complete all required roommate details." }, 400, origin);
    }
    const { data, error } = await supabase.from("roommate_profiles").upsert({
      firebase_uid: identity.uid, display_name: displayName, course, year_of_study: year, gender,
      housing_status: status, preferred_area: area, monthly_budget_ksh: budget,
      hostel_name: hostelName || null, bio, contact_phone: phone,
      updated_at: new Date().toISOString(),
    }, { onConflict: "firebase_uid" }).select("firebase_uid,display_name,course,year_of_study,gender,housing_status,preferred_area,monthly_budget_ksh,hostel_name,bio,contact_phone,created_at,updated_at").single();
    if (error) {
      console.error("Roommate profile save failed:", error.message);
      return respond({ error: "Could not save your roommate profile. Apply the latest Supabase migration and redeploy hostel-api." }, 500, origin);
    }
    if (paidRequest) await supabase.from("paid_request_payments").update({ used_at: new Date().toISOString() }).eq("id", paidRequest.id).eq("used_at", null);
    return respond({ roommate: data }, 200, origin);
  }

  return respond({ error: "Unknown hostel resource." }, 404, origin);
});
