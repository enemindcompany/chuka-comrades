import { auth } from "./firebase";

export type ActivationStatus = "trial" | "pending" | "active" | "rejected";

export interface ActivationAccount {
  firebase_uid: string;
  email: string;
  trial_started_at: string;
  trial_ends_at: string;
  status: ActivationStatus;
  payment_reference: string | null;
  payment_submitted_at: string | null;
  activated_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

const getApiUrl = () => `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "")}/functions/v1/activation-api`;

async function request<T>(
  resource: "activation" | "admin-payments",
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in before checking activation.");

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  if (!supabaseUrl || !publishableKey || supabaseUrl.includes("your-project")) {
    throw new Error("The activation service is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.");
  }

  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}?resource=${resource}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    console.error("Activation API network error:", error);
    const siteOrigin = typeof window !== "undefined" ? window.location.origin : "your website origin";
    throw new Error(`The browser could not connect to activation-api. Check that VITE_SUPABASE_URL points to your Supabase project, activation-api is deployed, and FRONTEND_ORIGINS includes exactly: ${siteOrigin} (no trailing slash). A CORS block can look like a network error.`);
  }

  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
    activation?: T;
    payments?: T;
  };

  if (!response.ok) {
    throw new Error(result.error || `Activation request failed (HTTP ${response.status}).`);
  }

  if (resource === "activation") return result.activation as T;
  return result.payments as T;
}

export function getActivation() {
  return request<ActivationAccount>("activation", "GET");
}

export function submitActivationPayment(paymentReference: string) {
  return request<ActivationAccount>("activation", "POST", {
    action: "submit-payment",
    payment_reference: paymentReference,
  });
}

export function getAdminPayments() {
  return request<ActivationAccount[]>("admin-payments", "GET");
}

export function reviewActivationPayment(
  firebaseUid: string,
  decision: "approved" | "rejected",
) {
  return request<ActivationAccount>("admin-payments", "POST", {
    action: "review-payment",
    firebase_uid: firebaseUid,
    decision,
  });
}
