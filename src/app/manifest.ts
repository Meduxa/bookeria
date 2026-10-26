import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/app";

// Installable app (PWA). Colours are the logo's own (design/brand); the
// manifest cannot use CSS tokens.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Bookings, calendar and clients for salons and clinics",
    start_url: "/ka/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#16233A",
    lang: "ka",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
