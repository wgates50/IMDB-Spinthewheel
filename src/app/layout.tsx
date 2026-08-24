import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spin the Wheel — IMDb Watchlist",
  description:
    "Load your IMDb watchlist, filter it down, and let a wheel pick what you watch tonight.",
};

export const viewport = {
  themeColor: "#121212",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
