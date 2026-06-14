"use client";

import { useEffect } from "react";
import { MomenceEvent } from "@/lib/momence";
import { fmt, pct } from "@/lib/analytics";

function occColors(occ: number) {
  if (occ >= 0.8) return { badge: "bg-success/10 text-success", bar: "bg-success" };
  if (occ >= 0.6) return { badge: "bg-primary/10 text-primary", bar: "bg-primary" };
  if (occ >= 0.4) return { badge: "bg-warning/10 text-warning", bar: "bg-warning" };
  return { badge: "bg-danger/10 text-danger", bar: "bg-danger" };
}

function occLabel(occ: number) {
  if (occ >= 0.8) return "Llena";
  if (occ >= 0.6) return "A medias";
  if (occ >= 0.4) return "Por llenar";
  return "Pocas plazas";
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
  const revenue = e.ticketsSold * e.fixedPrice;
  const potential = e.capacity * e.fixedPrice;

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

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
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white h-full flex flex-col overflow-y-auto shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/40 hover:text-navy transition-colors z-10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="px-6 pt-8 pb-6 border-b border-navy/[0.07]">
          <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full mb-3 ${colors.badge}`}>
            {occLabel(occ)}
          </span>
          <h2 className="text-2xl font-bold text-navy font-display leading-tight mb-2">{e.title}</h2>
          <p className="text-sm text-navy/55 capitalize">{dateLabel}</p>
          <p className="text-sm text-navy/55">{time} – {endTime} · {e.duration} min</p>
          {e.teacher && (
            <p className="text-sm text-navy/70 mt-1">{e.teacher}</p>
          )}
          {e.location && (
            <p className="text-xs text-navy/40 mt-0.5">{e.location}</p>
          )}
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
        <div className="grid grid-cols-2 gap-3 px-6 py-5 border-b border-navy/[0.07]">
          <StatCard label="Apuntadas" value={`${e.ticketsSold} / ${e.capacity}`} />
          <StatCard label="Plazas libres" value={String(e.spotsRemaining)} accent={e.spotsRemaining === 0 ? "text-danger" : "text-success"} />
          <StatCard label="Ingresos" value={fmt(revenue)} />
          <StatCard label="Potencial" value={fmt(potential)} accent="text-navy/45" />
        </div>

        {/* Slots */}
        <div className="px-6 py-5 flex-1">
          <p className="text-xs font-medium text-navy/45 uppercase tracking-wide mb-3">
            Plazas ({e.capacity})
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: e.capacity }, (_, i) => {
              const filled = i < e.ticketsSold;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    filled
                      ? "bg-navy/[0.04] text-navy/50"
                      : "bg-success/5 border border-dashed border-success/30 text-success/60"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${filled ? "bg-navy/30" : "bg-success/40"}`} />
                  <span>{filled ? `Alumna ${i + 1}` : "Plaza libre"}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Momence link */}
        {e.link && (
          <div className="px-6 pb-6">
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
          </div>
        )}
      </div>
    </div>
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
