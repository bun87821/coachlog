import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CoachLog 教練紀錄",
    short_name: "CoachLog",
    description: "學生訓練、身體數據與預約管理",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f4ed",
    theme_color: "#17211b",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
