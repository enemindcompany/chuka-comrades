import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

async function verifiedFirebaseUid(request: Request): Promise<string | null> {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !firebaseProjectId) return null;

  try {
    const { payload } = await jwtVerify(match[1], jwks, {
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId,
      algorithms: ["RS256"],
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}

function validProfileInput(value: unknown): value is {
  display_name?: string | null;
  campus?: string | null;
  course?: string | null;
  year_of_study?: number | null;
  avatar_url?: string | null;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  const allowed = new Set(["display_name", "campus", "course", "year_of_study", "avatar_url"]);
  if (Object.keys(data).some((key) => !allowed.has(key))) return false;

  for (const key of ["display_name", "campus", "course"] as const) {
    const item = data[key];
    if (item !== undefined && item !== null && (typeof item !== "string" || item.length > 120)) {
      return false;
    }
  }

  const year = data.year_of_study;
  if (year !== undefined && year !== null &&
      (typeof year !== "number" || !Number.isInteger(year) || year < 1 || year > 10)) {
    return false;
  }

  const avatar = data.avatar_url;
  if (avatar !== undefined && avatar !== null) {
    if (typeof avatar !== "string" || avatar.length > 2048) return false;
    try {
      if (new URL(avatar).protocol !== "https:") return false;
    } catch {
      return false;
    }
  }
  return true;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(request.method)) {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const uid = await verifiedFirebaseUid(request);
  if (!uid) return jsonResponse({ error: "Unauthorized" }, 401);

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server configuration is incomplete" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (request.method === "GET") {
    const { data, error } = await supabase
      .from("student_profiles")
      .select("id, display_name, university, campus, course, year_of_study, avatar_url, created_at, updated_at")
      .eq("firebase_uid", uid)
      .maybeSingle();

    if (error) return jsonResponse({ error: "Could not load student profile" }, 500);
    return jsonResponse({ profile: data });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }

  if (!validProfileInput(body)) {
    return jsonResponse({ error: "Invalid profile fields" }, 400);
  }

  const input = body as Record<string, unknown>;
  const profile = {
    firebase_uid: uid,
    display_name: input.display_name ?? null,
    university: "Chuka University",
    campus: input.campus ?? null,
    course: input.course ?? null,
    year_of_study: input.year_of_study ?? null,
    avatar_url: input.avatar_url ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("student_profiles")
    .upsert(profile, { onConflict: "firebase_uid" })
    .select("id, display_name, university, campus, course, year_of_study, avatar_url, created_at, updated_at")
    .single();

  if (error) return jsonResponse({ error: "Could not save student profile" }, 500);
  return jsonResponse({ profile: data });
});
