import type { MetadataRoute } from "next";

/**
 * Lets phones add Tickline to the home screen. There is deliberately no service worker:
 * checks hold confidential documents, so nothing is cached for offline use.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tickline",
    short_name: "Tickline",
    description:
      "Multilingual pre-shipment check for commercial invoices, packing lists and purchase orders.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#EEF2F6",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
