import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { Suspense } from "react";
import { Nav } from "@/components/nav";
import "./globals.css";

const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"] });

export const metadata: Metadata = {
  title: "JobHunter",
  description: "חיפוש עבודה חכם — משרות מדורגות לפי התאמה אליך",
  appleWebApp: { capable: true, title: "JobHunter", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} antialiased`}>
      <body className="min-h-dvh">
        <Suspense fallback={null}>
          <Nav />
        </Suspense>
        <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-8 md:pt-6">{children}</main>
      </body>
    </html>
  );
}
