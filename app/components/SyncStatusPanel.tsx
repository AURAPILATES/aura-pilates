"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { syncStripe } from "@/app/actions/syncStripe";
import { syncMomence } from "@/app/actions/syncMomence";

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
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-navy-solid px-2.5 py-1.5 text-[10px] text-white opacity-0 group-hover/dot:opacity-100 transition-opacity shadow-xl">
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
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sync-status", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    load();
    const pollId = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(pollId);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  function handleSync() {
    startTransition(async () => {
      await Promise.all([syncStripe(), syncMomence()]);
      await load();
    });
  }

  if (!data) return null;

  return (
    <div className="px-5 py-3 space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-navy/25">
          Última sync
        </p>
        <button
          onClick={handleSync}
          disabled={pending}
          title="Sincronizar Stripe y Momence"
          className="flex items-center justify-center w-6 h-6 rounded-full bg-navy/[0.04] text-navy/40 hover:text-navy hover:bg-navy/[0.08] hover:rotate-90 transition-all duration-300 disabled:opacity-40 disabled:hover:rotate-0"
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={pending ? "animate-spin" : ""}
          >
            <path d="M1 4v6h6M23 20v-6h-6"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
        </button>
      </div>
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
        tooltip="Importación manual - subí el CSV desde Transacciones"
      />
    </div>
  );
}
