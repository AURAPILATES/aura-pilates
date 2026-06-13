import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Para server components y server actions (bypassa RLS)
export function createServerClient() {
  return createClient(url, serviceKey);
}

// Para client components (respeta RLS)
export function createBrowserClient() {
  return createClient(url, anonKey);
}
