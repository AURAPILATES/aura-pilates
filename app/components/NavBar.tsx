"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/horario", label: "Horario" },
  { href: "/finanzas", label: "Finanzas" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-navy/10 bg-white px-6 py-3 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto flex items-center gap-8">
        <Link href="/">
          <Image
            src="/logotipo.png"
            alt="Aura Pilates Studio"
            height={32}
            width={120}
            className="h-8 w-auto"
            priority
          />
        </Link>
        <div className="flex gap-6 text-sm">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={
                pathname === href
                  ? "text-primary font-medium"
                  : "text-navy/40 hover:text-navy/70 transition-colors"
              }
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
