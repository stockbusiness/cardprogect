import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "タロット診断 | シャッフル演出デモ",
  description: "48枚カード診断UIのシャッフル演出プロトタイプ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#070b1c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-navy-950 text-gold-300 antialiased">{children}</body>
    </html>
  );
}
