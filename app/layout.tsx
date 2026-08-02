import type { Metadata } from "next";
import { Inter, DM_Mono, Playfair_Display } from "next/font/google";
import AppShell from "./components/AppShell";
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}try{if(localStorage.getItem('navRail')==='1'){document.documentElement.classList.add('nav-rail')}}catch(e){}try{if(localStorage.getItem('tablesFlat')==='1'){document.documentElement.classList.add('tables-flat')}}catch(e){}try{if(localStorage.getItem('skin')==='precision'){document.documentElement.setAttribute('data-skin','precision')}}catch(e){}`,
          }}
        />
      </head>
      <body className="bg-app-bg text-navy antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
