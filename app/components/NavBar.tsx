"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const links = [
  { href: "/",              label: "Dashboard" },
  { href: "/horario",       label: "Horario" },
  { href: "/finanzas",      label: "Finanzas" },
  { href: "/vacaciones",    label: "Vacaciones" },
  { href: "/transacciones", label: "Transacciones" },
];

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Cierra el menú al navegar
  useEffect(() => { setOpen(false); }, [pathname]);

  // Bloquea el scroll del body cuando el menú está abierto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* ── Top bar ── */}
      <nav className="border-b border-navy/10 bg-white px-4 py-3 sticky top-0 z-30">
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

          {/* Desktop links */}
          <div className="hidden sm:flex gap-6 text-sm">
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

          <div className="ml-auto flex items-center gap-2">
            {/* Settings */}
            <Link
              href="/configuracion"
              title="Configuración"
              className={`hidden sm:flex w-8 h-8 items-center justify-center rounded-lg transition-colors ${
                pathname === "/configuracion"
                  ? "text-primary bg-primary/[0.06]"
                  : "text-navy/30 hover:text-navy/60 hover:bg-navy/[0.04]"
              }`}
            >
              <IconSettings />
            </Link>

            {/* Hamburger — solo móvil */}
            <button
              onClick={() => setOpen(true)}
              className="sm:hidden w-8 h-8 flex flex-col items-center justify-center gap-1.5 rounded-lg text-navy/50 hover:bg-navy/[0.04] transition-colors"
              aria-label="Abrir menú"
            >
              <span className="w-4.5 h-px bg-current rounded-full block w-[18px]" />
              <span className="w-4.5 h-px bg-current rounded-full block w-[18px]" />
              <span className="w-4.5 h-px bg-current rounded-full block w-[14px] self-start ml-[2px]" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile menu overlay ── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="sm:hidden fixed inset-0 z-40 bg-navy/20 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="sm:hidden fixed top-0 right-0 bottom-0 z-50 w-72 bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy/10">
              <Image
                src="/logotipo.png"
                alt="Aura Pilates Studio"
                height={28}
                width={100}
                className="h-7 w-auto"
              />
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/30 hover:text-navy transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Links */}
            <nav className="flex-1 px-3 py-4 space-y-1">
              {links.map(({ href, label }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/[0.07] text-primary"
                        : "text-navy/60 hover:bg-navy/[0.04] hover:text-navy"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Settings link al pie */}
            <div className="px-3 py-4 border-t border-navy/10">
              <Link
                href="/configuracion"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  pathname === "/configuracion"
                    ? "bg-primary/[0.07] text-primary"
                    : "text-navy/40 hover:bg-navy/[0.04] hover:text-navy/70"
                }`}
              >
                <IconSettings />
                Configuración
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
