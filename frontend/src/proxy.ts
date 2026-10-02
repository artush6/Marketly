import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { authConfig, localWorkspaceAllowed } from "@/lib/supabase/config";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path === "/reset-password" || path === "/manifest.webmanifest" || path === "/sw.js" || path.startsWith("/auth/")) return NextResponse.next();
  const config = authConfig();
  if (!config && localWorkspaceAllowed()) return NextResponse.next();
  let response = NextResponse.next({ request });
  let authenticated = false;
  if (config) {
    const client = createServerClient(config.url, config.key, { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    } });
    const { data, error } = await client.auth.getUser();
    authenticated = !error && !!data.user;
  }
  if (!authenticated) {
    const target = request.nextUrl.clone(); target.pathname = "/login";
    target.search = ""; target.searchParams.set("next", path + request.nextUrl.search);
    const denied = path.startsWith("/api/")
      ? NextResponse.json({ error: "Sign in to continue." }, { status: 401 })
      : NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
    denied.headers.set("Cache-Control", "private, no-store");
    return denied;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
