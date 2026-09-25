export const LOCAL_BACKEND_URL = "http://127.0.0.1:8000";
export const RENDER_BACKEND_URL = "https://marketly-sxn7.onrender.com";

export function backendServerUrl() {
  const fallback =
    process.env.NODE_ENV === "development"
      ? LOCAL_BACKEND_URL
      : RENDER_BACKEND_URL;
  return (process.env.BACKEND_API_URL || fallback).replace(/\/$/, "");
}
