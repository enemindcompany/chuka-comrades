
import { createClient } from "@supabase/supabase-js";
import { auth } from "./firebase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. Check .env.local."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    accessToken: async () => {
      return (
        (await auth.currentUser?.getIdToken(false)) ?? null
      );
    },
  }
);
