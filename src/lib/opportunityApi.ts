
import { auth } from "./firebase";

export type OpportunityCategory =
  | "Referral links"
  | "WhatsApp groups"
  | "Online jobs"
  | "Scholarships & bursaries"
  | "Attachments & internships"
  | "Skill learning"
  | "Contacts & referrals"
  | "Events & competitions"
  | "Business opportunities"
  | "Other";

export interface Opportunity {
  id: string;
  created_by: string;
  author_name: string;
  title: string;
  category: OpportunityCategory;
  description: string;
  link_url: string | null;
  deadline: string | null;
  contact: string | null;
  created_at: string;
  updated_at: string;
}

export type OpportunityDraft = Pick<
  Opportunity,
  "title" | "category" | "description" | "link_url" | "deadline" | "contact"
>;

interface OpportunityListResponse {
  opportunities: Opportunity[];
  has_access: boolean;
}

const baseUrl = () =>
  `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "")}/functions/v1/opportunity-api`;

async function request<T>(
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<T> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Sign in to access opportunities.");
  }

  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

  if (!url || !key) {
    throw new Error("Opportunity service is not configured. Check your Supabase environment values.");
  }

  let response: Response;

  try {
    response = await fetch(baseUrl(), {
      method,
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        apikey: key,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error("Could not connect to opportunity-api. Check the deployment and FRONTEND_ORIGINS.");
  }

  const result = await response.json().catch(() => ({})) as {
    error?: string;
    opportunities?: Opportunity[];
    opportunity?: Opportunity;
    has_access?: boolean;
  };

  if (!response.ok) {
    throw new Error(result.error || `Opportunity request failed (HTTP ${response.status}).`);
  }

  if (method === "GET") {
    return {
      opportunities: result.opportunities ?? [],
      has_access: result.has_access === true,
    } as T;
  }

  if (!result.opportunity) {
    throw new Error("The server did not return the published opportunity.");
  }

  return result.opportunity as T;
}

export async function getOpportunities(): Promise<OpportunityListResponse> {
  return request<OpportunityListResponse>("GET");
}

export const createOpportunity = (opportunity: OpportunityDraft) =>
  request<Opportunity>("POST", { action: "create", opportunity });
