import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import SwRegister from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "Wellness Challenge 2026 | Federated Co-operatives Limited",
  description: "Track your wellness activities, earn points, and win prizes with your team.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Wellness Challenge",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b3d2e" },
    { media: "(prefers-color-scheme: dark)", color: "#0b3d2e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <SwRegister />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
