"use client";
import { useState } from "react";
import ImportModal from "./ImportModal";

export default function ImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/85 transition-colors shadow-sm"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Importar movimientos
      </button>
      {open && <ImportModal onClose={() => setOpen(false)} />}
    </>
  );
}
