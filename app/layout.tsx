import "./globals.css";
import "./mobile-improvements.css";
export const metadata = { title: "CoachLog 教練紀錄", description: "學生訓練與身體數據管理" };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="zh-Hant"><body>{children}</body></html>; }
