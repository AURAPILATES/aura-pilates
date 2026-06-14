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

function Row({
  label,
  time,
  ok,
  error,
  showDot,
}: {
  label: string;
  time: string;
  ok?: boolean;
  error?: string | null;
  showDot?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        {showDot && (
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              ok ? "bg-green-500" : "bg-red-500"
            }`}
          />
        )}
        {!showDot && <span className="w-1.5 shrink-0" />}
        <span className="text-[11px] text-navy/50 leading-none">
          {label}
        </span>
        <span className="text-[11px] text-navy/30 leading-none">·</span>
        <span className="text-[11px] text-navy/35 leading-none">{time}</span>
      </div>
      {showDot && !ok && error && (
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
        ok={data.momence.ok}
        error={data.momence.error}
        showDot
      />
      <Row
        label="Stripe"
        time={relativeTime(data.stripe.checkedAt, now)}
        ok={data.stripe.ok}
        error={data.stripe.error}
        showDot
      />
      <Row
        label="Banco"
        time={
          data.banco.lastImport
            ? relativeTime(data.banco.lastImport, now)
            : "sin datos"
        }
        showDot={false}
      />
    </div>
  );
}
