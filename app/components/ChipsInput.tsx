"use client";
import { useState } from "react";

/** Lista de chips removibles + input para añadir uno más con Enter o al perder el foco —
 * mismo patrón visual en Configuración > Contactos (conceptos bancarios de un contacto) y
 * Configuración > Categorías (conceptos bancarios que auto-categorizan). */
export default function ChipsInput({ values, onChange, placeholder = "+ añadir…", clean }: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  clean?: (raw: string) => string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const raw = draft.trim();
    if (!raw) return;
    const v = clean ? clean(raw) : raw;
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy/[0.04] rounded-full text-[11px] text-navy/55">
          {v}
          <button onClick={() => onChange(values.filter((x) => x !== v))} className="text-navy/30 hover:text-danger transition-colors">✕</button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        className="w-36 px-1.5 py-0.5 text-[11px] border border-navy/15 rounded-full focus:outline-none focus:border-primary/40"
      />
    </div>
  );
}
