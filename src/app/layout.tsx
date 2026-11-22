import type { Metadata } from "next";
import { LanguageProvider } from "@/components/LanguageProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DOCUMENT_TITLES } from "@/lib/i18n";
import { detectServerLocale } from "@/lib/server-locale";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await detectServerLocale();
  return {
    title: DOCUMENT_TITLES[locale],
    description:
      locale === "tr"
        ? "Mur4History — Model Context Protocol (MCP) tabanlı, harita odaklı alternatif tarih ve büyük strateji simülasyon platformu."
        : "Mur4History — Map-driven Model Context Protocol (MCP) alternate history & grand strategy simulation platform.",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLocale = await detectServerLocale();

  return (
    <html lang={initialLocale} className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary-foreground">
        <LanguageProvider initialLocale={initialLocale}>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
