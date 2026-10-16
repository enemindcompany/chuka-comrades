import { auth } from "./firebase";

const API_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/firebase-api`;

export interface StudentProfile {
  id: string;
  display_name: string | null;
  university: string;
  campus: string | null;
  course: string | null;
  year_of_study: number | null;
  avatar_url: string | null;
  whatsapp_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentProfileInput {
  display_name?: string | null;
  campus?: string | null;
  course?: string | null;
  year_of_study?: number | null;
  avatar_url?: string | null;
  whatsapp_number?: string | null;
}

interface ProfileResponse<T> {
  profile: T;
}

async function request<T>(
  method: "GET" | "POST",
  body?: StudentProfileInput,
): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Please sign in before accessing your profile.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("The profile API URL is not configured.");
  }

  const token = await user.getIdToken();
  const response = await fetch(API_URL, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Your session could not be verified. Please sign in again.",
      );
    }
    throw new Error(`Profile request failed (HTTP ${response.status}).`);
  }

  const result = (await response.json()) as ProfileResponse<T>;
  return result.profile;
}

export function getStudentProfile() {
  return request<StudentProfile | null>("GET");
}

export function saveStudentProfile(input: StudentProfileInput) {
  return request<StudentProfile>("POST", input);
}
