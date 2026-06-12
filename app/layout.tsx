import type { Metadata } from "next";
import NavBar from "./components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aura Pilates · Panel interno",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-stone-50 text-stone-900">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
