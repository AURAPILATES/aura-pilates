"use client";
import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import type { Transaction, PaymentMethod } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import { sortCategoriesHierarchical, categoryDisplayLabel } from "@/lib/categories";
import { normalizeText } from "@/lib/normalizeText";
import { seriesKeyFor } from "@/lib/recurring";
import type { RecurringExpense } from "@/lib/recurringExpenses";
import { updateTransactionCategory, updateTransactionConcept, updateTransactionBankDetails, updateTransactionDate, updateTransactionPaymentMethod, updateTransactionAmount, softDeleteTransactions, type Contact } from "./actions";
import Select from "@/app/components/Select";
import AddCashModal from "./AddCashModal";
import PapeleraDrawer from "./PapeleraDrawer";
import TransactionDrawer from "./TransactionDrawer";
import { CatIcon } from "./catIcons";
import TransaccionesListV2 from "./TransaccionesListV2";

export const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

export function fmtDayLabel(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yest  = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  if (dateStr === today) return "Hoy";
  if (dateStr === yest)  return "Ayer";
  const [, m, d] = dateStr.split("-");
  return `${parseInt(d)} de ${MONTHS_ES[parseInt(m) - 1]}`;
}

const MONTHS_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
export function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${parseInt(day)} ${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

export function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export const CAT_FALLBACK = { emoji: "package", bg: "var(--color-subtle)", color: "var(--color-faint)" };
export const FALLBACK_COLOR = { in: "var(--color-income)", out: "var(--color-navy)" };
export const FALLBACK_ICON = { in: "trending-up", out: "package" };

// ── Source avatar ─────────────────────────────────────────────────────────────
const SOCIO_INITIALS: Record<string, { initials: string; textCls: string; cls: string }> = {
  victor: { initials: "V",  textCls: "text-[#5B21B6] dark:text-[#c4b5fd]", cls: "bg-[#EDE9FE] dark:bg-[#382f5c] text-[#5B21B6] dark:text-[#c4b5fd]" },
  celia:  { initials: "Ce", textCls: "text-[#9D174D] dark:text-[#f9a8d4]", cls: "bg-[#FCE7F3] dark:bg-[#4a2438] text-[#9D174D] dark:text-[#f9a8d4]" },
  olga:   { initials: "O",  textCls: "text-[#065F46] dark:text-[#6ee7b7]", cls: "bg-[#D1FAE5] dark:bg-[#123a2c] text-[#065F46] dark:text-[#6ee7b7]" },
  carles: { initials: "Ca", textCls: "text-[#1D4ED8] dark:text-[#93c5fd]", cls: "bg-[#DBEAFE] dark:bg-[#1e2f52] text-[#1D4ED8] dark:text-[#93c5fd]" },
};

export function SourceAvatar({ method, size = 22 }: { method: string; size?: number }) {
  if (method === "efectivo") {
    const icon = Math.round(size * 0.5);
    return (
      <div className="shrink-0 rounded-full bg-amber-100 dark:bg-[#3d2f13] flex items-center justify-center" style={{ width: size, height: size }} title="Efectivo Aura">
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#92400E] dark:text-[#fcd34d]">
          <rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="13" r="3"/><path d="M6 10h.01M18 10h.01"/>
        </svg>
      </div>
    );
  }
  const socio = SOCIO_INITIALS[method];
  if (socio) {
    return (
      <div
        className={`shrink-0 rounded-full flex items-center justify-center ${socio.cls}`}
        style={{ width: size, height: size }}
        title={method.charAt(0).toUpperCase() + method.slice(1)}
      >
        <span style={{ fontSize: Math.round(size * 9 / 22), fontWeight: 700, lineHeight: 1 }}>{socio.initials}</span>
      </div>
    );
  }
  const imgSize = Math.round(size * 16 / 22);
  return (
    <img src="/Caixabank logo.png" alt="CaixaBank" width={imgSize} height={imgSize} className="shrink-0 object-contain" />
  );
}

// ── Custom checkbox ────────────────────────────────────────────────────────────
export function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`w-[15px] h-[15px] rounded-[3px] border cursor-pointer flex items-center justify-center shrink-0 transition-colors ${
        checked ? "bg-navy border-navy" : "bg-card border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
      }`}
    >
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none" className="text-app-bg">
          <polyline points="1,3.5 3.5,6 8,1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

