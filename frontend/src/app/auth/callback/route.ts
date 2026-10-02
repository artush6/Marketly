import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\")
    ? requestedNext
    : "/";
  try {
    const client = await serverAuth();
    if (code && client) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, request.url));
    }
  } catch {
    // Send the user back to login with a useful, non-sensitive status. Never
    // include OAuth codes or provider error descriptions in the redirect URL.
  }
  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
