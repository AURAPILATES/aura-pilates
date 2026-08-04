"use client";

import { useEffect, useState } from "react";
import { MomenceEvent } from "@/lib/momence";
import { pct } from "@/lib/analytics";
import Drawer from "@/app/components/Drawer";
import { getSessionBookingsAction } from "@/app/actions/getSessionBookings";
import { momenceCustomerUrl } from "@/lib/momenceLinks";
import type { MomenceV2SessionBooking } from "@/lib/momenceV2";

function occColors(occ: number) {
  if (occ >= 1.0) return { badge: "bg-success/10 text-success", bar: "bg-success" };
  if (occ >= 0.5) return { badge: "bg-warning/10 text-warning", bar: "bg-warning" };
  return { badge: "bg-danger/10 text-danger", bar: "bg-danger" };
}

function occLabel(occ: number) {
  if (occ >= 1.0) return "Llena";
  if (occ >= 0.5) return "A medias";
  return "Por llenar";
}

export default function HorarioDrawer({
  event: e,
  onClose,
}: {
  event: MomenceEvent;
  onClose: () => void;
}) {
  const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
  const colors = occColors(occ);
  const isPast = new Date(e.dateTime).getTime() + e.duration * 60000 < Date.now();

  const [bookings, setBookings] = useState<MomenceV2SessionBooking[] | null>(null);
  useEffect(() => {
    setBookings(null);
    let cancelled = false;
    getSessionBookingsAction(e.id).then((bs) => { if (!cancelled) setBookings(bs); });
    return () => { cancelled = true; };
  }, [e.id]);

  const time = new Date(e.dateTime).toLocaleTimeString("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateLabel = new Date(e.dateTime).toLocaleDateString("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const endTime = new Date(new Date(e.dateTime).getTime() + e.duration * 60000).toLocaleTimeString(
    "es-ES",
    { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }
  );

  return (
    <Drawer
      title={e.title}
      subtitle={dateLabel}
      onClose={onClose}
      footer={
        e.link ? (
          <a
            href={e.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-navy/10 text-sm text-navy/60 hover:text-navy hover:border-navy/20 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Ver en Momence
          </a>
        ) : undefined
      }
    >
      {/* Time + teacher + location */}
      <div className="px-6 pt-5 pb-5 border-b border-navy/[0.07]">
        <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full mb-3 ${colors.badge}`}>
          {occLabel(occ)}
        </span>
        <p className="text-sm text-navy/55">{time} – {endTime} · {e.duration} min</p>
        {e.teacher && <p className="text-sm text-navy/70 mt-1">{e.teacher}</p>}
        {e.location && <p className="text-xs text-navy/40 mt-0.5">{e.location}</p>}
      </div>

      {/* Occupancy bar */}
      <div className="px-6 py-5 border-b border-navy/[0.07]">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-navy/45 font-medium uppercase tracking-wide">Ocupación</span>
          <span className={`text-sm font-bold ${colors.badge.split(" ")[1]}`}>{pct(occ)}</span>
        </div>
        <div className="h-2 bg-navy/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${colors.bar} transition-all`}
            style={{ width: `${Math.round(occ * 100)}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className={`grid ${(e.waitlistCount ?? 0) > 0 ? "grid-cols-3" : "grid-cols-2"} gap-3 px-6 py-5 border-b border-navy/[0.07]`}>
        <StatCard label="Apuntadas" value={`${e.ticketsSold} / ${e.capacity}`} />
        <StatCard label="Plazas libres" value={String(e.spotsRemaining)} accent={e.spotsRemaining === 0 ? "text-danger" : "text-success"} />
        {(e.waitlistCount ?? 0) > 0 && (
          <StatCard label="En espera" value={String(e.waitlistCount)} accent="text-[#a38540] dark:text-[#ceba8d]" />
        )}
      </div>

      {/* Slots */}
      <div className="px-6 py-5">
        <p className="text-xs font-medium text-navy/45 uppercase tracking-wide mb-3">
          Plazas ({e.capacity}){isPast && bookings && bookings.length > 0 ? " · asistencia" : ""}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {bookings === null ? (
            // Cargando: placeholder mientras llega la asistencia real de Momence.
            Array.from({ length: e.ticketsSold }, (_, i) => (
              <div key={i} className="h-[34px] rounded-lg bg-navy/[0.04] animate-pulse" />
            ))
          ) : (
            <>
              {[...bookings]
                .sort((a, b) => a.member.firstName.localeCompare(b.member.firstName, "es"))
                .map((b) => {
                  const dot = !isPast ? "bg-navy/30" : b.checkedIn ? "bg-success" : "bg-danger/60";
                  return (
                    <div key={b.id} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-navy/[0.04] text-navy/60">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                      <a
                        href={momenceCustomerUrl(b.member.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 truncate hover:text-navy hover:underline"
                        title="Ver ficha en Momence"
                      >
                        {b.member.firstName} {b.member.lastName}
                      </a>
                      {isPast && !b.checkedIn && (
                        <span className="text-[10px] font-medium text-danger shrink-0">No vino</span>
                      )}
                    </div>
                  );
                })}
              {/* Plazas vendidas que no cuadran con las reservas traídas (fallo parcial de Momence). */}
              {Array.from({ length: Math.max(0, e.ticketsSold - bookings.length) }, (_, i) => (
                <div key={`extra-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-navy/[0.04] text-navy/50">
                  <span className="w-2 h-2 rounded-full shrink-0 bg-navy/30" />
                  <span>Alumna {bookings.length + i + 1}</span>
                </div>
              ))}
            </>
          )}
          {Array.from({ length: Math.max(0, e.capacity - e.ticketsSold) }, (_, i) => (
            <div
              key={`free-${i}`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-success/5 border border-dashed border-success/30 text-success/60"
            >
              <span className="w-2 h-2 rounded-full shrink-0 bg-success/40" />
              <span>Plaza libre</span>
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

function StatCard({ label, value, accent = "text-navy" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-navy/[0.03] rounded-xl p-3">
      <p className="text-xs text-navy/40 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
