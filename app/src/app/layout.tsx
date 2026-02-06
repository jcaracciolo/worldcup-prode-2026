import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeCustomizer from "@/components/ThemeCustomizer";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WorldCupProde",
  description: "Fantasy predictions for FIFA World Cup 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-gray-100 min-h-screen antialiased`}
      >
        <Providers>{children}</Providers>
        <ThemeCustomizer />
      </body>
    </html>
  );
}
