import type { Metadata } from "next";
import { Inter, DM_Mono } from "next/font/google";
import NavBar from "./components/NavBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Aura Pilates · Panel interno",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${dmMono.variable}`}>
      <body className="bg-app-bg text-navy antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
