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
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 inline-block ${
        ok ? "bg-green-500" : "bg-red-500"
      }`}
    />
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
    <div className="px-4 pt-3 pb-1 space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-navy/30 mb-2">
        Última sync
      </p>

      {/* Momence */}
      <div className="flex items-start gap-2">
        <Dot ok={data.momence.ok} />
        <div className="min-w-0">
          <span className="text-xs text-navy/55">
            Momence · {relativeTime(data.momence.checkedAt, now)}
          </span>
          {!data.momence.ok && (
            <p className="text-[11px] text-red-500 leading-tight mt-0.5">
              {data.momence.error}
            </p>
          )}
        </div>
      </div>

      {/* Stripe */}
      <div className="flex items-start gap-2">
        <Dot ok={data.stripe.ok} />
        <div className="min-w-0">
          <span className="text-xs text-navy/55">
            Stripe · {relativeTime(data.stripe.checkedAt, now)}
          </span>
          {!data.stripe.ok && (
            <p className="text-[11px] text-red-500 leading-tight mt-0.5">
              {data.stripe.error}
            </p>
          )}
        </div>
      </div>

      {/* Banco */}
      <div className="flex items-center gap-2 pl-3.5">
        <span className="text-xs text-navy/40">
          Banco ·{" "}
          {data.banco.lastImport
            ? relativeTime(data.banco.lastImport, now)
            : "sin importaciones"}
        </span>
      </div>
    </div>
  );
}
