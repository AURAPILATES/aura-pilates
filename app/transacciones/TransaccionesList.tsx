"use client";
import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import { updateTransactionCategory, updateTransactionConcept, updateTransactionContact, softDeleteTransactions } from "./actions";
import ImportButton from "./ImportButton";
import AddCashModal from "./AddCashModal";
import PapeleraDrawer from "./PapeleraDrawer";
import TransactionDrawer from "./TransactionDrawer";

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

// ── Source avatar ─────────────────────────────────────────────────────────────
const SOCIO_INITIALS: Record<string, { initials: string; bg: string; color: string }> = {
  victor: { initials: "V",  bg: "#EDE9FE", color: "#5B21B6" },
  celia:  { initials: "Ce", bg: "#FCE7F3", color: "#9D174D" },
  olga:   { initials: "O",  bg: "#D1FAE5", color: "#065F46" },
  carles: { initials: "Ca", bg: "#DBEAFE", color: "#1D4ED8" },
};

function SourceAvatar({ method }: { method: string }) {
  if (method === "efectivo") {
    return (
      <div className="shrink-0 w-[22px] h-[22px] rounded-full bg-amber-100 flex items-center justify-center" title="Efectivo Aura">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="13" r="3"/><path d="M6 10h.01M18 10h.01"/>
        </svg>
      </div>
    );
  }
  const socio = SOCIO_INITIALS[method];
  if (socio) {
    return (
      <div
        className="shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center"
        style={{ background: socio.bg, color: socio.color }}
        title={method.charAt(0).toUpperCase() + method.slice(1)}
      >
        <span style={{ fontSize: "9px", fontWeight: 700, lineHeight: 1 }}>{socio.initials}</span>
      </div>
    );
  }
  return (
    <div
      className="shrink-0 w-[22px] h-[22px] rounded-full bg-sky-50 flex items-center justify-center"
      title="CaixaBank"
    >
      <img src="/Caixabank logo.png" alt="CaixaBank" width={13} height={13} className="object-contain" />
    </div>
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

// ── Icon system ───────────────────────────────────────────────────────────────
const ICON_PATHS: Record<string, React.ReactNode> = {
  "home": <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  "users": <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  "zap": <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
  "droplet": <><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></>,
  "monitor": <><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
  "file-text": <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
  "percent": <><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>,
  "phone": <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 2.72h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.9a16 16 0 0 0 6.09 6.09l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"/></>,
  "shield": <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  "credit-card": <><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
  "shopping-bag": <><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></>,
  "settings": <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  "bar-chart": <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  "trending-up": <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
  "briefcase": <><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
  "repeat": <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>,
  "package": <><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
};
const NAME_TO_KEY: Record<string, string> = {
  "Ingresos Stripe": "trending-up", "Ingresos USC": "trending-up",
  "Alquiler": "home", "Local": "home",
  "Salarios": "users", "Seguridad social": "shield",
  "Gestoría y legal": "file-text", "Impuestos y tasas": "percent",
  "Software": "monitor", "Electricidad": "zap", "Agua": "droplet",
  "Teléfono": "phone", "Seguros": "briefcase",
  "Comisiones bancarias": "credit-card", "Merchandising": "shopping-bag",
  "Material y maquinaria": "settings", "Inversión": "bar-chart",
  "Traspasos internos": "repeat",
};
function CatIcon({ iconKey, name, color }: { iconKey: string; name: string; color: string }) {
  const key = ICON_PATHS[iconKey] ? iconKey : (NAME_TO_KEY[name] ?? "package");
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[key] ?? ICON_PATHS["package"]}
    </svg>
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
    label = <span className="text-navy/55">Categoría</span>;
  } else if (selected.length === 1) {
    const val = selected[0];
    if (val === "__none__") {
      label = <span>Sin categoría</span>;
    } else {
      const cat = categories.find((c) => c.value === val);
      label = cat ? (
        <span className="flex items-center gap-1.5">
          <CatIcon iconKey={cat.emoji} name={cat.label} color={cat.text_color} />
          {cat.label}
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
          {categories.map((c) => (
            <button
              key={c.value}
              onClick={() => toggle(c.value)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-navy/[0.04] transition-colors"
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

export function CategoryPill({ category, categories, onChange }: { category: string | null; categories: Category[]; onChange: (cat: string | null) => void }) {
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

  const cat = category ? categories.find((c) => c.value === category) : undefined;
  const cfg = cat ? {
    emoji: cat.emoji,
    bg: cat.bg_color === cat.text_color
      ? (() => { const r = parseInt(cat.text_color.slice(1,3),16), g = parseInt(cat.text_color.slice(3,5),16), b = parseInt(cat.text_color.slice(5,7),16); return `rgba(${r},${g},${b},0.12)`; })()
      : cat.bg_color,
    color: cat.text_color,
  } : CAT_FALLBACK;
  const label = cat?.label ?? (category || "Sin categoría");

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap hover:brightness-95 transition-all"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        <CatIcon iconKey={cfg.emoji} name={label} color={cfg.color} />
        <span>{label}</span>
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
          {categories.map((c) => (
            <button
              key={c.value}
              onClick={() => { onChange(c.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-navy/[0.04] transition-colors ${c.value === category ? "font-semibold" : ""}`}
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
    <th
      onClick={() => onClick(sortKey)}
      className={`${align === "right" ? "text-right" : "text-left"} ${className} py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${
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
    </th>
  );
}

type Props = {
  transactions: Transaction[];
  categories: Category[];
  uncategorizedCount: number;
  recurringPeriods: Record<string, string>;
};

export default function TransaccionesList({
  transactions, categories, uncategorizedCount, recurringPeriods,
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


  // ── Month strip — solo meses con datos ──────────────────────────────────────
  const monthStrip = useMemo(() => {
    const keys = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse();
    return keys.map((key) => {
      const m = parseInt(key.slice(5)) - 1;
      return { key, label: MONTHS_ES[m], year: parseInt(key.slice(0, 4)) };
    });
  }, [transactions]);

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

  const filtered = transactions.filter((t) => {
    const q = search.toLowerCase();
    if (q && !t.contact?.toLowerCase().includes(q) && !t.concept?.toLowerCase().includes(q)) return false;
    if (catFilters.length > 0 && !catFilters.includes(t.category ?? "__none__")) return false;
    if (originFilter !== "all" && t.payment_method !== originFilter) return false;
    if (onlyRecurring && !recurringPeriods[t.id]) return false;
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

  const allFilteredIds = filtered.map((t) => t.id);
  const allSelected    = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const someSelected   = selected.size > 0;

  const activeTxns = someSelected ? filtered.filter((t) => selected.has(t.id)) : filtered;
  const totalIn  = activeTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = activeTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
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
  function handleContactChange(id: string, value: string) {
    startTransition(() => updateTransactionContact(id, value));
  }
  function handleConceptChange(id: string, value: string) {
    startTransition(() => updateTransactionConcept(id, value));
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
      {/* ── KPI bar sticky (reactiva a filtros) ────────────────────────────── */}
      <div className="sm:sticky sm:top-[45px] sm:z-[15] -mx-2 sm:-mx-6 sm:bg-app-bg/95 sm:backdrop-blur-sm sm:border-b sm:border-navy/[0.06] mb-4 sm:mb-3">
        <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-7 px-3 sm:px-6 py-2.5">
          <div className="text-center sm:text-left sm:min-w-[110px]">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider leading-none mb-0.5">Ingresos</p>
            <p className="text-sm font-semibold text-success tabular-nums">+{fmtAmt(totalIn)}</p>
          </div>
          <div className="hidden sm:block h-4 w-px bg-navy/[0.1] shrink-0" />
          <div className="text-center sm:text-left sm:min-w-[110px]">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider leading-none mb-0.5">Gastos</p>
            <p className="text-sm font-semibold text-[#B85C3A] tabular-nums">−{fmtAmt(totalOut)}</p>
          </div>
          <div className="hidden sm:block h-4 w-px bg-navy/[0.1] shrink-0" />
          <div className="text-center sm:text-left sm:min-w-[110px]">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider leading-none mb-0.5">Resultado neto</p>
            <p className={`text-sm font-semibold tabular-nums ${neto >= 0 ? "text-navy" : "text-danger"}`}>
              {neto >= 0 ? "+" : "−"}{fmtAmt(Math.abs(neto))}
            </p>
          </div>
          {totalIn > 0 && (
            <>
              <div className="hidden sm:block h-4 w-px bg-navy/[0.1] shrink-0" />
              <span className="hidden sm:inline text-xs text-navy/35 tabular-nums">
                margen {(neto / totalIn * 100).toFixed(1).replace(".", ",")}%
              </span>
            </>
          )}
          <div className="flex-1" />
          {uncategorizedCount > 0 && (
            <button
              onClick={() => setCatFilters(catFilters.includes("__none__") ? catFilters.filter((v) => v !== "__none__") : [...catFilters, "__none__"])}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                catFilters.includes("__none__")
                  ? "bg-warning/20 text-warning"
                  : "bg-warning/10 text-warning hover:bg-warning/15"
              }`}
            >
              <span>⚠</span>
              <span>{uncategorizedCount} sin etiquetar</span>
            </button>
          )}
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
          {(catFilters.length > 0 || originFilter !== "all" || onlyRecurring) && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
      </div>

      {/* ── Mobile: Filter drawer ────────────────────────────────────────────── */}
      {showMobileFilters && (
        <div className="sm:hidden bg-white border border-navy/[0.1] rounded-2xl p-4 mb-3 flex flex-col gap-3 shadow-card">
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
          className="sm:hidden w-full flex items-center gap-2 px-4 py-3 mb-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium text-left"
        >
          <span className="text-base">⚠</span>
          <span className="flex-1">{uncategorizedCount} sin etiquetar</span>
        </button>
      )}


      {/* ── Desktop: barra de filtros unificada ────────────────────────────── */}
      <div className="hidden sm:flex items-center gap-2 mb-3">
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
        <CategoryMultiFilter selected={catFilters} categories={categories} onChange={setCatFilters} />
        <SelectWrapper>
          <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value)} className={SELECT_CLS} style={{ width: "130px" }}>
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
          title="Mostrar solo movimientos recurrentes"
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
            onlyRecurring
              ? "bg-navy text-white border-navy"
              : "bg-white text-navy/55 border-navy/15 hover:text-navy"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
          Recurrentes
        </button>
        <ImportButton onManual={() => setShowAddCash(true)} />
        <button
          onClick={exportCSV}
          title="Exportar vista actual a CSV"
          className="shrink-0 flex items-center justify-center w-9 h-9 text-navy/50 hover:text-navy border border-navy/15 rounded-lg bg-white hover:bg-navy/[0.02] transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button
          onClick={() => setShowPapelera(true)}
          title="Papelera — transacciones eliminadas"
          className="shrink-0 flex items-center justify-center w-9 h-9 text-navy/50 hover:text-navy border border-navy/15 rounded-lg bg-white hover:bg-navy/[0.02] transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>

      {/* ── Desktop: recuento ─────────────────────────────────────────────────── */}
      <div className="hidden sm:flex items-center gap-3 mb-5">
        <span className="text-sm text-navy/45">
          {someSelected
            ? <>{selected.size} seleccionada{selected.size !== 1 ? "s" : ""} <span className="text-navy/30">de {filtered.length}</span></>
            : <>{filtered.length} movimientos</>
          }
          {isPending && <span className="ml-2 text-xs text-primary/60">Guardando…</span>}
        </span>
        {(catFilters.length > 0 || originFilter !== "all" || onlyRecurring) && (
          <button
            onClick={() => { setCatFilters([]); setOriginFilter("all"); setOnlyRecurring(false); }}
            className="text-xs text-navy/45 hover:text-navy underline whitespace-nowrap"
          >
            Eliminar filtros
          </button>
        )}
      </div>

      {/* ── Mobile: toolbar ────────────────────────────────────────────────── */}
      <div className="sm:hidden mb-5">
        {(catFilters.length > 0 || originFilter !== "all" || onlyRecurring || currentRange !== "all") && (
          <div className="flex items-center mb-3">
            <button
              onClick={() => {
                setCatFilters([]);
                setOriginFilter("all");
                setOnlyRecurring(false);
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
            className={`shrink-0 flex items-center h-9 text-xs font-medium px-3 rounded-lg border transition-colors ${
              mobileSelectMode
                ? "bg-navy text-white border-navy"
                : "bg-white text-navy/55 border-navy/[0.12] hover:text-navy"
            }`}
          >
            {mobileSelectMode ? "Cancelar" : "Seleccionar"}
          </button>
          <button
            onClick={exportCSV}
            title="Exportar vista actual a CSV"
            className="shrink-0 flex items-center justify-center w-9 h-9 text-navy/55 border border-navy/[0.12] rounded-lg bg-white hover:bg-navy/[0.02] hover:text-navy transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button
            onClick={() => setShowPapelera(true)}
            title="Papelera"
            className="shrink-0 flex items-center justify-center w-9 h-9 text-navy/55 border border-navy/[0.12] rounded-lg bg-white hover:bg-navy/[0.02] hover:text-navy transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
            </svg>
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
                {categories.map((c) => (
                  <option key={c.value} value={c.value} className="text-navy bg-white">{c.label}</option>
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

      {/* ── Mobile: month strip (sticky) ────────────────────────────────────── */}
      <div className="sm:hidden sticky top-[45px] z-20 -mx-2 px-2 pt-2 pb-3 bg-app-bg border-b border-navy/[0.06]">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => router.push(pathname)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm transition-colors ${
              !activeMonth ? "bg-navy text-white font-medium" : "text-navy/50"
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
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm transition-colors capitalize ${
                  isActive ? "bg-navy text-white font-medium" : "text-navy/50 hover:text-navy"
                }`}
              >
                {label}{showYear && <span className="text-[10px] ml-0.5 opacity-60">{year}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Mobile: day-grouped cards ───────────────────────────────────────── */}
      <div className="sm:hidden space-y-6 mt-3">
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
                  {dayNet >= 0 ? "+" : "−"}{fmtAmt(Math.abs(dayNet))}
                </span>
              </div>
              {/* Day card */}
              <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden divide-y divide-navy/[0.05]">
                {dayTxns.map((t) => {
                  const recurringPeriod = recurringPeriods[t.id];
                  const isSelected  = selected.has(t.id);
                  const primary     = t.contact || t.concept || "—";
                  const secondary   = t.contact && t.concept && t.concept !== t.contact ? t.concept : null;
                  return (
                    <div key={t.id} className={`px-3 py-4 transition-colors ${isSelected ? "bg-primary/[0.035]" : ""}`}>
                      <div
                        className="flex items-center justify-between gap-3 cursor-pointer"
                        onClick={() => { if (mobileSelectMode) toggleOne(t.id); else setDrawerTxnId(t.id); }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {mobileSelectMode && (
                            <Checkbox checked={isSelected} onChange={() => toggleOne(t.id)} />
                          )}
                          <SourceAvatar method={t.payment_method} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                              <span className="text-sm font-medium text-navy truncate">{primary}</span>
                              {recurringPeriod && <span className="shrink-0 text-sm text-primary/50" title={recurringPeriod}>↺</span>}
                            </div>
                            {secondary && <p className="text-[11px] text-navy/40 truncate mt-0.5">{secondary}</p>}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`text-sm font-semibold tabular-nums ${t.amount > 0 ? "text-success" : "text-navy/75"}`}>
                            {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                          </span>
                          {t.balance != null && (
                            <p className="text-[10px] text-navy/40 tabular-nums mt-0.5">{fmtAmt(t.balance)} €</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        <CategoryPill category={t.category} categories={categories} onChange={(cat) => handleCategoryChange(t.id, cat)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table ──────────────────────────────────────────────────── */}
      <div className="hidden sm:block bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
        <table className="w-full" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "44px" }} />
            <col style={{ width: "380px" }} />
            <col style={{ width: "130px" }} />
            <col />
            <col style={{ width: "172px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "128px" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-navy/[0.06] bg-navy/[0.012] group/head">
              <th className="pl-3 py-3 align-middle">
                <Checkbox checked={allSelected} onChange={toggleAll} />
              </th>
              <SortableHeader label="Concepto" sortKey="concept" align="left" className="pl-2 pr-4" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Origen</th>
              <th />
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Categoría</th>
              <SortableHeader label="Fecha" sortKey="date" align="right" className="px-4" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Importe" sortKey="amount" align="right" className="pr-6" currentKey={sortKey} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody className={isPending ? "opacity-50 pointer-events-none" : ""}>
            {sortedFiltered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-navy/40">Sin resultados</td>
              </tr>
            )}
            {sortedFiltered.map((t) => {
              const recurringPeriod = recurringPeriods[t.id];
              const isSelected  = selected.has(t.id);
              const primary     = t.contact || t.concept || "—";
              const secondary   = t.contact && t.concept && t.concept !== t.contact ? t.concept : null;

              return (
                <tr
                  key={t.id}
                  className={`border-b border-navy/[0.04] last:border-0 group transition-colors ${
                    isSelected ? "bg-primary/[0.03]" : "hover:bg-navy/[0.01]"
                  }`}
                >
                  <td className="pl-3 py-2.5 align-middle">
                    <div className="relative w-[22px] h-[22px] flex items-center justify-center">
                      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${isSelected ? "opacity-0" : "opacity-100 group-hover:opacity-0"}`}>
                        <SourceAvatar method={t.payment_method} />
                      </div>
                      <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                        <Checkbox checked={isSelected} onChange={() => toggleOne(t.id)} />
                      </div>
                    </div>
                  </td>

                  <td className="pl-2 pr-4 py-2.5 align-middle overflow-hidden">
                    <div className="min-w-0">
                      <div className="min-w-0">
                        {editingField?.id === t.id && editingField.field === (t.contact != null ? "contact" : "concept") ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus type="text" value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingField(null); }}
                              className="text-sm font-medium text-navy bg-navy/[0.04] rounded-md px-1.5 -mx-1.5 outline-none ring-1 ring-navy/10 focus:ring-navy/20 w-full"
                            />
                            <EditConfirmButtons onConfirm={saveEdit} onCancel={() => setEditingField(null)} />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                            <span
                              className="text-sm font-medium text-navy truncate cursor-pointer hover:text-navy/70 transition-colors"
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
                            <div className="flex items-center gap-1 mt-0.5">
                              <input
                                autoFocus type="text" value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingField(null); }}
                                className="text-[11px] text-navy/60 bg-navy/[0.04] rounded-md px-1.5 -mx-1.5 outline-none ring-1 ring-navy/10 focus:ring-navy/20 w-full"
                              />
                              <EditConfirmButtons onConfirm={saveEdit} onCancel={() => setEditingField(null)} small />
                            </div>
                          ) : (
                            <p
                              className="text-[11px] text-navy/40 truncate mt-0.5 cursor-pointer hover:text-navy/60 transition-colors"
                              onClick={() => startEditing(t, "secondary")}
                            >{secondary}</p>
                          )
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <span className="text-xs text-navy/55 whitespace-nowrap">{originLabel(t.payment_method)}</span>
                  </td>
                  <td />
                  <td className="px-4 py-3 align-middle">
                    <CategoryPill category={t.category} categories={categories} onChange={(cat) => handleCategoryChange(t.id, cat)} />
                  </td>

                  <td className="px-4 py-3 align-middle text-right">
                    <span className="text-xs text-navy/45 tabular-nums whitespace-nowrap">{fmtDate(t.date)}</span>
                  </td>

                  <td className="pr-6 pl-4 py-3 align-middle text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className={`text-sm font-semibold tabular-nums ${t.amount > 0 ? "text-success" : "text-navy/75"}`}>
                        {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                      </span>
                    </div>
                    {t.balance != null && (
                      <p className="text-[10px] text-navy/40 tabular-nums mt-0.5">{fmtAmt(t.balance)} €</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
          recurringPeriod={recurringPeriods[drawerTxn.id]}
          onClose={() => setDrawerTxnId(null)}
          onUpdateContact={handleContactChange}
          onUpdateConcept={handleConceptChange}
          onUpdateCategory={handleCategoryChange}
        />
      )}
    </div>
  );
}
