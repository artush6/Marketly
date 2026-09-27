import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const client = await serverAuth();
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/settings?onboarding=1", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
