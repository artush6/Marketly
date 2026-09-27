import { createBrowserClient } from "@supabase/ssr";
import { authConfig } from "./config";
export function browserAuth() {
  const config = authConfig();
  if (!config) throw new Error("Authentication has not been configured.");
  return createBrowserClient(config.url, config.key);
}
