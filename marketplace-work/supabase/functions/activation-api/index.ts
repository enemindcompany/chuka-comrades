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

type FirebaseIdentity = { uid: string; email: string; emailVerified: boolean };

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
async function verifyIdentity(request: Request): Promise<FirebaseIdentity | null> {
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
const isAdmin = (identity: FirebaseIdentity) =>
  identity.email === adminEmail && identity.emailVerified;

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return new Response("Origin not allowed", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "GET" && request.method !== "POST") return respond({ error: "Method not allowed" }, 405, origin);

  const identity = await verifyIdentity(request);
  if (!identity) return respond({ error: "Your Firebase session could not be verified. Sign in again." }, 401, origin);
  if (!supabaseUrl || !serviceRoleKey) return respond({ error: "Server activation configuration is incomplete." }, 500, origin);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const resource = new URL(request.url).searchParams.get("resource");

  if (resource === "activation") {
    if (request.method === "GET") {
      const { error: insertError } = await supabase.from("activation_accounts")
        .upsert({ firebase_uid: identity.uid, email: identity.email }, {
          onConflict: "firebase_uid", ignoreDuplicates: true,
        });
      if (insertError) {
        console.error("Activation account initialization failed:", insertError.message);
        return respond({ error: "Could not initialize your trial." }, 500, origin);
      }
      const { data, error } = await supabase.from("activation_accounts")
        .select("firebase_uid,email,trial_started_at,trial_ends_at,status,payment_reference,payment_submitted_at,activated_at,reviewed_at,reviewed_by")
        .eq("firebase_uid", identity.uid).single();
      if (error) return respond({ error: "Could not load activation status." }, 500, origin);
      return respond({ activation: data }, 200, origin);
    }

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body." }, 400, origin); }
    if (body.action !== "submit-payment") return respond({ error: "Unsupported activation action." }, 400, origin);
    const reference = typeof body.payment_reference === "string" ? body.payment_reference.trim().toUpperCase() : "";
    if (reference.length < 4 || reference.length > 80 || !/^[A-Za-z0-9 -]+$/.test(reference)) {
      return respond({ error: "Enter a valid M-PESA transaction reference (4–80 letters or numbers)." }, 400, origin);
    }

    const { data: current, error: readError } = await supabase.from("activation_accounts")
      .select("status,trial_ends_at").eq("firebase_uid", identity.uid).maybeSingle();
    if (readError || !current) return respond({ error: "Could not load your activation account. Refresh and try again." }, 500, origin);
    if (current.status === "active") return respond({ error: "Your account is already activated." }, 409, origin);
    if (current.status === "pending") return respond({ error: "Your payment is already awaiting admin review." }, 409, origin);
    if (Date.now() < new Date(current.trial_ends_at).getTime()) {
      return respond({ error: "Your 48-hour free trial is still active. You can submit an activation payment after it ends." }, 409, origin);
    }

    const { data, error } = await supabase.from("activation_accounts").update({
      email: identity.email,
      status: "pending",
      payment_reference: reference,
      payment_submitted_at: new Date().toISOString(),
      activated_at: null,
      reviewed_at: null,
      reviewed_by: null,
      updated_at: new Date().toISOString(),
    }).eq("firebase_uid", identity.uid)
      .select("firebase_uid,email,trial_started_at,trial_ends_at,status,payment_reference,payment_submitted_at,activated_at,reviewed_at,reviewed_by")
      .single();
    if (error?.code === "23505") {
      return respond({ error: "That M-PESA transaction reference is already attached to another pending or active account. Check the code and contact the administrator if you believe this is a mistake." }, 409, origin);
    }
    if (error) {
      console.error("Payment reference submission failed:", error.message);
      return respond({ error: "Could not submit your payment reference. Please retry." }, 500, origin);
    }
    return respond({ activation: data }, 200, origin);
  }

  if (resource === "admin-payments") {
    if (!isAdmin(identity)) return respond({ error: "Admin access is restricted to the authorized administrator." }, 403, origin);
    if (request.method === "GET") {
      const { data, error } = await supabase.from("activation_accounts")
        .select("firebase_uid,email,trial_started_at,trial_ends_at,status,payment_reference,payment_submitted_at,activated_at,reviewed_at,reviewed_by")
        .order("payment_submitted_at", { ascending: false, nullsFirst: false }).limit(500);
      if (error) return respond({ error: "Could not load payment requests." }, 500, origin);
      return respond({ payments: data ?? [] }, 200, origin);
    }

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body." }, 400, origin); }
    if (body.action !== "review-payment" || typeof body.firebase_uid !== "string" ||
        (body.decision !== "approved" && body.decision !== "rejected")) {
      return respond({ error: "Invalid payment review request." }, 400, origin);
    }
    const { data: existing, error: existingError } = await supabase.from("activation_accounts")
      .select("status").eq("firebase_uid", body.firebase_uid).maybeSingle();
    if (existingError || !existing) return respond({ error: "Activation account not found." }, 404, origin);
    if (existing.status !== "pending") return respond({ error: "Only pending payments can be reviewed." }, 409, origin);

    const approved = body.decision === "approved";
    const { data, error } = await supabase.from("activation_accounts").update({
      status: approved ? "active" : "rejected",
      activated_at: approved ? new Date().toISOString() : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: identity.email,
      updated_at: new Date().toISOString(),
    }).eq("firebase_uid", body.firebase_uid)
      .select("firebase_uid,email,trial_started_at,trial_ends_at,status,payment_reference,payment_submitted_at,activated_at,reviewed_at,reviewed_by")
      .single();
    if (error) return respond({ error: "Could not save the payment decision." }, 500, origin);
    return respond({ activation: data }, 200, origin);
  }

  return respond({ error: "Unknown activation resource." }, 404, origin);
});
