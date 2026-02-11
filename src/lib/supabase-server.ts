import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const isConfigured = supabaseUrl.startsWith("http") && supabaseAnonKey.length > 10;

/**
 * Create an authenticated Supabase client for API routes.
 * Pass the Bearer token from the request's Authorization header.
 */
export function createServerClient(token: string) {
  if (!isConfigured) throw new Error("Supabase is not configured");
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

/**
 * Create an anonymous Supabase client (no auth) for public reads.
 */
export function createAnonClient() {
  if (!isConfigured) throw new Error("Supabase is not configured");
  return createClient(supabaseUrl, supabaseAnonKey);
}
