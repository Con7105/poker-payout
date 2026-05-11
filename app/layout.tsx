import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker buy-in settlement",
  description: "Minimize Venmo-style transfers after a poker game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
