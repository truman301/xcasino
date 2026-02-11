import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This route handles the email verification callback from Supabase.
// When a user clicks the confirmation link in their email, Supabase
// redirects to /auth/confirm?token_hash=...&type=...
// We exchange the token for a session and redirect to the home page.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const redirectUrl = new URL("/", request.url);

  if (!token_hash || !type) {
    redirectUrl.searchParams.set("auth_error", "Missing verification parameters");
    return NextResponse.redirect(redirectUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl.startsWith("http") || supabaseAnonKey.length < 10) {
    redirectUrl.searchParams.set("auth_error", "Supabase not configured");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as "signup" | "email",
  });

  if (error) {
    redirectUrl.searchParams.set("auth_error", error.message);
    return NextResponse.redirect(redirectUrl);
  }

  // Verification successful — redirect to home with success flag
  redirectUrl.searchParams.set("verified", "true");
  return NextResponse.redirect(redirectUrl);
}
