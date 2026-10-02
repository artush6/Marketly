import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Marketly Market Alerts",
    short_name: "Marketly",
    description: "Follow companies and receive sourced market alerts.",
    start_url: "/alerts",
    scope: "/",
    display: "standalone",
    background_color: "#080b0c",
    theme_color: "#080b0c",
    icons: [
      { src: "/marketly-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
