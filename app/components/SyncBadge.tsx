"use client";

import { useState, useEffect } from "react";

function relativeTime(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60)   return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  return `hace ${Math.floor(diff / 3600)} h`;
}

export default function SyncBadge({ source, syncedAt }: { source: string; syncedAt: string }) {
  const [label, setLabel] = useState(() => relativeTime(syncedAt));

  useEffect(() => {
    const id = setInterval(() => setLabel(relativeTime(syncedAt)), 30_000);
    return () => clearInterval(id);
  }, [syncedAt]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-navy/45">
      <span className="w-1.5 h-1.5 rounded-full bg-success inline-block shrink-0" />
      {source} · {label}
    </span>
  );
}
