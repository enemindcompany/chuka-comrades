import { auth } from "./firebase";

export type OpportunityCategory = "Referral links" | "WhatsApp groups" | "Online jobs" | "Scholarships & bursaries" | "Attachments & internships" | "Skill learning" | "Other";
export interface Opportunity {
  id: string; created_by: string; author_name: string; title: string; category: OpportunityCategory;
  description: string; link_url: string; deadline: string | null; contact: string | null;
  created_at: string; updated_at: string;
}
export type OpportunityDraft = Omit<Opportunity, "id" | "created_by" | "author_name" | "created_at" | "updated_at">;
const baseUrl = () => `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "")}/functions/v1/opportunity-api`;
async function request<T>(method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to access opportunities.");
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("Opportunity service is not configured. Check your Supabase environment values.");
  let response: Response;
  try { response = await fetch(baseUrl(), { method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, apikey: key, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
  catch { throw new Error("Could not connect to opportunity-api. Deploy the function and check FRONTEND_ORIGINS."); }
  const result = await response.json().catch(() => ({})) as { error?: string; opportunities?: T; opportunity?: T };
  if (!response.ok) throw new Error(result.error || `Opportunity request failed (HTTP ${response.status}).`);
  return (method === "GET" ? result.opportunities : result.opportunity) as T;
}
export const getOpportunities = () => request<Opportunity[]>("GET");
export const createOpportunity = (opportunity: OpportunityDraft) => request<Opportunity>("POST", { action: "create", opportunity });
