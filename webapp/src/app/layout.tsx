import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SyncProvider } from "@/contexts/sync-context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Jetline Machines | Fleet Management",
  description: "Printer fleet management and optimization system for Jetline stores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <SyncProvider>{children}</SyncProvider>
      </body>
    </html>
  );
}
