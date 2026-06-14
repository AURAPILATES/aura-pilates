"use client";

import { useState, useEffect } from "react";

type SourceStatus = { ok: boolean; checkedAt: string; error: string | null };
type SyncData = {
  momence: SourceStatus;
  stripe: SourceStatus;
  banco: { lastImport: string | null };
};

function relativeTime(isoDate: string, now: number): string {
  const diff = Math.floor((now - new Date(isoDate).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

type DotColor = "green" | "red" | "grey";

function Dot({ color, tooltip }: { color: DotColor; tooltip: string }) {
  const bg =
    color === "green" ? "bg-green-500"
    : color === "red"  ? "bg-red-500"
    : "bg-navy/25";

  return (
    <span className="relative group/dot flex items-center shrink-0">
      <span className={`w-1.5 h-1.5 rounded-full ${bg}`} />
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-navy px-2.5 py-1.5 text-[10px] text-white opacity-0 group-hover/dot:opacity-100 transition-opacity shadow-xl">
        {tooltip}
      </span>
    </span>
  );
}

function Row({
  label,
  time,
  dot,
  tooltip,
  error,
}: {
  label: string;
  time: string;
  dot: DotColor;
  tooltip: string;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <Dot color={dot} tooltip={tooltip} />
        <span className="text-[11px] text-navy/50 leading-none">{label}</span>
        <span className="text-[11px] text-navy/30 leading-none">·</span>
        <span className="text-[11px] text-navy/35 leading-none">{time}</span>
      </div>
      {dot === "red" && error && (
        <p className="text-[10px] text-red-400 leading-tight pl-3">{error}</p>
      )}
    </div>
  );
}

export default function SyncStatusPanel() {
  const [data, setData] = useState<SyncData | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/sync-status");
        if (!cancelled && res.ok) setData(await res.json());
      } catch {
        // silent
      }
    }
    load();
    const pollId = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!data) return null;

  return (
    <div className="px-5 py-3 space-y-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-navy/25 mb-2">
        Última sync
      </p>
      <Row
        label="Momence"
        time={relativeTime(data.momence.checkedAt, now)}
        dot={data.momence.ok ? "green" : "red"}
        tooltip={
          data.momence.ok
            ? "Todo correcto"
            : `Error al conectar con Momence${data.momence.error ? `: ${data.momence.error}` : ""}`
        }
        error={data.momence.error}
      />
      <Row
        label="Stripe"
        time={relativeTime(data.stripe.checkedAt, now)}
        dot={data.stripe.ok ? "green" : "red"}
        tooltip={
          data.stripe.ok
            ? "Todo correcto"
            : `Error al conectar con Stripe${data.stripe.error ? `: ${data.stripe.error}` : ""}`
        }
        error={data.stripe.error}
      />
      <Row
        label="Banco"
        time={data.banco.lastImport ? relativeTime(data.banco.lastImport, now) : "sin datos"}
        dot="grey"
        tooltip="Importación manual — subí el CSV desde Transacciones"
      />
    </div>
  );
}
