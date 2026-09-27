export function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}
export function localWorkspaceAllowed() {
  return process.env.NODE_ENV === "development" && process.env.MARKETLY_ALLOW_LOCAL_WORKSPACE === "true";
}
