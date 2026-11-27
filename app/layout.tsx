import type { Metadata } from "next";
import "./globals.css";
import "./notebook.css";
import "./notebook-ranking.css";
import "./notebook-cards.css";

export const metadata: Metadata = {
  title: "PromoRadar · Central de ofertas",
  description: "Encontre ofertas, acompanhe preços e prepare suas próximas publicações.",
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
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
