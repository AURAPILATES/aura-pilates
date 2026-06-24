"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import SyncStatusPanel from "./SyncStatusPanel";
import { usePendingRecurringCount } from "./usePendingRecurringCount";

const groups = [
  {
    links: [
      {
        href: "/horario",
        label: "Horario",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        ),
      },
      {
        href: "/clientes",
        label: "Clientes",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
      {
        href: "/analitica",
        label: "Analítica",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/>
          </svg>
        ),
      },
    ],
  },
  {
    links: [
      {
        href: "/finanzas",
        label: "Finanzas",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        ),
      },
      {
        href: "/transacciones",
        label: "Movimientos",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
        ),
      },
      {
        href: "/previsiones",
        label: "Previsiones",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        ),
      },
      {
        href: "/gastos-recurrentes",
        label: "Gastos recurrentes",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        ),
      },
    ],
  },
  {
    links: [
      {
        href: "/vacaciones",
        label: "Vacaciones",
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ),
      },
    ],
  },
];

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const pendingRecurringCount = usePendingRecurringCount();

  return (
    <aside className="hidden sm:flex fixed top-0 left-0 h-screen w-[220px] flex-col bg-white border-r border-navy/[0.07] z-30">
      {/* Logo */}
      <div className="px-5 py-5">
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
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="mx-3 my-2 border-t border-navy/[0.06]" />}
            <div className="space-y-0.5">
              {group.links.map(({ href, label, icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-[9px] px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-primary/[0.07] text-primary"
                        : "text-navy/55 hover:bg-navy/[0.04] hover:text-navy"
                    }`}
                  >
                    <span className={active ? "text-primary" : "text-navy/40"}>{icon}</span>
                    <span className="flex-1">{label}</span>
                    {href === "/gastos-recurrentes" && pendingRecurringCount > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-warning text-white text-[10px] font-bold px-1">
                        {pendingRecurringCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sync status */}
      <div className="border-t border-navy/[0.06]">
        <SyncStatusPanel />
      </div>

      {/* Settings */}
      <div className="px-3 py-4 border-t border-navy/[0.06]">
        <Link
          href="/configuracion"
          className={`flex items-center gap-[9px] px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
            pathname === "/configuracion"
              ? "bg-primary/[0.07] text-primary"
              : "text-navy/55 hover:bg-navy/[0.04] hover:text-navy"
          }`}
        >
          <span className={pathname === "/configuracion" ? "text-primary" : "text-navy/40"}>
            <IconSettings />
          </span>
          Configuración
        </Link>
      </div>
    </aside>
  );
}
