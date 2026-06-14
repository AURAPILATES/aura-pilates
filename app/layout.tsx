import type { Metadata } from "next";
import { Inter, DM_Mono, Playfair_Display } from "next/font/google";
import Sidebar from "./components/Sidebar";
import BottomNav from "./components/BottomNav";
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
        <Sidebar />
        <div className="sm:pl-[220px]">
          <div className="pb-20 sm:pb-0">{children}</div>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
