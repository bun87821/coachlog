import "./globals.css";
import "./mobile-improvements.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "CoachLog 教練紀錄",
  description: "學生訓練與身體數據管理",
  manifest: "/manifest.webmanifest",
  applicationName: "CoachLog",
  appleWebApp: {
    capable: true,
    title: "CoachLog",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#17211b",
  viewportFit: "cover",
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="zh-Hant"><body>{children}</body></html>; }
