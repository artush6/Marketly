"use client";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ensureCompanyMetadata, readMetadata, serverMetadata, subscribeMetadata } from "@/lib/company-metadata";

export function CompanyLogo({ symbol, size = "small" }: {
  symbol: string; size?: "small" | "medium" | "large";
}) {
  const company = useSyncExternalStore(subscribeMetadata, () => readMetadata(symbol), serverMetadata);
  const [failedUrl, setFailedUrl] = useState<string>();
  useEffect(() => { ensureCompanyMetadata(symbol); }, [symbol]);
  const logo = company?.logoUrl;
  const src = typeof logo === "string" && logo.startsWith("https://") && logo !== failedUrl ? logo : undefined;
  const pixels = size === "large" ? 49 : size === "medium" ? 38 : 29;
  return <span className={size === "small" ? "mini-monogram company-logo" : `company-monogram company-logo ${size === "large" ? "large" : ""}`}
    style={{ width: pixels, height: pixels, overflow: "hidden", flex: "0 0 auto" }} aria-hidden="true">
    {src ? <Image src={src} alt="" width={pixels} height={pixels} unoptimized
      style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2, background: "#fff" }}
      onError={() => setFailedUrl(src)} /> : symbol.slice(0, 1)}
  </span>;
}
