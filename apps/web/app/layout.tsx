import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Starbridge Control Plane",
  description: "Event-driven agents backed by SpacetimeDB v2, Rust, and Vercel."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

