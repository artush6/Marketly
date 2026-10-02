export function authConfig() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!configuredUrl || !key) return null;

  // Backend deployments often store the REST endpoint ending in /rest/v1.
  // Browser auth needs the project root so it can append /auth/v1 itself.
  const url = configuredUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  return { url, key };
}
export function localWorkspaceAllowed() {
  return process.env.NODE_ENV === "development" && process.env.MARKETLY_ALLOW_LOCAL_WORKSPACE === "true";
}
