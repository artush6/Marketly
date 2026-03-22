import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BACKEND_URL = "https://marketly-sxn7.onrender.com";

function getBackendBaseUrl() {
  return (process.env.BACKEND_API_URL || DEFAULT_BACKEND_URL).replace(/\/$/, "");
}

function buildTargetUrl(path: string[], request: NextRequest) {
  const url = new URL(`${getBackendBaseUrl()}/${path.join("/")}`);
  const searchParams = new URL(request.url).searchParams;

  searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  return url;
}

async function proxy(request: NextRequest, path: string[]) {
  const targetUrl = buildTargetUrl(path, request);
  const headers = new Headers();
  const contentType = request.headers.get("content-type");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    cache: "no-store",
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
  });

  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}
