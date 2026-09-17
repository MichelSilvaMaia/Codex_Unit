import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "Codex Unit — Operações",
    short_name: "Codex Unit",
    description: "Reservas, custódia e manutenção de veículos e equipamentos.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#244aa6",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