export function CategoryMultiFilter({
  selected, categories, onChange, className = "",
}: {
  selected: string[]; categories: Category[]; onChange: (cats: string[]) => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((v) => !v);
  }

  function toggle(val: string) {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  }

  let label: React.ReactNode;
  if (selected.length === 0) {
    label = <span className="text-navy">Categoría</span>;
  } else if (selected.length === 1) {
    const val = selected[0];
    if (val === "__none__") {
      label = <span>Sin categoría</span>;
    } else {
      const cat = categories.find((c) => c.value === val);
      label = cat ? (
        <span className="flex items-center gap-1.5">
          <CatIcon iconKey={cat.emoji} name={cat.label} color={cat.text_color} />
          {categoryDisplayLabel(cat, categories)}
        </span>
      ) : <span>{val}</span>;
    }
  } else {
    label = <span>{selected.length} categorías</span>;
  }

  const MiniCheck = ({ on }: { on: boolean }) => (
    <div className={`w-3 h-3 rounded-[2px] border flex items-center justify-center shrink-0 transition-colors ${on ? "bg-navy border-navy" : "border-navy/30"}`}>
      {on && (
        <svg width="8" height="6" viewBox="0 0 9 7" fill="none" className="text-app-bg">
          <polyline points="1,3.5 3.5,6 8,1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className={`flex items-center gap-2 text-sm border rounded-xl px-3 py-2 bg-card outline-none transition-colors cursor-pointer whitespace-nowrap w-full ${
          selected.length > 0 ? "border-primary/40 text-navy font-medium" : "border-navy/[0.12] text-navy hover:border-navy/30"
        }`}
        style={{ minWidth: "130px" }}
      >
        <span className="flex-1 text-left text-sm">{label}</span>
        {selected.length > 0 ? (
          <span
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
            className="text-navy/40 hover:text-navy/70 transition-colors shrink-0 leading-none"
          >✕</span>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy/35 shrink-0">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed z-[9999] bg-card border border-navy/10 rounded-xl shadow-xl overflow-y-auto py-1"
          style={{ top: dropPos.top, left: dropPos.left, minWidth: "13rem", maxHeight: "18rem" }}
        >
          <button
            onClick={() => toggle("__none__")}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-navy/[0.04] transition-colors"
          >
            <MiniCheck on={selected.includes("__none__")} />
            <span className="text-navy/40">-</span>
            <span className="text-navy/50">Sin categoría</span>
          </button>
          {sortCategoriesHierarchical(categories).map((c) => (
            <button
              key={c.value}
              onClick={() => toggle(c.value)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-navy/[0.04] transition-colors ${c.parent_id ? "pl-7" : ""}`}
            >
              <MiniCheck on={selected.includes(c.value)} />
              <CatIcon iconKey={c.emoji} name={c.label} color={c.text_color} />
              <span className="text-navy/70">{c.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/** Pill visual de categoría, sin interacción - para mostrar en sitios de solo lectura como
 * la tabla de contactos. CategoryPill la usa por dentro para el botón interactivo. */
export function CategoryBadge({ category, categories, hideIcon = false }: { category: string | null; categories: Category[]; hideIcon?: boolean }) {
  const cat = category ? categories.find((c) => c.value === category) : undefined;
  const cfg = cat ? {
    emoji: cat.emoji,
    bg: cat.bg_color === cat.text_color
      ? (() => { const r = parseInt(cat.text_color.slice(1,3),16), g = parseInt(cat.text_color.slice(3,5),16), b = parseInt(cat.text_color.slice(5,7),16); return `rgba(${r},${g},${b},0.12)`; })()
      : cat.bg_color,
    color: cat.text_color,
  } : CAT_FALLBACK;
  const label = cat ? categoryDisplayLabel(cat, categories) : (category || "Sin categoría");
  const iconName = cat?.label ?? label;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {!hideIcon && <CatIcon iconKey={cfg.emoji} name={iconName} color={cfg.color} />}
      <span>{label}</span>
    </span>
  );
}

export function CategoryPill({ category, categories, onChange, hideIcon = false }: { category: string | null; categories: Category[]; onChange: (cat: string | null) => void; hideIcon?: boolean }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const GAP = 4;
      const MARGIN = 8;
      const DESIRED = 13 * 16; // 13rem
      const DROP_MIN_W = 11 * 16; // minWidth 11rem
      const spaceBelow = window.innerHeight - rect.bottom - MARGIN;
      const spaceAbove = rect.top - MARGIN;
      // Se abre hacia arriba si abajo no cabe cómodamente y arriba hay más sitio (p.ej. la
      // última fila de la pantalla); la altura se ajusta al hueco disponible y hace scroll.
      const openUp = spaceBelow < Math.min(DESIRED, 200) && spaceAbove > spaceBelow;
      const maxHeight = Math.max(140, Math.min(DESIRED, openUp ? spaceAbove : spaceBelow));
      const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - DROP_MIN_W - MARGIN));
      setDropPos(
        openUp
          ? { left, bottom: window.innerHeight - rect.top + GAP, maxHeight }
          : { left, top: rect.bottom + GAP, maxHeight },
      );
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="inline-block rounded-full hover:brightness-95 transition-all"
      >
        <CategoryBadge category={category} categories={categories} hideIcon={hideIcon} />
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed z-[9999] bg-card border border-navy/10 rounded-xl shadow-xl overflow-y-auto py-1"
          style={{ ...(dropPos.top != null ? { top: dropPos.top } : { bottom: dropPos.bottom }), left: dropPos.left, minWidth: "11rem", maxHeight: dropPos.maxHeight }}
        >
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-navy/[0.04] transition-colors ${!category ? "font-semibold" : ""}`}
          >
            <span className="text-navy/40">-</span>
            <span className="text-navy/50">Sin categoría</span>
          </button>
          {sortCategoriesHierarchical(categories).map((c) => (
            <button
              key={c.value}
              onClick={() => { onChange(c.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-navy/[0.04] transition-colors ${c.value === category ? "font-semibold" : ""} ${c.parent_id ? "pl-7" : ""}`}
              style={{ color: c.text_color }}
            >
              <CatIcon iconKey={c.emoji} name={c.label} color={c.text_color} />
              <span className="text-navy/70">{c.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export function OriginIcon({ method, size = 12 }: { method: string; size?: number }) {
  if (method === "banco") {
    return <img src="/Caixabank logo.png" alt="CaixaBank" width={size} height={size} className="shrink-0 object-contain" />;
  }
  if (method === "efectivo") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#B45309] dark:text-[#e8a572]">
        <rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="13" r="3"/><path d="M6 10h.01M18 10h.01"/>
      </svg>
    );
  }
  const textCls = SOCIO_INITIALS[method]?.textCls ?? "text-[#64748B] dark:text-[#94a3b8]";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${textCls}`}>
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/>
    </svg>
  );
}

export function originLabel(method: string): string {
  if (method === "banco") return "CaixaBank";
  if (method === "efectivo") return "Efectivo Aura";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

export function MoreOptionsMenu({
  onlyRecurring, setOnlyRecurring, onlyNoContact, setOnlyNoContact, originFilter, setOriginFilter,
  amountMin, setAmountMin, amountMax, setAmountMax, onExport, onPapelera,
}: {
  onlyRecurring: boolean;
  setOnlyRecurring: (v: boolean | ((prev: boolean) => boolean)) => void;
  onlyNoContact: boolean;
  setOnlyNoContact: (v: boolean | ((prev: boolean) => boolean)) => void;
  originFilter: string;
  setOriginFilter: (v: string) => void;
  amountMin: string;
  setAmountMin: (v: string) => void;
  amountMax: string;
  setAmountMax: (v: string) => void;
  onExport: () => void;
  onPapelera: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.right - 240 });
    }
    setOpen((v) => !v);
  }

  const hasActive = onlyRecurring || onlyNoContact || originFilter !== "all" || amountMin !== "" || amountMax !== "";

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        onClick={handleToggle}
        title="Más opciones"
        className={`relative shrink-0 flex items-center justify-center w-9 h-9 border rounded-xl transition-colors ${
          hasActive ? "border-primary/40 text-primary bg-primary/5" : "text-navy/50 hover:text-navy border-navy/[0.12] bg-card hover:bg-navy/[0.02]"
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>
        </svg>
        {hasActive && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />}
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed z-[9999] bg-card border border-navy/10 rounded-xl shadow-xl py-2"
          style={{ top: dropPos.top, left: dropPos.left, width: "240px" }}
        >
          <div className="px-3 pt-1 pb-2">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1.5">Origen</p>
            <Select value={originFilter} onChange={(e) => setOriginFilter(e.target.value)}>
                <option value="all">Todos</option>
                <option value="banco">CaixaBank</option>
                <option value="efectivo">Efectivo Aura</option>
                <option value="victor">Víctor</option>
                <option value="celia">Celia</option>
                <option value="olga">Olga</option>
                <option value="carles">Carles</option>
            </Select>
          </div>
          <div className="border-t border-navy/[0.06] my-1" />
          <div className="px-3 pt-1 pb-2">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1.5">Importe</p>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                placeholder="Mín."
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                className="w-full min-w-0 px-2 py-1.5 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
              />
              <span className="text-navy/30 text-xs shrink-0">–</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="Máx."
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                className="w-full min-w-0 px-2 py-1.5 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
              />
            </div>
          </div>
          <div className="border-t border-navy/[0.06] my-1" />
          <button
            onClick={() => setOnlyRecurring((v) => !v)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
              onlyRecurring ? "text-navy font-medium bg-navy/[0.04]" : "text-navy/60 hover:bg-navy/[0.04]"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
            Solo recurrentes
          </button>
          <button
            onClick={() => setOnlyNoContact((v) => !v)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
              onlyNoContact ? "text-navy font-medium bg-navy/[0.04]" : "text-navy/60 hover:bg-navy/[0.04]"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/>
            </svg>
            Sin contacto
          </button>
          <div className="border-t border-navy/[0.06] my-1" />
          <button
            onClick={() => { onExport(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-navy/60 hover:bg-navy/[0.04] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Exportar CSV
          </button>
          <button
            onClick={() => { onPapelera(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-navy/60 hover:bg-navy/[0.04] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
            </svg>
            Papelera
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

export type SortKey = "date" | "amount" | "concept";

type Props = {
  transactions: Transaction[];
  categories: Category[];
  uncategorizedCount: number;
  recurringPeriods: Record<string, string>;
  recurringExpenses: RecurringExpense[];
  contacts: Contact[];
  allTransactions?: Transaction[];
};

const PAGE_SIZE = 50;

export default function TransaccionesList({
  transactions, categories, uncategorizedCount, recurringPeriods, recurringExpenses, contacts, allTransactions,
}: Props) {
  const searchParams = useSearchParams();
  const currentRange = searchParams.get("range") ?? "all";

  const [search,      setSearch]      = useState(searchParams.get("buscar") ?? "");
  const [catFilters,  setCatFilters]  = useState<string[]>(() => {
    const cat = searchParams.get("categoria");
    if (!cat || cat === "all") return [];
    return [cat];
  });
  const [originFilter, setOriginFilter] = useState(searchParams.get("origen") ?? "all");
  const [showPapelera,  setShowPapelera]  = useState(false);
  const [, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<"date" | "amount" | "concept" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAddCash, setShowAddCash] = useState(false);
  const [onlyRecurring, setOnlyRecurring] = useState(false);
  const [onlyNoContact, setOnlyNoContact] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<"all" | "in" | "out">("all");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [drawerTxnId, setDrawerTxnId] = useState<string | null>(null);
  const drawerTxn = drawerTxnId ? transactions.find((t) => t.id === drawerTxnId) ?? null : null;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  // En móvil no hay paginador (la franja de meses necesita ver todos los meses a la vez para
  // poder saltar a cualquiera), así que ahí se muestra la lista completa sin cortar por página.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function toggleSort(key: "date" | "amount" | "concept") {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "concept" ? "asc" : "desc");
    }
  }


  useEffect(() => {
    const cat = searchParams.get("categoria");
    if (cat && cat !== "all") setCatFilters([cat]);
  }, [searchParams]);

  // Filtrar por una categoría debe incluir también las transacciones de toda su rama de
  // subcategorías, a cualquier profundidad (padre → hijas → nietas…).
  const expandedCatFilters = useMemo(() => {
    if (catFilters.length === 0) return catFilters;
    const childrenByParent = new Map<string, Category[]>();
    for (const c of categories) {
      if (!c.parent_id) continue;
      if (!childrenByParent.has(c.parent_id)) childrenByParent.set(c.parent_id, []);
      childrenByParent.get(c.parent_id)!.push(c);
    }
    const expanded = new Set(catFilters);
    const stack = catFilters
      .map((value) => categories.find((c) => c.value === value))
      .filter((c): c is Category => !!c);
    while (stack.length) {
      const cat = stack.pop()!;
      for (const child of childrenByParent.get(cat.id) ?? []) {
        if (!expanded.has(child.value)) { expanded.add(child.value); stack.push(child); }
      }
    }
    return [...expanded];
  }, [catFilters, categories]);

  const baseFiltered = transactions.filter((t) => {
    const q = normalizeText(search);
    if (q && !normalizeText(t.contact).includes(q) && !normalizeText(t.concept).includes(q) && !normalizeText(t.bank_details).includes(q)) return false;
    if (expandedCatFilters.length > 0 && !expandedCatFilters.includes(t.category ?? "__none__")) return false;
    if (originFilter !== "all" && t.payment_method !== originFilter) return false;
    if (onlyRecurring && !recurringPeriods[t.id]) return false;
    if (onlyNoContact && (t.contact ?? "").trim() !== "") return false;
    return true;
  });

  const min = amountMin !== "" ? parseFloat(amountMin) : null;
  const max = amountMax !== "" ? parseFloat(amountMax) : null;

  const filtered = baseFiltered.filter((t) => {
    if (directionFilter === "in" && t.amount <= 0) return false;
    if (directionFilter === "out" && t.amount >= 0) return false;
    const abs = Math.abs(t.amount);
    if (min != null && !Number.isNaN(min) && abs < min) return false;
    if (max != null && !Number.isNaN(max) && abs > max) return false;
    return true;
  });

  const sortedFiltered = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "date")   return a.date.localeCompare(b.date) * dir;
      if (sortKey === "amount") return (a.amount - b.amount) * dir;
      const ac = (a.contact || a.concept || "").toLowerCase();
      const bc = (b.contact || b.concept || "").toLowerCase();
      return ac.localeCompare(bc) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  // ── Paginación (desktop) - corta sortedFiltered/filtered antes de agrupar por mes,
  // así cada página tiene siempre PAGE_SIZE movimientos aunque abarque varios meses.
  useEffect(() => { setPage(0); }, [search, catFilters, originFilter, onlyRecurring, onlyNoContact, directionFilter, amountMin, amountMax, currentRange, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedFlat = isMobile ? sortedFiltered : sortedFiltered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // ── Month grouping - solo de la página actual ───────────────────────────────
  const byMonth = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of pagedFlat) {
      const key = t.date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [pagedFlat]);

  const totalIn  = baseFiltered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = baseFiltered.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const neto     = totalIn - totalOut;

  function handleCategoryChange(id: string, category: string | null) {
    startTransition(() => updateTransactionCategory(id, category));
  }
  function handleConceptChange(id: string, value: string) {
    startTransition(() => updateTransactionConcept(id, value));
  }
  function handleBankDetailsChange(id: string, value: string) {
    startTransition(() => updateTransactionBankDetails(id, value));
  }
  function handleDateChange(id: string, value: string) {
    startTransition(() => updateTransactionDate(id, value));
  }
  function handlePaymentMethodChange(id: string, value: PaymentMethod) {
    startTransition(() => updateTransactionPaymentMethod(id, value));
  }
  function handleDirectionChange(id: string, isIncome: boolean) {
    const txn = transactions.find((t) => t.id === id);
    if (!txn) return;
    const amount = isIncome ? Math.abs(txn.amount) : -Math.abs(txn.amount);
    if (amount === txn.amount) return;
    startTransition(() => updateTransactionAmount(id, amount));
  }
  function handleDeleteOne(id: string) {
    startTransition(async () => { await softDeleteTransactions([id]); });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }
  function toggleSelectAll(ids: string[]) {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...ids]);
    });
  }
  function applyBulkCategory(category: string | null) {
    const ids = [...selectedIds];
    clearSelection();
    startTransition(async () => { await Promise.all(ids.map((id) => updateTransactionCategory(id, category))); });
  }
  function applyBulkDelete() {
    const ids = [...selectedIds];
    clearSelection();
    startTransition(async () => { await softDeleteTransactions(ids); });
  }

  function exportCSV() {
    const cols = ["fecha", "concepto", "contacto", "categoría", "importe", "saldo", "notas"];
    const rows = filtered.map((t) => [
      t.date,
      t.concept ?? "",
      t.contact ?? "",
      t.category,
      t.amount.toFixed(2),
      t.balance?.toFixed(2) ?? "",
      t.notes ?? "",
    ]);
    const csv = [cols, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transacciones-aura-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <TransaccionesListV2
        categories={categories}
        uncategorizedCount={uncategorizedCount}
        search={search}
        onSearchChange={setSearch}
        catFilters={catFilters}
        onCatFiltersChange={setCatFilters}
        originFilter={originFilter}
        onOriginFilterChange={setOriginFilter}
        onlyRecurring={onlyRecurring}
        onToggleOnlyRecurring={() => setOnlyRecurring((v) => !v)}
        onlyNoContact={onlyNoContact}
        onToggleOnlyNoContact={() => setOnlyNoContact((v) => !v)}
        directionFilter={directionFilter}
        onDirectionFilterChange={setDirectionFilter}
        amountMin={amountMin}
        onAmountMinChange={setAmountMin}
        amountMax={amountMax}
        onAmountMaxChange={setAmountMax}
        totalIn={totalIn}
        totalOut={totalOut}
        neto={neto}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={toggleSort}
        byMonth={byMonth}
        onRowClick={(id) => setDrawerTxnId(id)}
        onExportCsv={exportCSV}
        onAddCash={() => setShowAddCash(true)}
        onPapelera={() => setShowPapelera(true)}
        page={safePage}
        totalItems={sortedFiltered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        recurringPeriods={recurringPeriods}
        onCategoryChange={handleCategoryChange}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onClearSelection={clearSelection}
        onBulkCategory={applyBulkCategory}
        onBulkDelete={applyBulkDelete}
      />

      {showAddCash && (
        <AddCashModal categories={categories} onClose={() => setShowAddCash(false)} />
      )}
      {showPapelera && (
        <PapeleraDrawer onClose={() => setShowPapelera(false)} />
      )}
      {drawerTxn && (
        <TransactionDrawer
          transaction={drawerTxn}
          categories={categories}
          contacts={contacts}
          recurringPeriod={recurringPeriods[drawerTxn.id]}
          recurringExpense={recurringExpenses.find((e) => e.key === seriesKeyFor(drawerTxn, allTransactions ?? transactions)) ?? null}
          onClose={() => setDrawerTxnId(null)}
          onUpdateConcept={handleConceptChange}
          onUpdateBankDetails={handleBankDetailsChange}
          onUpdateCategory={handleCategoryChange}
          onUpdateDate={handleDateChange}
          onUpdatePaymentMethod={handlePaymentMethodChange}
          onUpdateDirection={handleDirectionChange}
          onDelete={handleDeleteOne}
        />
      )}
    </div>
  );
}
