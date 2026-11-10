import type { Metadata, Viewport } from "next";
import { geist, jakarta } from "@/lib/ui/fonts";
import { cn } from "@/lib/ui/utils";
import "./globals.css";
import { SyncProvider } from "@/contexts/sync-context";

export const metadata: Metadata = {
  title: "Jetline Machines | Fleet Management",
  description: "Printer fleet management and optimization system for Jetline stores",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-ZA" className={cn(jakarta.variable, geist.variable)}>
      <body>
        <SyncProvider>{children}</SyncProvider>
      </body>
    </html>
  );
}
