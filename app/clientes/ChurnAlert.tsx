"use client";

import { useState } from "react";

type Props = {
  count: number;
  names: string[];
};

export default function ChurnAlert({ count, names }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 border border-warning/30 bg-warning/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning shrink-0">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="flex-1 text-sm font-semibold text-warning">
          {count} cliente{count !== 1 ? "s" : ""} sin pagar este mes
        </p>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`text-warning/60 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-warning/20 pt-3">
          {names.map((name) => (
            <span key={name} className="bg-white border border-warning/20 rounded-md px-3 py-1 text-sm font-medium text-navy">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
