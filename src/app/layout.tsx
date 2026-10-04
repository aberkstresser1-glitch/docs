import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Docs",
    template: "%s | Docs",
  },
  description: "Private document creation, signing, storage, and offline access.",
  manifest: "/manifest.webmanifest",
  applicationName: "Docs",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Docs",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
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
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
