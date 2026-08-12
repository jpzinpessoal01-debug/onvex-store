import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ToastProvider } from "@/components/ToastProvider";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "ONVEX — Jiu-Jitsu Premium", template: "%s | ONVEX" },
  description: "Rash guards, shorts de luta e acessórios premium para quem vive o Jiu-Jitsu. Entre para o ONVEX Member.",
  applicationName: "ONVEX",
  keywords: ["Jiu-Jitsu", "rash guard", "short de luta", "garrafa", "chaveiro", "mochila", "ONVEX"],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ONVEX",
    title: "ONVEX — Domine cada rolamento",
    description: "Produtos desenvolvidos para quem vive o Jiu-Jitsu.",
    images: [{ url: "/onvex-hero.webp", width: 1536, height: 967, alt: "Atleta ONVEX de Jiu-Jitsu" }],
  },
  robots: { index: true, follow: true },
  other: { "codex-preview": "development" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#050505" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ToastProvider>
          <div className="public-header"><Header /></div>
          <div className="site-shell">{children}</div>
          <div className="public-footer"><Footer /></div>
        </ToastProvider>
      </body>
    </html>
  );
}
