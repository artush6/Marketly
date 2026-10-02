import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/lib/supabase/server";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function identity() {
  const client = await serverAuth();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  return !error && data.user ? { client, user: data.user } : null;
}
export async function GET() {
  const auth = await identity();
  if (!auth) return reply({ error: "Sign in to continue." }, 401);
  const { data, error } = await auth.client
    .from("user_research_state")
    .select("key,value,revision")
    .eq("user_id", auth.user.id);
  if (error) {
    console.error("[account/state] Workspace hydration failed", error.code, error.message);
    const migrationMissing = error.code === "42P01" || error.code === "PGRST205";
    return reply({
      error: migrationMissing
        ? "Your sign-in worked, but Marketly’s workspace table is not installed in Supabase yet. Apply the user_research_state migration, then retry."
        : "Your sign-in worked, but the private workspace could not be read from Supabase. Check the user_research_state table and its row-level security policies, then retry.",
    }, 503);
  }
  return reply({ userId: auth.user.id, email: auth.user.email, records: data || [] });
}
export async function PUT(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return reply({ error: "Invalid origin." }, 403);
  const auth = await identity();
  if (!auth) return reply({ error: "Sign in to continue." }, 401);
  const text = await request.text();
  if (text.length > 2_000_000)
    return reply({ error: "Saved record is too large." }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return reply({ error: "Invalid JSON." }, 400);
  }
  const { key, value, revision } = body;
  if (
    typeof key !== "string" ||
    !/^marketly[.\w-]{1,100}$/.test(key) ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    (value !== null && typeof value !== "string")
  )
    return reply({ error: "Invalid workspace record." }, 422);
  const record = {
    user_id: auth.user.id,
    key,
    value,
    revision: revision + 1,
    updated_at: new Date().toISOString(),
  };
  const query =
    revision === 0
      ? auth.client.from("user_research_state").insert(record)
      : auth.client
          .from("user_research_state")
          .update(record)
          .eq("user_id", auth.user.id)
          .eq("key", key)
          .eq("revision", revision);
  const { data, error } = await query.select("revision").maybeSingle();
  if (error?.code === "23505" || (!error && !data))
    return reply(
      {
        error:
          "This record changed on another device. Reload before editing it again.",
      },
      409,
    );
  return error
    ? reply({ error: "Changes could not be synchronized." }, 503)
    : reply(data);
}
