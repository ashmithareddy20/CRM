import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRH360 — Human + AI CRM",
  description:
    "A unified desktop and mobile CRM for telecalling, operations, management, leadership, administration, and Voice AI.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
