import type { Metadata } from "next";
import { Inter, DM_Mono, Playfair_Display } from "next/font/google";
import AppShell from "./components/AppShell";
import { DesignVersionProvider } from "./components/DesignVersionContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Aura Pilates · Panel interno",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${dmMono.variable} ${playfair.variable}`}>
      <body className="bg-app-bg text-navy antialiased">
        <DesignVersionProvider>
          <AppShell>{children}</AppShell>
        </DesignVersionProvider>
      </body>
    </html>
  );
}
