import type { Metadata } from "next";
import "./globals.css";
import { TopNavShell } from "@/components/TopNavShell";

export const metadata: Metadata = {
  title: "FM27 Tactics Studio",
  description:
    "Football Manager 27 Dual-Phase Tactic Builder, Squad Advisor, Wonderkids Scout, Coaching Staff & Training Schedule.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col bg-[#0B0F19] text-slate-50"
      >
        <TopNavShell />
        <div className="flex-1 w-full max-w-[1640px] mx-auto px-4 sm:px-6 py-5">
          {children}
        </div>
      </body>
    </html>
  );
}
