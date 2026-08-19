"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeText } from "@/lib/normalizeText";
import Avatar from "@/app/components/Avatar";
import { knownDomain, initials } from "@/app/configuracion/ContactosManager";
import type { Contact } from "./actions";

export type ContactPickResult = { contactId: number; label: string } | { newLabel: string };

/** Combobox para vincular un texto bancario a un Contacto guardado en Configuración > Contactos,
 * o crear uno nuevo escribiendo un nombre que no matchea ninguno. Se usa tanto en el detalle de
 * un movimiento (TransactionDrawer) como al confirmar gastos recurrentes (RecurrentesList). */
export default function ContactPicker({
  value,
  contacts,
  onPick,
  placeholder = "Buscar contacto o crear…",
  disabled,
  commitOnBlur = false,
  bare = false,
}: {
  value: string;
  contacts: Contact[];
  onPick: (result: ContactPickResult) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Si true, al hacer clic fuera con texto libre distinto al valor actual se confirma como
   * vinculación inmediata (match exacto o contacto nuevo) - comportamiento del selector dentro
   * del detalle de movimiento, donde no hay un botón "Confirmar" separado. */
  commitOnBlur?: boolean;
  /** Sin borde propio, para ir dentro de un <Field> (el fieldset ya pone el borde). */
  bare?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);

  const options = useMemo(() => {
    const q = normalizeText(draft).trim();
    const sorted = [...contacts].sort((a, b) => a.label.localeCompare(b.label));
    return q ? sorted.filter((c) => normalizeText(c.label).includes(q)) : sorted;
  }, [contacts, draft]);

  const exactMatch = useMemo(
    () => contacts.some((c) => c.label.toLowerCase() === draft.trim().toLowerCase()),
    [contacts, draft],
  );
  const showCreate = draft.trim().length > 0 && !exactMatch;

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) {
        setOpen(false);
        if (commitOnBlur && draft.trim() !== value.trim()) {
          if (!draft.trim()) { onPick({ newLabel: "" }); return; }
          const match = contacts.find((c) => c.label.toLowerCase() === draft.trim().toLowerCase());
          onPick(match ? { contactId: match.id, label: match.label } : { newLabel: draft.trim() });
        }
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft, value, commitOnBlur]);

  function openDropdown() {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(true);
  }

  function pick(contact: Contact) {
    setDraft(contact.label);
    setOpen(false);
    onPick({ contactId: contact.id, label: contact.label });
  }

  function createNew() {
    const label = draft.trim();
    if (!label) return;
    setOpen(false);
    onPick({ newLabel: label });
  }

  function clear() {
    setDraft("");
    setOpen(false);
    onPick({ newLabel: "" });
    inputRef.current?.focus();
  }

  return (
    <div ref={wrapRef} className={`relative ${bare ? "flex-1 min-w-0" : ""}`}>
      {draft.trim().length > 0 && (
        <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none ${bare ? "left-0" : "left-2"}`}>
          <Avatar seed={draft} initials={initials(draft)} logoDomain={knownDomain(draft)} size={20} />
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        disabled={disabled}
        onChange={(e) => { setDraft(e.target.value); if (!open) openDropdown(); }}
        onFocus={openDropdown}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const match = contacts.find((c) => c.label.toLowerCase() === draft.trim().toLowerCase());
            if (match) pick(match);
            else if (showCreate) createNew();
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") { setDraft(value); setOpen(false); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder={placeholder}
        className={
          bare
            ? `w-full text-sm font-medium text-navy bg-transparent border-0 outline-none pr-6 disabled:opacity-50 ${draft.trim().length > 0 ? "pl-7" : "pl-0"}`
            : `w-full text-sm font-medium text-navy border border-navy/[0.12] rounded-lg pr-8 py-2 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition disabled:opacity-50 ${draft.trim().length > 0 ? "pl-9" : "pl-3"}`
        }
      />
      {draft.trim().length > 0 ? (
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          tabIndex={-1}
          aria-label="Quitar contacto"
          className={`absolute top-1/2 -translate-y-1/2 text-navy/35 hover:text-danger transition-colors disabled:opacity-50 ${bare ? "right-0" : "right-2.5"}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      ) : (
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`absolute top-1/2 -translate-y-1/2 text-navy/30 pointer-events-none ${bare ? "right-0" : "right-2.5"}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
      {open && dropPos && (options.length > 0 || showCreate) && createPortal(
        <div
          ref={dropRef}
          className="fixed z-[9999] bg-card border border-navy/10 rounded-xl shadow-xl overflow-y-auto py-1"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, maxHeight: "14rem" }}
        >
          {options.map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c)}
              className={`w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-navy/[0.04] transition-colors ${c.label === value ? "font-semibold text-navy" : "text-navy/70"}`}
            >
              <Avatar seed={c.label} initials={initials(c.label)} logoDomain={knownDomain(c.label)} size={20} />
              <span className="truncate">{c.label}</span>
            </button>
          ))}
          {showCreate && (
            <button
              onClick={createNew}
              className="w-full text-left px-3 py-1.5 text-xs text-primary font-medium hover:bg-primary/[0.06] transition-colors border-t border-navy/[0.06] mt-1"
            >
              + Crear contacto: &ldquo;{draft.trim()}&rdquo;
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
