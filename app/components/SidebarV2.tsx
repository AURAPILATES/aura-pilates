"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import SyncStatusPanel from "./SyncStatusPanel";
import DesignVersionToggle from "./DesignVersionToggle";
import { usePendingRecurringCount } from "./usePendingRecurringCount";
import { navGroups, IconSettings } from "./sidebarNav";

/** Sidebar del rediseño en prueba — misma navegación/datos que Sidebar.tsx, con el
 * lenguaje visual del mockup (radios más generosos, activo en gris cálido #ecebe7). */
export default function SidebarV2() {
  const pathname = usePathname();
  const pendingRecurringCount = usePendingRecurringCount();

  return (
    <aside className="hidden sm:flex fixed top-0 left-0 h-screen w-[262px] flex-col bg-[#faf9f6] border-r border-[#ededea] z-30 px-5 pt-[26px] pb-5">
      {/* Logo */}
      <div className="px-2 pb-1">
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
      <nav className="flex flex-col gap-0.5 mt-11 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="mx-3 my-[11px] border-t border-[#ededea]" />}
            <div className="space-y-0.5">
              {group.links.map(({ href, label, icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-[13px] px-3 py-[11px] rounded-[11px] text-[15px] transition-colors ${
                      active
                        ? "bg-[#ecebe7] text-[#18181b] font-semibold"
                        : "text-[#71717a] hover:bg-[#ecebe7]/60 hover:text-[#18181b]"
                    }`}
                  >
                    <span className={active ? "text-[#18181b]" : "text-[#71717a]/70"}>{icon}</span>
                    <span className="flex-1">{label}</span>
                    {href === "/transacciones" && pendingRecurringCount > 0 && (
                      <span className="shrink-0 min-w-[19px] h-[19px] flex items-center justify-center rounded-full bg-[#b45309] text-white text-[11px] font-semibold px-1.5">
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

      <div className="flex-1" />

      {/* Sync status */}
      <div className="border-t border-[#ededea] -mx-5 px-5">
        <SyncStatusPanel />
      </div>

      {/* Toggle + Settings */}
      <div className="border-t border-[#ededea] mt-[14px] pt-[14px] space-y-0.5">
        <DesignVersionToggle />
        <Link
          href="/configuracion"
          className={`flex items-center gap-[13px] px-3 py-[11px] rounded-[11px] text-[15px] transition-colors ${
            pathname === "/configuracion"
              ? "bg-[#ecebe7] text-[#18181b] font-semibold"
              : "text-[#71717a] hover:bg-[#ecebe7]/60 hover:text-[#18181b]"
          }`}
        >
          <span className={pathname === "/configuracion" ? "text-[#18181b]" : "text-[#71717a]/70"}>
            <IconSettings />
          </span>
          Configuración
        </Link>
      </div>
    </aside>
  );
}
