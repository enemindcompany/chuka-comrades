
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const origins = new Set([
  "http://localhost:5173",
  ...(Deno.env.get("FRONTEND_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean),
]);

const jwks = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

const categories = [
  "Referral links",
  "WhatsApp groups",
  "Online jobs",
  "Scholarships & bursaries",
  "Attachments & internships",
  "Skill learning",
  "Contacts & referrals",
  "Events & competitions",
  "Business opportunities",
  "Other",
];

function response(
  body: unknown,
  status: number,
  origin: string | null,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };

  if (origin && origins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return new Response(JSON.stringify(body), { status, headers });
}

async function identity(request: Request) {
  const token = (request.headers.get("Authorization") ?? "")
    .match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token || !firebaseProjectId) return null;

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId,
      algorithms: ["RS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      payload.email_verified !== true
    ) {
      return null;
    }

    return {
      uid: payload.sub,
      email: payload.email.toLowerCase(),
      name: typeof payload.name === "string"
        ? payload.name
        : payload.email.split("@")[0],
    };
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");

  if (origin && !origins.has(origin)) {
    return new Response("Origin not allowed", { status: 403 });
  }

  if (request.method === "OPTIONS") {
    const headers = new Headers({
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      Vary: "Origin",
    });

    if (origin) headers.set("Access-Control-Allow-Origin", origin);

    return new Response(null, { status: 204, headers });
  }

  if (!["GET", "POST"].includes(request.method)) {
    return response({ error: "Method not allowed." }, 405, origin);
  }

  const user = await identity(request);

  if (!user) {
    return response({
      error: "Sign in with a verified Google account to use opportunities.",
    }, 401, origin);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return response({
      error: "Opportunity server configuration is incomplete.",
    }, 500, origin);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (request.method === "GET") {
    const { data: account, error: accountError } = await db
      .from("activation_accounts")
      .select("status")
      .eq("firebase_uid", user.uid)
      .maybeSingle();

    if (accountError) {
      return response({
        error: "Could not verify your Opportunities access.",
      }, 500, origin);
    }

    const hasAccess = account?.status === "active";

    const { data, error } = await db
      .from("opportunities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return response({
        error: "Could not load opportunities. Check the Opportunities database migration.",
      }, 500, origin);
    }

    // Never send private links or contacts to users without approved access.
    const opportunities = (data ?? []).map((item) => {
      if (hasAccess) return item;

      return {
        ...item,
        description: "Unlock access to view the full description and application instructions.",
        link_url: "",
        contact: null,
      };
    });

    return response({
      opportunities,
      has_access: hasAccess,
    }, 200, origin);
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return response({ error: "Invalid JSON body." }, 400, origin);
  }

  if (
    body.action !== "create" ||
    !body.opportunity ||
    typeof body.opportunity !== "object" ||
    Array.isArray(body.opportunity)
  ) {
    return response({ error: "Unsupported opportunity action." }, 400, origin);
  }

  const raw = body.opportunity as Record<string, unknown>;

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const category = typeof raw.category === "string" ? raw.category : "";
  const description = typeof raw.description === "string"
    ? raw.description.trim()
    : "";
  const link = typeof raw.link_url === "string"
    ? raw.link_url.trim()
    : "";
  const contact = typeof raw.contact === "string"
    ? raw.contact.trim()
    : "";
  const deadline = typeof raw.deadline === "string" && raw.deadline
    ? raw.deadline
    : null;

  let validLink = false;

  if (link.length <= 1500) {
    try {
      const parsed = new URL(link);
      validLink = ["https:", "http:"].includes(parsed.protocol) &&
        Boolean(parsed.hostname);
    } catch {
      // An empty link is allowed when contact details are supplied.
    }
  }

  const validDeadline = !deadline ||
    (/^\d{4}-\d{2}-\d{2}$/.test(deadline) &&
      !Number.isNaN(Date.parse(`${deadline}T00:00:00Z`)));

  if (
    title.length < 3 ||
    title.length > 140 ||
    !categories.includes(category) ||
    description.length < 10 ||
    description.length > 3000 ||
    (!validLink && !contact) ||
    (link !== "" && !validLink) ||
    contact.length > 150 ||
    !validDeadline
  ) {
    return response({
      error: "Enter a valid title, category and description, plus a valid link or contact. Check the deadline and field lengths.",
    }, 400, origin);
  }

  const { data, error } = await db
    .from("opportunities")
    .insert({
      created_by: user.uid,
      author_name: user.name.slice(0, 100),
      title,
      category,
      description,
      link_url: link || null,
      deadline,
      contact: contact || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Opportunity create failed:", error.message);
    return response({
      error: "Could not publish the opportunity. Please retry.",
    }, 500, origin);
  }

  return response({ opportunity: data }, 201, origin);
});
