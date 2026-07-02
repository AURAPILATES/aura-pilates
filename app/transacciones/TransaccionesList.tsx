"use client";
import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Transaction, PaymentMethod } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import { sortCategoriesHierarchical, categoryDisplayLabel } from "@/lib/categories";
import { seriesKeyFor } from "@/lib/recurring";
import type { RecurringExpense } from "@/lib/recurringExpenses";
import { updateTransactionCategory, updateTransactionConcept, updateTransactionContact, updateTransactionBankDetails, updateTransactionDate, updateTransactionPaymentMethod, softDeleteTransactions, type Contact } from "./actions";
import DateFilter from "@/app/components/DateFilter";
import ImportButton from "./ImportButton";
import AddCashModal from "./AddCashModal";
import PapeleraDrawer from "./PapeleraDrawer";
import TransactionDrawer from "./TransactionDrawer";
import { CatIcon } from "./catIcons";

const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function fmtDayLabel(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yest  = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  if (dateStr === today) return "Hoy";
  if (dateStr === yest)  return "Ayer";
  const [, m, d] = dateStr.split("-");
  return `${parseInt(d)} de ${MONTHS_ES[parseInt(m) - 1]}`;
}

const MONTHS_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${parseInt(day)} ${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

const CAT_FALLBACK = { emoji: "package", bg: "#F8FAFC", color: "#94A3B8" };
const FALLBACK_COLOR = { in: "#4e8c68", out: "#1c1917" };
const FALLBACK_ICON = { in: "trending-up", out: "package" };

// ── Source avatar ─────────────────────────────────────────────────────────────
const SOCIO_INITIALS: Record<string, { initials: string; bg: string; color: string }> = {
  victor: { initials: "V",  bg: "#EDE9FE", color: "#5B21B6" },
  celia:  { initials: "Ce", bg: "#FCE7F3", color: "#9D174D" },
  olga:   { initials: "O",  bg: "#D1FAE5", color: "#065F46" },
  carles: { initials: "Ca", bg: "#DBEAFE", color: "#1D4ED8" },
};

export function SourceAvatar({ method, size = 22 }: { method: string; size?: number }) {
  if (method === "efectivo") {
    const icon = Math.round(size * 0.5);
    return (
      <div className="shrink-0 rounded-full bg-amber-100 flex items-center justify-center" style={{ width: size, height: size }} title="Efectivo Aura">
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="13" r="3"/><path d="M6 10h.01M18 10h.01"/>
        </svg>
      </div>
    );
  }
  const socio = SOCIO_INITIALS[method];
  if (socio) {
    return (
      <div
        className="shrink-0 rounded-full flex items-center justify-center"
        style={{ background: socio.bg, color: socio.color, width: size, height: size }}
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

// ── Inline edit confirm/cancel ─────────────────────────────────────────────────
function EditConfirmButtons({ onConfirm, onCancel, small = false }: { onConfirm: () => void; onCancel: () => void; small?: boolean }) {
  const size = small ? 18 : 20;
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        onClick={onConfirm}
        title="Guardar"
        className="flex items-center justify-center rounded-full text-success/70 hover:bg-success/10 hover:text-success transition-colors"
        style={{ width: size, height: size }}
      >
        <svg width={small ? 11 : 12} height={small ? 11 : 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
      <button
        onClick={onCancel}
        title="Cancelar"
        className="flex items-center justify-center rounded-full text-navy/35 hover:bg-navy/[0.06] hover:text-navy/60 transition-colors"
        style={{ width: size, height: size }}
      >
        <svg width={small ? 10 : 11} height={small ? 10 : 11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ── Custom checkbox ────────────────────────────────────────────────────────────
function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`w-[15px] h-[15px] rounded-[3px] border cursor-pointer flex items-center justify-center shrink-0 transition-colors ${
        checked ? "bg-black border-black" : "bg-white border-gray-300 hover:border-gray-400"
      }`}
    >
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <polyline points="1,3.5 3.5,6 8,1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

function CategoryMultiFilter({
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
    <div className={`w-3 h-3 rounded-[2px] border flex items-center justify-center shrink-0 transition-colors ${on ? "bg-black border-black" : "border-navy/30"}`}>
      {on && (
        <svg width="8" height="6" viewBox="0 0 9 7" fill="none">
          <polyline points="1,3.5 3.5,6 8,1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2 bg-white outline-none transition-colors cursor-pointer whitespace-nowrap w-full ${
          selected.length > 0 ? "border-primary/40 text-navy font-medium" : "border-navy/15 text-navy hover:border-navy/30"
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
          className="fixed z-[9999] bg-white border border-navy/10 rounded-xl shadow-xl overflow-y-auto py-1"
          style={{ top: dropPos.top, left: dropPos.left, minWidth: "13rem", maxHeight: "18rem" }}
        >
          <button
            onClick={() => toggle("__none__")}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-navy/[0.04] transition-colors"
          >
            <MiniCheck on={selected.includes("__none__")} />
            <span className="text-navy/40">—</span>
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

/** Pill visual de categoría, sin interacción — para mostrar en sitios de solo lectura como
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
          className="fixed z-[9999] bg-white border border-navy/10 rounded-xl shadow-xl overflow-y-auto py-1"
          style={{ top: dropPos.top, left: dropPos.left, minWidth: "11rem", maxHeight: "13rem" }}
        >
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-navy/[0.04] transition-colors ${!category ? "font-semibold" : ""}`}
          >
            <span className="text-navy/40">—</span>
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

function originLabel(method: string): string {
  if (method === "banco") return "CaixaBank";
  if (method === "efectivo") return "Efectivo Aura";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

const SELECT_CLS = "appearance-none text-sm border border-navy/15 rounded-lg px-3 pr-8 py-2 bg-white outline-none focus:ring-1 focus:ring-primary/20 text-navy cursor-pointer hover:border-navy/30 transition-colors w-full";

function SelectWrapper({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy/35">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>
  );
}

function MobileActionsMenu({ onExport, onPapelera }: { onExport: () => void; onPapelera: () => void }) {
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
      setDropPos({ top: rect.bottom + 4, left: rect.right - 170 });
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        ref={btnRef}
        onClick={handleToggle}
        title="Más acciones"
        className="shrink-0 flex items-center justify-center w-[42px] h-[42px] text-navy/55 border border-navy/[0.12] rounded-lg bg-white hover:bg-navy/[0.02] hover:text-navy transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>
        </svg>
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed z-[9999] bg-white border border-navy/10 rounded-xl shadow-xl py-1"
          style={{ top: dropPos.top, left: dropPos.left, width: "170px" }}
        >
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

function MoreOptionsMenu({
  onlyRecurring, setOnlyRecurring, originFilter, setOriginFilter, onExport, onPapelera,
}: {
  onlyRecurring: boolean;
  setOnlyRecurring: (v: boolean | ((prev: boolean) => boolean)) => void;
  originFilter: string;
  setOriginFilter: (v: string) => void;
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

  const hasActive = onlyRecurring || originFilter !== "all";

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        onClick={handleToggle}
        title="Más opciones"
        className={`relative shrink-0 flex items-center justify-center w-9 h-9 border rounded-lg transition-colors ${
          hasActive ? "border-primary/40 text-primary bg-primary/5" : "text-navy/50 hover:text-navy border-navy/15 bg-white hover:bg-navy/[0.02]"
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
          className="fixed z-[9999] bg-white border border-navy/10 rounded-xl shadow-xl py-2"
          style={{ top: dropPos.top, left: dropPos.left, width: "240px" }}
        >
          <div className="px-3 pt-1 pb-2">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1.5">Origen</p>
            <SelectWrapper>
              <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value)} className={SELECT_CLS}>
                <option value="all">Todos</option>
                <option value="banco">CaixaBank</option>
                <option value="efectivo">Efectivo Aura</option>
                <option value="victor">Víctor</option>
                <option value="celia">Celia</option>
                <option value="olga">Olga</option>
                <option value="carles">Carles</option>
              </select>
            </SelectWrapper>
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

type SortKey = "date" | "amount" | "concept";

function SortableHeader({
  label, sortKey, align, className = "", currentKey, dir, onClick,
}: {
  label: string;
  sortKey: SortKey;
  align: "left" | "right";
  className?: string;
  currentKey: SortKey | null;
  dir: "asc" | "desc";
  onClick: (key: SortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  return (
    <div
      onClick={() => onClick(sortKey)}
      className={`${align === "right" ? "text-right" : "text-left"} ${className} text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${
        isActive ? "text-navy" : "text-navy/45 hover:text-navy/70"
      }`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {label}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover/head:opacity-30"}`}
          style={{ transform: isActive && dir === "asc" ? "rotate(180deg)" : undefined }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </div>
  );
}

type Props = {
  transactions: Transaction[];
  categories: Category[];
  uncategorizedCount: number;
  recurringPeriods: Record<string, string>;
  recurringExpenses: RecurringExpense[];
  allMonthKeys: string[];
  contacts: Contact[];
};

export default function TransaccionesList({
  transactions, categories, uncategorizedCount, recurringPeriods, recurringExpenses, allMonthKeys, contacts,
}: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const currentRange = searchParams.get("range") ?? "all";
  const customFrom   = searchParams.get("from") ?? "";

  const [search,      setSearch]      = useState("");
  const [catFilters,  setCatFilters]  = useState<string[]>(() => {
    const cat = searchParams.get("categoria");
    if (!cat || cat === "all") return [];
    return [cat];
  });
  const [originFilter, setOriginFilter] = useState("all");
  const [showMobileFilters,  setShowMobileFilters]  = useState(false);
  const [mobileSelectMode,   setMobileSelectMode]   = useState(false);
  const [editingField, setEditingField] = useState<{ id: string; field: "contact" | "concept" } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [bulkCat,      setBulkCat]      = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showPapelera,  setShowPapelera]  = useState(false);
  const [isPending,    startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<"date" | "amount" | "concept" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAddCash, setShowAddCash] = useState(false);
  const [onlyRecurring, setOnlyRecurring] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<"all" | "in" | "out">("all");
  const [drawerTxnId, setDrawerTxnId] = useState<string | null>(null);
  const drawerTxn = drawerTxnId ? transactions.find((t) => t.id === drawerTxnId) ?? null : null;

  function toggleSort(key: "date" | "amount" | "concept") {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "concept" ? "asc" : "desc");
    }
  }


  // ── Month strip — solo meses con datos (independiente del filtro activo) ────
  const monthStrip = useMemo(() => {
    return allMonthKeys.map((key) => {
      const m = parseInt(key.slice(5)) - 1;
      return { key, label: MONTHS_ES[m], year: parseInt(key.slice(0, 4)) };
    });
  }, [allMonthKeys]);

  const activeMonth = useMemo(() => {
    if (currentRange === "custom" && customFrom) return customFrom.slice(0, 7);
    if (currentRange === "month") {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    return null;
  }, [currentRange, customFrom]);

  const activeMonthRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeMonthRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeMonth]);

  function goToMonth(key: string) {
    const [y, m] = key.split("-");
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    router.push(`${pathname}?range=custom&from=${key}-01&to=${key}-${String(lastDay).padStart(2, "0")}`);
  }


  useEffect(() => {
    const cat = searchParams.get("categoria");
    if (cat && cat !== "all") setCatFilters([cat]);
  }, [searchParams]);

  // Filtrar por una categoría padre debe incluir también las transacciones de sus hijas.
  const expandedCatFilters = useMemo(() => {
    if (catFilters.length === 0) return catFilters;
    const expanded = new Set(catFilters);
    for (const value of catFilters) {
      const parent = categories.find((c) => c.value === value);
      if (!parent || parent.parent_id) continue;
      for (const child of categories) {
        if (child.parent_id === parent.id) expanded.add(child.value);
      }
    }
    return [...expanded];
  }, [catFilters, categories]);

  const baseFiltered = transactions.filter((t) => {
    const q = search.toLowerCase();
    if (q && !t.contact?.toLowerCase().includes(q) && !t.concept?.toLowerCase().includes(q) && !t.bank_details?.toLowerCase().includes(q)) return false;
    if (expandedCatFilters.length > 0 && !expandedCatFilters.includes(t.category ?? "__none__")) return false;
    if (originFilter !== "all" && t.payment_method !== originFilter) return false;
    if (onlyRecurring && !recurringPeriods[t.id]) return false;
    return true;
  });

  const filtered = baseFiltered.filter((t) => {
    if (directionFilter === "in" && t.amount <= 0) return false;
    if (directionFilter === "out" && t.amount >= 0) return false;
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

  // ── Day grouping for mobile ──────────────────────────────────────────────────
  const byDay = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // ── Month grouping for desktop ─────────────────────────────────────────────
  const byMonth = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const key = t.date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const allFilteredIds = filtered.map((t) => t.id);
  const allSelected    = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const someSelected   = selected.size > 0;

  const kpiBase  = someSelected ? baseFiltered.filter((t) => selected.has(t.id)) : baseFiltered;
  const totalIn  = kpiBase.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = kpiBase.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const neto     = totalIn - totalOut;


  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allFilteredIds));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearSelection() { setSelected(new Set()); setBulkCat(""); setDeleteConfirm(false); }
  async function applyBulkDelete() {
    const ids = [...selected];
    startTransition(async () => { await softDeleteTransactions(ids); });
    clearSelection();
  }
  function applyBulkCategory() {
    if (!bulkCat) return;
    const ids = [...selected];
    const cat = bulkCat === "__null__" ? null : bulkCat;
    startTransition(async () => { await Promise.all(ids.map((id) => updateTransactionCategory(id, cat))); });
    clearSelection();
  }
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
  function handleDeleteOne(id: string) {
    startTransition(async () => { await softDeleteTransactions([id]); });
  }
  function startEditing(t: Transaction, which: "primary" | "secondary") {
    if (which === "primary") {
      if (t.contact != null) {
        setEditingField({ id: t.id, field: "contact" });
        setEditValue(t.contact);
      } else {
        setEditingField({ id: t.id, field: "concept" });
        setEditValue(t.concept ?? "");
      }
    } else {
      setEditingField({ id: t.id, field: "concept" });
      setEditValue(t.concept ?? "");
    }
  }
  function saveEdit() {
    if (!editingField) return;
    const { id, field } = editingField;
    const val = editValue;
    startTransition(async () => {
      if (field === "contact") await updateTransactionContact(id, val);
      else await updateTransactionConcept(id, val);
    });
    setEditingField(null);
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
      {/* ── Desktop: KPIs ── */}
      <div className="hidden sm:block mb-8">
        <div className="flex items-stretch gap-3">
          {/* Entradas — clicable */}
          <button
            type="button"
            onClick={() => setDirectionFilter(directionFilter === "in" ? "all" : "in")}
            className={`flex-1 min-w-[130px] text-left rounded-2xl px-6 py-5 transition-all duration-200 ${
              directionFilter === "in"
                ? "bg-success/[0.07] border border-success/20 shadow-[0_2px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.85)]"
                : "bg-white/75 backdrop-blur-xl border border-white/60 shadow-[0_2px_16px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)] hover:bg-white/90 hover:shadow-[0_4px_24px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,1)]"
            }`}
          >
            <p className="text-[10px] font-medium text-navy/35 uppercase tracking-widest leading-none mb-3">Entradas</p>
            <p className="text-[22px] font-semibold text-success tabular-nums leading-none">{fmtAmt(totalIn)}</p>
            <p className={`text-[10px] text-success/60 mt-2.5 ${directionFilter === "in" ? "" : "invisible"}`}>activo ×</p>
          </button>

          {/* Salidas — clicable */}
          <button
            type="button"
            onClick={() => setDirectionFilter(directionFilter === "out" ? "all" : "out")}
            className={`flex-1 min-w-[130px] text-left rounded-2xl px-6 py-5 transition-all duration-200 ${
              directionFilter === "out"
                ? "bg-[#B85C3A]/[0.07] border border-[#B85C3A]/20 shadow-[0_2px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.85)]"
                : "bg-white/75 backdrop-blur-xl border border-white/60 shadow-[0_2px_16px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)] hover:bg-white/90 hover:shadow-[0_4px_24px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,1)]"
            }`}
          >
            <p className="text-[10px] font-medium text-navy/35 uppercase tracking-widest leading-none mb-3">Salidas</p>
            <p className="text-[22px] font-semibold text-[#B85C3A] tabular-nums leading-none">{fmtAmt(totalOut)}</p>
            <p className={`text-[10px] text-[#B85C3A]/60 mt-2.5 ${directionFilter === "out" ? "" : "invisible"}`}>activo ×</p>
          </button>

          {/* Diferencia — no clicable */}
          <div className="flex-1 min-w-[130px] bg-white/75 backdrop-blur-xl border border-white/60 rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)] px-6 py-5">
            <p className="text-[10px] font-medium text-navy/35 uppercase tracking-widest leading-none mb-3">
              {someSelected ? "Neto selección" : "Diferencia"}
            </p>
            <div className="flex items-baseline gap-2 leading-none">
              <p className={`text-[22px] font-semibold tabular-nums ${neto >= 0 ? "text-navy" : "text-danger"}`}>
                {neto < 0 && "−"}{fmtAmt(Math.abs(neto))}
              </p>
              {!someSelected && totalIn > 0 && (
                <span className="text-[11px] text-navy/30">
                  margen {(neto / totalIn * 100).toFixed(1).replace(".", ",")}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: KPIs ── */}
      <div className="sm:hidden grid grid-cols-3 gap-2 mb-5">
        {/* Entradas — clicable */}
        <button
          type="button"
          onClick={() => setDirectionFilter(directionFilter === "in" ? "all" : "in")}
          className={`text-center rounded-xl py-3 px-2 transition-all duration-200 ${
            directionFilter === "in"
              ? "bg-success/[0.08] border border-success/20 shadow-[0_1px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)]"
              : "bg-white/75 backdrop-blur-xl border border-white/60 shadow-[0_1px_8px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)] active:bg-white/90"
          }`}
        >
          <p className="text-[9px] font-medium text-navy/35 uppercase tracking-widest leading-none mb-1.5">Entradas</p>
          <p className="text-[13px] font-semibold text-success tabular-nums truncate leading-none">{fmtAmt(totalIn)}</p>
          <p className={`text-[8px] text-success/55 mt-1 ${directionFilter === "in" ? "" : "invisible"}`}>activo ×</p>
        </button>

        {/* Salidas — clicable */}
        <button
          type="button"
          onClick={() => setDirectionFilter(directionFilter === "out" ? "all" : "out")}
          className={`text-center rounded-xl py-3 px-2 transition-all duration-200 ${
            directionFilter === "out"
              ? "bg-[#B85C3A]/[0.08] border border-[#B85C3A]/20 shadow-[0_1px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)]"
              : "bg-white/75 backdrop-blur-xl border border-white/60 shadow-[0_1px_8px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)] active:bg-white/90"
          }`}
        >
          <p className="text-[9px] font-medium text-navy/35 uppercase tracking-widest leading-none mb-1.5">Salidas</p>
          <p className="text-[13px] font-semibold text-[#B85C3A] tabular-nums truncate leading-none">{fmtAmt(totalOut)}</p>
          <p className={`text-[8px] text-[#B85C3A]/55 mt-1 ${directionFilter === "out" ? "" : "invisible"}`}>activo ×</p>
        </button>

        {/* Diferencia — no clicable */}
        <div className="text-center bg-white/75 backdrop-blur-xl border border-white/60 rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1)] py-3 px-2">
          <p className="text-[9px] font-medium text-navy/35 uppercase tracking-widest leading-none mb-1.5">Dif.</p>
          <p className={`text-[13px] font-semibold tabular-nums truncate leading-none ${neto >= 0 ? "text-navy" : "text-danger"}`}>
            {neto < 0 && "−"}{fmtAmt(Math.abs(neto))}
          </p>
        </div>
      </div>

      {/* ── Mobile: Search bar + Filtros ─────────────────────────────────────── */}
      <div className="sm:hidden flex gap-2 mb-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/30" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar concepto o contacto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-navy/[0.12] rounded-lg bg-white text-navy placeholder:text-navy/35 outline-none focus:ring-2 focus:ring-primary/20 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/30 hover:text-navy/60">✕</button>
          )}
        </div>
        <button
          onClick={() => setShowMobileFilters((v) => !v)}
          title="Filtros"
          className="relative shrink-0 flex items-center justify-center w-[42px] h-[42px] bg-white border border-navy/[0.12] rounded-lg text-navy"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          {(catFilters.length > 0 || originFilter !== "all" || onlyRecurring || currentRange !== "all" || directionFilter !== "all") && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
        <MobileActionsMenu onExport={exportCSV} onPapelera={() => setShowPapelera(true)} />
      </div>

      {/* ── Mobile: Filter drawer ────────────────────────────────────────────── */}
      {showMobileFilters && (
        <div className="sm:hidden bg-white border border-navy/[0.1] rounded-2xl p-4 mb-3 flex flex-col gap-3 shadow-card">
          <DateFilter />
          <CategoryMultiFilter selected={catFilters} categories={categories} onChange={setCatFilters} className="w-full" />
          <SelectWrapper>
            <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value)} className={SELECT_CLS}>
              <option value="all">Origen</option>
              <option value="banco">CaixaBank</option>
              <option value="efectivo">Efectivo Aura</option>
              <option value="victor">Víctor</option>
              <option value="celia">Celia</option>
              <option value="olga">Olga</option>
              <option value="carles">Carles</option>
            </select>
          </SelectWrapper>
          <button
            onClick={() => setOnlyRecurring((v) => !v)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              onlyRecurring
                ? "bg-navy text-white border-navy"
                : "bg-white text-navy/55 border-navy/15"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
            Solo recurrentes
          </button>
        </div>
      )}

      {/* ── Mobile: Alert banner ─────────────────────────────────────────────── */}
      {uncategorizedCount > 0 && (
        <button
          onClick={() => setCatFilters(catFilters.includes("__none__") ? catFilters.filter((v) => v !== "__none__") : [...catFilters, "__none__"])}
          className="sm:hidden w-full flex items-center gap-2 px-4 py-2.5 mb-3 rounded-xl bg-warning/10 border border-warning/20 text-navy/70 text-sm font-medium text-left"
        >
          <span className="shrink-0 w-2 h-2 rounded-full bg-warning" />
          <span className="flex-1">{uncategorizedCount} sin clasificar</span>
          <span className="flex items-center gap-1 text-warning font-semibold whitespace-nowrap">
            Revisar
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </span>
        </button>
      )}


      {/* ── Desktop: barra de filtros unificada ────────────────────────────── */}
      <div className="hidden sm:flex items-center gap-2 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/30" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar concepto o contacto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-navy/15 rounded-lg bg-white text-navy placeholder:text-navy/35 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/30 hover:text-navy/60">✕</button>
          )}
        </div>
        <DateFilter />
        <CategoryMultiFilter selected={catFilters} categories={categories} onChange={setCatFilters} />
        <MoreOptionsMenu
          onlyRecurring={onlyRecurring}
          setOnlyRecurring={setOnlyRecurring}
          originFilter={originFilter}
          setOriginFilter={setOriginFilter}
          onExport={exportCSV}
          onPapelera={() => setShowPapelera(true)}
        />
        <ImportButton onManual={() => setShowAddCash(true)} />
      </div>

      {/* ── Desktop: recuento ─────────────────────────────────────────────────── */}
      <div className="hidden sm:flex items-center gap-3 mb-6">
        {someSelected ? (
          <span className="text-sm text-navy/45">{selected.size} seleccionado{selected.size !== 1 ? "s" : ""}</span>
        ) : (
          <span className="text-sm text-navy/45">{filtered.length} movimientos</span>
        )}
        {!someSelected && uncategorizedCount > 0 && (
          <button
            onClick={() => setCatFilters(catFilters.includes("__none__") ? catFilters.filter((v) => v !== "__none__") : [...catFilters, "__none__"])}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
              catFilters.includes("__none__")
                ? "bg-warning/10 text-warning/80"
                : "bg-warning/10 text-warning/80 hover:bg-warning/15"
            }`}
          >
            <span>⚠</span>
            <span>{uncategorizedCount} sin etiquetar</span>
          </button>
        )}
        {isPending && <span className="text-xs text-primary/60">Guardando…</span>}
        {(catFilters.length > 0 || originFilter !== "all" || onlyRecurring || directionFilter !== "all" || currentRange !== "all" || search !== "") && (
          <button
            onClick={() => {
              setCatFilters([]);
              setOriginFilter("all");
              setOnlyRecurring(false);
              setDirectionFilter("all");
              setSearch("");
              if (currentRange !== "all") router.push(pathname);
            }}
            className="text-xs text-navy/45 hover:text-navy underline whitespace-nowrap"
          >
            Eliminar filtros
          </button>
        )}
      </div>

      {/* ── Mobile: toolbar ────────────────────────────────────────────────── */}
      <div className="sm:hidden mb-3">
        {(catFilters.length > 0 || originFilter !== "all" || onlyRecurring || directionFilter !== "all" || currentRange !== "all" || search !== "") && (
          <div className="flex items-center mb-3">
            <button
              onClick={() => {
                setCatFilters([]);
                setOriginFilter("all");
                setOnlyRecurring(false);
                setDirectionFilter("all");
                setSearch("");
                if (currentRange !== "all") router.push(pathname);
              }}
              className="text-xs text-navy/55 hover:text-navy underline"
            >
              Eliminar filtros
            </button>
          </div>
        )}
        <div className="flex items-stretch gap-2">
          <ImportButton compact className="flex-1" onManual={() => setShowAddCash(true)} />
          <button
            onClick={() => { setMobileSelectMode((v) => { if (v) clearSelection(); return !v; }); }}
            className={`shrink-0 flex items-center justify-center gap-1.5 w-[124px] h-9 text-[13px] font-medium px-4 rounded-xl border transition-colors ${
              mobileSelectMode
                ? "bg-navy text-white border-navy"
                : "bg-white text-navy border-navy/15 hover:bg-navy/[0.02]"
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors ${
              mobileSelectMode ? "bg-white border-white" : "border-navy/35"
            }`}>
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                <polyline points="1,3.5 3.5,6 8,1" stroke={mobileSelectMode ? "#1c1917" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={mobileSelectMode ? "" : "text-navy/35"}/>
              </svg>
            </span>
            {mobileSelectMode ? "Cancelar" : "Seleccionar"}
          </button>
        </div>
      </div>

      {/* ── Bulk selection bar ─────────────────────────────────────────────── */}
      {someSelected && (
        <div className="fixed bottom-[10px] sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-5 py-2.5 sm:py-3 bg-navy rounded-2xl shadow-2xl border border-white/10 max-w-[calc(100vw-1.5rem)] sm:max-w-none sm:min-w-max">
          <span className="text-xs sm:text-sm font-semibold text-white shrink-0 whitespace-nowrap">
            <span className="sm:hidden">{selected.size} sel.</span>
            <span className="hidden sm:inline">{selected.size} seleccionada{selected.size !== 1 ? "s" : ""}</span>
          </span>
          <div className="w-px h-4 bg-white/20 shrink-0" />
          {deleteConfirm ? (
            <>
              <span className="text-xs sm:text-sm text-white/70 shrink-0 whitespace-nowrap">¿Eliminar {selected.size}?</span>
              <button
                onClick={applyBulkDelete}
                disabled={isPending}
                className="text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-lg bg-danger text-white disabled:opacity-40 hover:bg-danger/85 transition-colors shrink-0 whitespace-nowrap"
              >
                Confirmar
              </button>
              <button onClick={() => setDeleteConfirm(false)} className="text-xs sm:text-sm text-white/50 hover:text-white/80 px-1 shrink-0 whitespace-nowrap">Cancelar</button>
            </>
          ) : (
            <>
              <select
                value={bulkCat}
                onChange={(e) => setBulkCat(e.target.value)}
                className="text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-1.5 bg-white/10 text-white border border-white/20 outline-none focus:border-white/40 w-24 sm:w-auto sm:min-w-48 shrink-0 cursor-pointer"
              >
                <option value="" disabled>Cambiar categoría…</option>
                <option value="__null__" className="text-navy bg-white">Sin categoría</option>
                {sortCategoriesHierarchical(categories).map((c) => (
                  <option key={c.value} value={c.value} className="text-navy bg-white">{categoryDisplayLabel(c, categories)}</option>
                ))}
              </select>
              <button
                onClick={applyBulkCategory}
                disabled={!bulkCat || isPending}
                className="text-xs sm:text-sm font-semibold px-2.5 sm:px-4 py-1.5 rounded-lg bg-white text-navy disabled:opacity-40 hover:bg-white/90 transition-colors shrink-0 whitespace-nowrap"
              >
                Aplicar
              </button>
              <div className="w-px h-4 bg-white/20 shrink-0" />
              <button
                onClick={() => setDeleteConfirm(true)}
                title="Eliminar"
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg bg-danger text-white hover:bg-danger/85 transition-colors shrink-0"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
                </svg>
                <span className="hidden sm:inline">Eliminar</span>
              </button>
              <button onClick={clearSelection} className="text-sm text-white/50 hover:text-white/80 px-1 shrink-0">✕</button>
            </>
          )}
        </div>
      )}

      {/* ── Mobile: month strip (sticky), cápsula estilo Apple Photos ───────── */}
      <div className="sm:hidden sticky top-[45px] z-20 -mx-2 px-2 pt-2 pb-3 bg-app-bg">
        <div className="flex gap-0.5 p-1 rounded-full bg-navy/[0.05] overflow-x-auto scrollbar-none">
          <button
            onClick={() => router.push(pathname)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap ${
              !activeMonth ? "bg-white text-navy font-semibold shadow-card" : "text-navy/45 hover:text-navy/70"
            }`}
          >
            Todo
          </button>
          {monthStrip.map(({ key, label, year }) => {
            const isActive = key === activeMonth;
            const showYear = year !== new Date().getFullYear();
            return (
              <button
                key={key}
                ref={isActive ? activeMonthRef : undefined}
                onClick={() => goToMonth(key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm transition-colors capitalize whitespace-nowrap ${
                  isActive ? "bg-white text-navy font-semibold shadow-card" : "text-navy/45 hover:text-navy/70"
                }`}
              >
                {label}{showYear && <span className="text-[10px] ml-0.5 opacity-60">{year}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Mobile: day-grouped list, estilo Revolut (icono circular de color) ── */}
      <div className="sm:hidden space-y-5 mt-4 mx-1">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/45">Sin resultados</p>
        )}
        {byDay.map(([date, dayTxns]) => {
          const dayNet = dayTxns.reduce((s, t) => s + t.amount, 0);
          return (
            <div key={date}>
              {/* Day header — total siempre gris */}
              <div className="flex items-baseline justify-between mb-2 px-2">
                <span className="text-sm font-semibold text-navy">{fmtDayLabel(date)}</span>
                <span className="text-xs tabular-nums text-navy/40 pr-1">
                  {dayNet < 0 ? "−" : "+"}{fmtAmt(Math.abs(dayNet))}
                </span>
              </div>
              {/* Caja blanca por día, icono circular de color por movimiento */}
              <div className="bg-white rounded-2xl overflow-hidden divide-y divide-navy/[0.05]">
                {dayTxns.map((t) => {
                  const recurringPeriod = recurringPeriods[t.id];
                  const isSelected  = selected.has(t.id);
                  const primary     = t.contact || t.concept || "—";
                  const secondary   = t.contact && t.concept && t.concept !== t.contact ? t.concept : null;
                  const cat         = t.category ? categories.find((c) => c.value === t.category) : undefined;
                  const accent      = cat?.text_color ?? (t.amount > 0 ? FALLBACK_COLOR.in : FALLBACK_COLOR.out);
                  const iconKey     = cat?.emoji ?? (t.amount > 0 ? FALLBACK_ICON.in : FALLBACK_ICON.out);
                  return (
                    <div
                      key={t.id}
                      className={`flex items-start gap-3 p-3 transition-colors ${isSelected ? "bg-primary/[0.035]" : ""}`}
                    >
                      <div
                        className="flex items-center gap-2.5 shrink-0 cursor-pointer"
                        onClick={() => { if (mobileSelectMode) toggleOne(t.id); else setDrawerTxnId(t.id); }}
                      >
                        {mobileSelectMode && (
                          <Checkbox checked={isSelected} onChange={() => toggleOne(t.id)} />
                        )}
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: accent }}>
                          <CatIcon iconKey={iconKey} name={cat?.label ?? primary} color="#fff" size={17} />
                        </div>
                      </div>
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => { if (mobileSelectMode) toggleOne(t.id); else setDrawerTxnId(t.id); }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                          <span className="text-[15px] font-semibold text-navy truncate">{primary}</span>
                        </div>
                        {secondary && <p className="text-xs text-navy/40 truncate">{secondary}</p>}
                        <div className="flex items-center gap-1.5 mt-1 overflow-x-auto scrollbar-none" onClick={(e) => e.stopPropagation()}>
                          <CategoryPill category={t.category} categories={categories} onChange={(cat) => handleCategoryChange(t.id, cat)} hideIcon />
                          <span className="shrink-0 inline-flex items-center gap-1 text-xs text-navy/35 whitespace-nowrap">
                            {t.payment_method === "efectivo" ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                <rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="13" r="3"/><path d="M6 10h.01M18 10h.01"/>
                              </svg>
                            ) : t.payment_method === "banco" ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                <path d="M3 21h18M4 21V10l8-6 8 6v11M9 21v-6h6v6"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/>
                              </svg>
                            )}
                            {originLabel(t.payment_method)}
                          </span>
                          {recurringPeriod && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-primary/60 font-medium whitespace-nowrap">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                              </svg>
                              {recurringPeriod}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-semibold tabular-nums ${t.amount > 0 ? "text-success" : "text-navy"}`}>
                          {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                        </p>
                        {t.balance != null && (
                          <p className="text-[11px] text-navy/35 tabular-nums mt-0.5">{fmtAmt(t.balance)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop: lista estilo Revolut (misma identidad visual que mobile) ── */}
      {(() => {
        const renderRow = (t: Transaction) => {
          const recurringPeriod = recurringPeriods[t.id];
          const isSelected = selected.has(t.id);
          const primary    = t.contact || t.concept || "—";
          const secondary  = t.contact && t.concept && t.concept !== t.contact ? t.concept : null;
          const cat        = t.category ? categories.find((c) => c.value === t.category) : undefined;
          const accent     = cat ? cat.text_color : CAT_FALLBACK.color;
          const iconKey    = cat ? cat.emoji : CAT_FALLBACK.emoji;

          return (
            <div
              key={t.id}
              onClick={() => setDrawerTxnId(t.id)}
              className={`flex items-center gap-4 px-4 py-3.5 border-b border-navy/[0.04] last:border-0 group transition-colors cursor-pointer ${
                isSelected ? "bg-primary/[0.03]" : "hover:bg-navy/[0.012]"
              }`}
            >
              {/* avatar / checkbox */}
              <div
                className="relative w-9 h-9 shrink-0 flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); toggleOne(t.id); }}
              >
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isSelected ? "opacity-0" : "opacity-100 group-hover:opacity-0"}`}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: accent }}>
                    <CatIcon iconKey={iconKey} name={cat?.label ?? primary} color="#fff" size={15} />
                  </div>
                </div>
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                  <Checkbox checked={isSelected} onChange={() => toggleOne(t.id)} />
                </div>
              </div>

              {/* concepto */}
              <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                {editingField?.id === t.id && editingField.field === (t.contact != null ? "contact" : "concept") ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus type="text" value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingField(null); }}
                      className="text-[13px] font-medium text-navy bg-navy/[0.04] rounded-md px-1.5 -mx-1.5 outline-none ring-1 ring-navy/10 focus:ring-navy/20 w-full"
                    />
                    <EditConfirmButtons onConfirm={saveEdit} onCancel={() => setEditingField(null)} />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                    <span
                      className="text-[13px] font-medium text-navy truncate cursor-pointer hover:text-navy/70 transition-colors"
                      onClick={() => startEditing(t, "primary")}
                    >{primary}</span>
                    {recurringPeriod && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-primary/60 font-medium whitespace-nowrap">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                        </svg>
                        {recurringPeriod}
                      </span>
                    )}
                  </div>
                )}
                {secondary && (
                  editingField?.id === t.id && editingField.field === "concept" && t.contact != null ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <input
                        autoFocus type="text" value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingField(null); }}
                        className="text-xs text-navy/60 bg-navy/[0.04] rounded-md px-1.5 -mx-1.5 outline-none ring-1 ring-navy/10 focus:ring-navy/20 w-full"
                      />
                      <EditConfirmButtons onConfirm={saveEdit} onCancel={() => setEditingField(null)} small />
                    </div>
                  ) : (
                    <p
                      className="text-xs text-navy/40 truncate mt-0.5 cursor-pointer hover:text-navy/60 transition-colors"
                      onClick={() => startEditing(t, "secondary")}
                    >{secondary}</p>
                  )
                )}
              </div>

              {/* origen */}
              <div className="w-[110px] shrink-0 flex items-center gap-1.5 text-navy/40">
                {t.payment_method === "efectivo" ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="13" r="3"/><path d="M6 10h.01M18 10h.01"/>
                  </svg>
                ) : t.payment_method === "banco" ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M3 21h18M4 21V10l8-6 8 6v11M9 21v-6h6v6"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/>
                  </svg>
                )}
                <span className="text-xs leading-none whitespace-nowrap truncate">{originLabel(t.payment_method)}</span>
              </div>

              {/* contacto */}
              <div className="w-[140px] shrink-0 overflow-hidden">
                <span className={`text-xs truncate block ${t.contact ? "text-navy/55" : "text-navy/30"}`}>
                  {t.contact || "Sin asignar"}
                </span>
              </div>

              {/* categoría */}
              <div className="w-[170px] shrink-0" onClick={(e) => e.stopPropagation()}>
                <CategoryPill category={t.category} categories={categories} onChange={(cat) => handleCategoryChange(t.id, cat)} />
              </div>

              {/* fecha */}
              <div className="w-[90px] shrink-0 text-right">
                <span className="text-xs text-navy/45 tabular-nums whitespace-nowrap">{fmtDate(t.date)}</span>
              </div>

              {/* importe */}
              <div className="w-[120px] shrink-0 text-right">
                <span className={`text-sm font-semibold tabular-nums ${t.amount > 0 ? "text-success" : "text-navy/75"}`}>
                  {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                </span>
                {t.balance != null && (
                  <p className="text-[10px] text-navy/40 tabular-nums mt-0.5">{fmtAmt(t.balance)}</p>
                )}
              </div>
            </div>
          );
        };

        const headerRow = (
          <div className="flex items-center gap-4 px-4 py-3 border-b border-navy/[0.06] bg-navy/[0.012] group/head">
            <div className="w-9 shrink-0 flex items-center pl-[3px]">
              <Checkbox checked={allSelected} onChange={toggleAll} />
            </div>
            <SortableHeader label="Concepto" sortKey="concept" align="left" className="flex-1" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
            <div className="w-[110px] shrink-0 text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Origen</div>
            <div className="w-[140px] shrink-0 text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Contacto</div>
            <div className="w-[170px] shrink-0 text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Categoría</div>
            <SortableHeader label="Fecha" sortKey="date" align="right" className="w-[90px]" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
            <SortableHeader label="Importe / Saldo" sortKey="amount" align="right" className="w-[120px]" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
          </div>
        );

        return (
          <div className="hidden sm:block">
            {sortedFiltered.length === 0 ? (
              <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
                {headerRow}
                <p className="py-12 text-center text-sm text-navy/40">Sin resultados</p>
              </div>
            ) : sortKey ? (
              /* Orden manual activo → lista plana, sin agrupar por mes */
              <div className={`bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
                {headerRow}
                {sortedFiltered.map(renderRow)}
              </div>
            ) : (
              /* Agrupado por mes, lista continua */
              <div className={`bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
                {headerRow}
                {byMonth.map(([monthKey, monthTxns]) => {
                  const monthNet = monthTxns.reduce((s, t) => s + t.amount, 0);
                  const [y, m] = monthKey.split("-");
                  const monthName = MONTHS_ES[parseInt(m) - 1];
                  const label = monthName.charAt(0).toUpperCase() + monthName.slice(1)
                    + (parseInt(y) !== new Date().getFullYear() ? ` ${y}` : "");
                  return (
                    <div key={monthKey}>
                      <div className="flex items-baseline justify-between px-4 py-4 bg-navy/[0.025] border-y border-navy/[0.07]">
                        <span className="text-[15px] font-bold text-navy">{label}</span>
                        <span className={`text-sm font-semibold tabular-nums ${monthNet < 0 ? "text-danger" : "text-success"}`}>
                          {monthNet < 0 ? "−" : "+"}{fmtAmt(Math.abs(monthNet))}
                        </span>
                      </div>
                      {monthTxns.map(renderRow)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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
          recurringExpense={recurringExpenses.find((e) => e.key === seriesKeyFor(drawerTxn)) ?? null}
          onClose={() => setDrawerTxnId(null)}
          onUpdateConcept={handleConceptChange}
          onUpdateBankDetails={handleBankDetailsChange}
          onUpdateCategory={handleCategoryChange}
          onUpdateDate={handleDateChange}
          onUpdatePaymentMethod={handlePaymentMethodChange}
          onDelete={handleDeleteOne}
        />
      )}
    </div>
  );
}
