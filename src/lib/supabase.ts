import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Read env vars at runtime (not build time)
function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}
function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

// Check if Supabase is properly configured
export const isSupabaseConfigured =
  getSupabaseUrl().startsWith("http") && getSupabaseAnonKey().length > 10;

// Lazy-initialized singleton client
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase && isSupabaseConfigured) {
    _supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
  }
  return _supabase as SupabaseClient;
}

// Named export for backward compat — lazy getter via Proxy
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) return undefined;
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
