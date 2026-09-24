import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList } from "node:net";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const blocked = new BlockList();
// Resolve and pin a public IPv4 address so redirects and DNS rebinding cannot
// turn a publisher preview into a request to the app's private network.
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");

async function readPage(
  url: URL,
  deadline: number,
  redirects = 0,
): Promise<{ html: string; url: URL }> {
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    redirects > 3
  )
    throw new Error("Unsupported URL");
  if (Date.now() >= deadline) throw new Error("Preview timed out");
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => blocked.check(address, "ipv4"))
  )
    throw new Error("Unsupported host");
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("Preview timed out");
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: addresses[0].address,
        servername: url.hostname,
        method: "GET",
        path: url.pathname + url.search,
        agent: false,
        headers: {
          Host: url.hostname,
          "User-Agent": "Marketly-LinkPreview/1.0",
          Accept: "text/html",
          "Accept-Encoding": "identity",
        },
      },
      (response) => {
        if (
          response.statusCode &&
          [301, 302, 303, 307, 308].includes(response.statusCode) &&
          response.headers.location
        ) {
          response.resume();
          clearTimeout(timer);
          try {
            resolve(
              readPage(
                new URL(response.headers.location, url),
                deadline,
                redirects + 1,
              ),
            );
          } catch (error) {
            reject(error);
          }
          return;
        }
        if (
          response.statusCode !== 200 ||
          !response.headers["content-type"]?.includes("text/html")
        ) {
          response.resume();
          reject(new Error("Publisher preview unavailable"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 512_000) {
            req.destroy(new Error("Publisher page too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({ html: Buffer.concat(chunks).toString("utf8"), url }),
        );
        response.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Preview timed out")),
      remaining,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
}

function decode(value: string) {
  return value
    .replace(
      /&(?:amp|quot|apos|lt|gt|#39|#x27);/gi,
      (entity) =>
        ({
          "&amp;": "&",
          "&quot;": '"',
          "&apos;": "'",
          "&lt;": "<",
          "&gt;": ">",
          "&#39;": "'",
          "&#x27;": "'",
        })[entity.toLowerCase()] || entity,
    )
    .replace(/&#(\d+);/g, (entity, n) =>
      Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : entity,
    )
    .trim();
}
function meta(html: string, key: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes: Record<string, string> = {};
    for (const match of tag.matchAll(
      /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
    ))
      attributes[match[1].toLowerCase()] = decode(match[2] ?? match[3]);
    if ((attributes.property || attributes.name)?.toLowerCase() === key)
      return attributes.content;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (typeof body.url !== "string" || body.url.length > 2048)
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    const { html, url } = await readPage(new URL(body.url), Date.now() + 8000);
    const headline =
      meta(html, "og:title") ||
      meta(html, "twitter:title") ||
      decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    if (!headline) throw new Error("No publisher metadata");
    let image: string | undefined;
    const rawImage = meta(html, "og:image") || meta(html, "twitter:image");
    if (rawImage) {
      try {
        const candidate = new URL(rawImage, url);
        if (
          candidate.protocol === "https:" &&
          !candidate.username &&
          !candidate.password
        )
          image = candidate.href;
      } catch {
        /* Text-only preview is still useful. */
      }
    }
    return NextResponse.json({
      headline: headline.slice(0, 300),
      summary: (
        meta(html, "og:description") ||
        meta(html, "description") ||
        ""
      ).slice(0, 800),
      source: (
        meta(html, "og:site_name") || url.hostname.replace(/^www\./, "")
      ).slice(0, 120),
      url: url.href,
      image,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Publisher preview unavailable. Use a public HTTPS article URL.",
      },
      { status: 422 },
    );
  }
}
