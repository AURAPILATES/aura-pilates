"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import SyncStatusPanel from "./SyncStatusPanel";
import ThemeToggle from "./ThemeToggle";
import { usePendingRecurringCount } from "./usePendingRecurringCount";
import { navGroups, IconSettings } from "./sidebarNav";

export default function Sidebar() {
  const pathname = usePathname();
  const pendingRecurringCount = usePendingRecurringCount();

  return (
    <aside className="hidden sm:flex fixed top-0 left-0 h-screen w-[220px] flex-col bg-[#f9f9f7] dark:bg-[#18161c] border-r border-navy/[0.07] z-30">
      {/* Logo */}
      <div className="px-5 py-5">
        <Link href="/">
          <Image
            src="/logotipo.png"
            alt="Aura Pilates Studio"
            height={32}
            width={120}
            className="h-8 w-auto dark:invert"
            priority
          />
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navGroups.map((group, gi) => (
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
                        ? "bg-navy/[0.04] text-navy"
                        : "text-navy/55 hover:bg-navy/[0.04] hover:text-navy"
                    }`}
                  >
                    <span className={active ? "text-navy" : "text-navy/40"}>{icon}</span>
                    <span className="flex-1">{label}</span>
                    {href === "/transacciones" && pendingRecurringCount > 0 && (
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
      <div className="px-3 py-4 border-t border-navy/[0.06] space-y-0.5">
        <Link
          href="/configuracion"
          className={`flex items-center gap-[9px] px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
            pathname === "/configuracion"
              ? "bg-navy/[0.04] text-navy"
              : "text-navy/55 hover:bg-navy/[0.04] hover:text-navy"
          }`}
        >
          <span className={pathname === "/configuracion" ? "text-navy" : "text-navy/40"}>
            <IconSettings />
          </span>
          Configuración
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  );
}
