"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/horario", label: "Horario" },
  { href: "/finanzas", label: "Finanzas" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-stone-200 bg-white px-6 py-4 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto flex items-center gap-8">
        <span className="font-semibold tracking-wide text-stone-900">
          Aura Pilates ✦
        </span>
        <div className="flex gap-6 text-sm">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={
                pathname === href
                  ? "text-stone-900 font-medium"
                  : "text-stone-400 hover:text-stone-700 transition-colors"
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
