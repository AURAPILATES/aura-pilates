"use client";
import { useState } from "react";

/** Lista de chips removibles + input para añadir uno más con Enter o al perder el foco -
 * mismo patrón visual en Configuración > Contactos (conceptos bancarios de un contacto) y
 * Configuración > Categorías (conceptos bancarios que auto-categorizan). */
export default function ChipsInput({ values, onChange, placeholder = "+ añadir…", clean, bare = false }: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  clean?: (raw: string) => string;
  /** Sin borde propio en el input de añadir, para ir dentro de un <Field> (el fieldset ya
   * pone el borde del conjunto). */
  bare?: boolean;
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
        <span key={v} className="inline-flex items-center gap-1.5 h-[26px] pl-2.5 pr-1.5 bg-card border border-border rounded-[7px] text-[12px] text-navy">
          {v}
          <button onClick={() => onChange(values.filter((x) => x !== v))} className="text-faint hover:text-danger transition-colors leading-none">✕</button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        className={
          bare
            ? "h-[26px] min-w-[80px] flex-1 text-[13px] bg-transparent outline-none placeholder:text-navy/30"
            : "h-[26px] w-32 px-2.5 text-[12px] bg-card border border-dashed border-navy/25 rounded-[7px] focus:outline-none focus:border-solid focus:border-primary/50 placeholder:text-faint"
        }
      />
    </div>
  );
}
