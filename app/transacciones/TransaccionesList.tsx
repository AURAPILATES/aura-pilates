"use client";
import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import type { Anomaly } from "./page";
import { updateTransactionCategory, updateTransactionNotes, updateTransactionContactType } from "./actions";
import type { ContactType } from "@/lib/transactions";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/dateRange";
import ImportButton from "./ImportButton";

const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function fmtDayLabel(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yest  = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  if (dateStr === today) return "Hoy";
  if (dateStr === yest)  return "Ayer";
  const [, m, d] = dateStr.split("-");
  return `${parseInt(d)} de ${MONTHS_ES[parseInt(m) - 1]}`;
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

const CAT_FALLBACK = { emoji: "package", bg: "#F8FAFC", color: "#94A3B8" };

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

const CONTACT_TYPES: { value: ContactType; label: string; emoji: string; bg: string; color: string }[] = [
  { value: "empleado",       label: "Empleado/a",     emoji: "👤", bg: "#E0E7FF", color: "#3730A3" },
  { value: "socio",          label: "Socio/a",        emoji: "🤝", bg: "#EDE9FE", color: "#5B21B6" },
  { value: "proveedor",      label: "Proveedor",      emoji: "🏭", bg: "#FFF7ED", color: "#C2410C" },
  { value: "administracion", label: "Administración", emoji: "🏛️", bg: "#FEE2E2", color: "#991B1B" },
  { value: "banco",          label: "Banco",          emoji: "🏦", bg: "#EFF6FF", color: "#1D4ED8" },
];

function ContactTypePill({ contactType, onChange }: { contactType: ContactType; onChange: (ct: ContactType) => void }) {
  const cfg = CONTACT_TYPES.find((c) => c.value === contactType);
  return (
    <div className="relative inline-flex">
      {cfg ? (
        <div
          className="flex items-center gap-1 pl-1 pr-2.5 py-0.5 rounded-full text-[11px] font-medium pointer-events-none select-none whitespace-nowrap"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          <span className="text-xs leading-none">{cfg.emoji}</span>
          <span>{cfg.label}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 pl-1 pr-2.5 py-0.5 rounded-full text-[11px] font-medium pointer-events-none select-none whitespace-nowrap bg-navy/[0.05] text-navy/45">
          <span className="text-xs leading-none">＋</span>
          <span>Tipo</span>
        </div>
      )}
      <select
        value={contactType ?? ""}
        onChange={(e) => onChange((e.target.value as ContactType) || null)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        aria-label="Tipo de contacto"
      >
        <option value="">Sin clasificar</option>
        {CONTACT_TYPES.map((c) => (
          <option key={c.value} value={c.value ?? ""}>{c.emoji} {c.label}</option>
        ))}
      </select>
    </div>
  );
}

function CategoryPill({ category, categories, onChange }: { category: string; categories: Category[]; onChange: (cat: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const cat = categories.find((c) => c.value === category);
  const cfg = cat ? { emoji: cat.emoji, bg: cat.bg_color, color: cat.text_color } : CAT_FALLBACK;
  const label = cat?.label ?? category;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full text-xs font-medium whitespace-nowrap hover:brightness-95 transition-all"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        <CatIcon iconKey={cfg.emoji} name={label} color={cfg.color} />
        <span>{label}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-navy/10 rounded-xl shadow-xl overflow-y-auto py-1"
          style={{ minWidth: "11rem", maxHeight: "13rem" }}>
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
        </div>
      )}
    </div>
  );
}

const SELECT_CLS = "appearance-none text-sm border border-navy/[0.12] rounded-xl px-3 pr-8 py-2 bg-white outline-none focus:border-primary/40 text-navy cursor-pointer hover:border-navy/20 transition-colors w-full";

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

type Props = {
  transactions: Transaction[];
  categories: Category[];
  uncategorizedCount: number;
  recurringContacts: string[];
  anomalies: Anomaly[];
  currentRange: string;
  customFrom?: string;
  customTo?: string;
};

export default function TransaccionesList({
  transactions, categories, uncategorizedCount, recurringContacts, anomalies, currentRange, customFrom, customTo,
}: Props) {
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();
  const [tempFrom, setTempFrom] = useState(customFrom ?? "");
  const [tempTo,   setTempTo]   = useState(customTo   ?? "");

  const [search,      setSearch]      = useState("");
  const [catFilter,   setCatFilter]   = useState(() => searchParams.get("categoria") ?? "all");
  const [typeFilter,  setTypeFilter]  = useState<ContactType | "all">("all");
  const [showMobileFilters,  setShowMobileFilters]  = useState(false);
  const [mobileSelectMode,   setMobileSelectMode]   = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue,   setNotesValue]   = useState("");
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [bulkCat,      setBulkCat]      = useState("");
  const [isPending,    startTransition] = useTransition();

  const recurringSet = new Set(recurringContacts);

  // ── Month strip — solo meses con datos ──────────────────────────────────────
  const monthStrip = useMemo(() => {
    const keys = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort();
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
    if (cat) setCatFilter(cat);
  }, [searchParams]);

  function setRange(key: string) {
    if (key === "custom") return; // wait for user to pick dates
    const params = new URLSearchParams();
    if (key !== "all") params.set("range", key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function applyCustomRange() {
    if (!tempFrom && !tempTo) return;
    const params = new URLSearchParams();
    params.set("range", "custom");
    if (tempFrom) params.set("from", tempFrom);
    if (tempTo)   params.set("to",   tempTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  const filtered = transactions.filter((t) => {
    const q = search.toLowerCase();
    if (q && !t.contact?.toLowerCase().includes(q) && !t.concept?.toLowerCase().includes(q)) return false;
    if (catFilter !== "all" && t.category !== catFilter) return false;
    if (typeFilter !== "all" && t.contact_type !== typeFilter) return false;
    return true;
  });

  // ── Day grouping for mobile ──────────────────────────────────────────────────
  const byDay = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const totalIn  = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const neto     = totalIn - totalOut;

  const allFilteredIds = filtered.map((t) => t.id);
  const allSelected    = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const someSelected   = selected.size > 0;

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
  function clearSelection() { setSelected(new Set()); setBulkCat(""); }
  function applyBulkCategory() {
    if (!bulkCat) return;
    const ids = [...selected];
    startTransition(async () => { await Promise.all(ids.map((id) => updateTransactionCategory(id, bulkCat))); });
    clearSelection();
  }
  function handleCategoryChange(id: string, category: string) {
    startTransition(() => updateTransactionCategory(id, category));
  }
  function handleContactTypeChange(id: string, ct: ContactType) {
    startTransition(() => updateTransactionContactType(id, ct));
  }
  function openNotes(t: Transaction) { setEditingNotes(t.id); setNotesValue(t.notes ?? ""); }
  function saveNotes(id: string) {
    startTransition(() => updateTransactionNotes(id, notesValue));
    setEditingNotes(null);
  }

  const rangeLabel = RANGE_OPTIONS.find(o => o.key === currentRange)?.label ?? "Todo";

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
      {/* ── Mobile: Import + Filtros buttons ────────────────────────────────── */}
      <div className="sm:hidden flex gap-2 mb-3">
        <ImportButton className="flex-1" />
        <button
          onClick={() => setShowMobileFilters((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-navy/[0.12] rounded-lg text-sm font-semibold text-navy"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filtros
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showMobileFilters ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      {/* ── Mobile: Filter drawer ────────────────────────────────────────────── */}
      {showMobileFilters && (
        <div className="sm:hidden bg-white border border-navy/[0.1] rounded-2xl p-4 mb-3 flex flex-col gap-3 shadow-card">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/30" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar concepto o contacto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-navy/[0.12] rounded-lg bg-white text-navy placeholder:text-navy/35 outline-none focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SelectWrapper>
              <select value={currentRange} onChange={(e) => setRange(e.target.value)} className={SELECT_CLS}>
                {RANGE_OPTIONS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
              </select>
            </SelectWrapper>
            <SelectWrapper>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={SELECT_CLS}>
                <option value="all">Categoría</option>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </SelectWrapper>
            <SelectWrapper className="col-span-2">
              <select value={typeFilter ?? "all"} onChange={(e) => setTypeFilter(e.target.value === "all" ? "all" : e.target.value as ContactType)} className={SELECT_CLS}>
                <option value="all">Todos los tipos</option>
                {CONTACT_TYPES.map((c) => <option key={c.value} value={c.value ?? ""}>{c.emoji} {c.label}</option>)}
              </select>
            </SelectWrapper>
          </div>
          {currentRange === "custom" && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-navy/45 uppercase tracking-wide mb-1 font-medium">Desde</p>
                  <input type="date" value={tempFrom} onChange={(e) => setTempFrom(e.target.value)}
                    className="w-full text-sm border border-navy/[0.12] rounded-lg px-3 py-2 bg-white text-navy outline-none" />
                </div>
                <div>
                  <p className="text-[10px] text-navy/45 uppercase tracking-wide mb-1 font-medium">Hasta</p>
                  <input type="date" value={tempTo} min={tempFrom || undefined} onChange={(e) => setTempTo(e.target.value)}
                    className="w-full text-sm border border-navy/[0.12] rounded-lg px-3 py-2 bg-white text-navy outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={applyCustomRange} disabled={!tempFrom && !tempTo}
                  className="flex-1 py-2 text-sm font-semibold bg-navy text-white rounded-lg hover:bg-navy/85 disabled:opacity-40 transition-colors">
                  Aplicar
                </button>
                {(customFrom || customTo) && (
                  <button onClick={() => { setTempFrom(""); setTempTo(""); router.push(pathname); }}
                    className="px-4 py-2 text-sm text-navy/45 border border-navy/[0.12] rounded-lg hover:text-navy/70 transition-colors">
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile: Alert banner ─────────────────────────────────────────────── */}
      {uncategorizedCount > 0 && (
        <button
          onClick={() => setCatFilter(catFilter === "Otros" ? "all" : "Otros")}
          className="sm:hidden w-full flex items-center gap-2 px-4 py-3 mb-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium text-left"
        >
          <span className="text-base">⚠</span>
          <span className="flex-1">{uncategorizedCount} sin etiquetar</span>
        </button>
      )}

      {/* ── Mobile: Summary card ──────────────────────────────────────────────── */}
      <div className="sm:hidden bg-white border border-navy/[0.07] rounded-2xl shadow-card px-4 py-4 mb-4">
        <p className="text-[10px] text-navy/40 uppercase tracking-wider font-semibold mb-3">
          Resumen · {RANGE_OPTIONS.find(o => o.key === currentRange)?.label ?? "Todo"}
        </p>
        <div className="grid grid-cols-3 gap-2 divide-x divide-navy/[0.06]">
          <div className="text-center">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Ingresos</p>
            <p className="text-sm font-bold text-success tabular-nums">+{fmtAmt(totalIn)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Gastos</p>
            <p className="text-sm font-bold text-navy/65 tabular-nums">−{fmtAmt(totalOut)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Neto</p>
            <p className={`text-sm font-bold tabular-nums ${neto >= 0 ? "text-primary" : "text-danger"}`}>
              {neto >= 0 ? "+" : "−"}{fmtAmt(Math.abs(neto))}
            </p>
          </div>
        </div>
      </div>

      {/* ── Desktop: fila 1 — Buscador ────────────────────────────────────── */}
      <div className="hidden sm:block mb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/30" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar concepto o contacto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-navy/[0.12] rounded-xl bg-white text-navy placeholder:text-navy/35 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/30 hover:text-navy/60">✕</button>
          )}
        </div>
      </div>

      {/* ── Desktop: fila 2 — Filtros + Importar + Exportar ───────────────── */}
      <div className="hidden sm:flex items-center gap-2 mb-3">
        <SelectWrapper>
          <select value={typeFilter ?? "all"} onChange={(e) => setTypeFilter(e.target.value === "all" ? "all" : e.target.value as ContactType)} className={SELECT_CLS}>
            <option value="all">Tipos</option>
            {CONTACT_TYPES.map((c) => <option key={c.value} value={c.value ?? ""}>{c.emoji} {c.label}</option>)}
          </select>
        </SelectWrapper>
        <SelectWrapper>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={SELECT_CLS}>
            <option value="all">Categoría</option>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </SelectWrapper>
        <SelectWrapper>
          <select value={currentRange} onChange={(e) => setRange(e.target.value)} className={SELECT_CLS}>
            {RANGE_OPTIONS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
          </select>
        </SelectWrapper>
        <div className="flex-1" />
        <ImportButton />
        <button
          onClick={exportCSV}
          title="Exportar vista actual a CSV"
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-navy/55 border border-navy/[0.12] rounded-xl bg-white hover:bg-navy/[0.02] hover:text-navy transition-colors whitespace-nowrap"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* ── Custom date range (desktop only) ──────────────────────────────── */}
      {currentRange === "custom" && (
        <div className="hidden sm:flex flex-wrap items-center gap-2 mb-3 p-3 bg-white border border-navy/[0.07] rounded-xl shadow-card">
          <span className="text-xs text-navy/50 font-medium">Desde</span>
          <input
            type="date"
            value={tempFrom}
            onChange={(e) => setTempFrom(e.target.value)}
            className="text-sm border border-navy/[0.12] rounded-lg px-3 py-1.5 bg-white text-navy outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition cursor-pointer"
          />
          <span className="text-xs text-navy/50 font-medium">Hasta</span>
          <input
            type="date"
            value={tempTo}
            min={tempFrom || undefined}
            onChange={(e) => setTempTo(e.target.value)}
            className="text-sm border border-navy/[0.12] rounded-lg px-3 py-1.5 bg-white text-navy outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition cursor-pointer"
          />
          <button
            onClick={applyCustomRange}
            disabled={!tempFrom && !tempTo}
            className="px-4 py-1.5 text-sm font-semibold bg-navy text-white rounded-lg hover:bg-navy/85 disabled:opacity-40 transition-colors"
          >
            Aplicar
          </button>
          {(customFrom || customTo) && (
            <button
              onClick={() => { setTempFrom(""); setTempTo(""); router.push(pathname); }}
              className="text-xs text-navy/45 hover:text-navy/70 transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* ── Desktop: fila 3 — Recuento + sumatorios ───────────────────────── */}
      <div className="hidden sm:flex items-center gap-4 mb-5">
        <span className="text-sm text-navy/55">
          {filtered.length} movimientos
          {isPending && <span className="ml-2 text-xs text-primary/60">Guardando…</span>}
        </span>
        {uncategorizedCount > 0 && (
          <button
            onClick={() => setCatFilter(catFilter === "Otros" ? "all" : "Otros")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              catFilter === "Otros"
                ? "bg-warning/20 text-warning"
                : "bg-warning/10 text-warning hover:bg-warning/15"
            }`}
          >
            <span>⚠</span>
            <span>{uncategorizedCount} sin etiquetar</span>
          </button>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider">Ingresos</p>
            <p className="text-sm font-semibold text-success tabular-nums">+{fmtAmt(totalIn)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider">Gastos</p>
            <p className="text-sm font-semibold text-navy/65 tabular-nums">−{fmtAmt(totalOut)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider">Resultado neto</p>
            <p className={`text-sm font-semibold tabular-nums ${neto >= 0 ? "text-primary" : "text-danger"}`}>
              {neto >= 0 ? "+" : "−"}{fmtAmt(Math.abs(neto))}
            </p>
          </div>
        </div>
      </div>

      {/* ── Mobile: toolbar ────────────────────────────────────────────────── */}
      <div className="sm:hidden flex flex-wrap items-center gap-x-4 gap-y-2 mb-5">
        <span className="text-sm text-navy/55">{filtered.length} movimientos</span>
        <button
          onClick={() => { setMobileSelectMode((v) => { if (v) clearSelection(); return !v; }); }}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
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
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-navy/55 border border-navy/[0.12] rounded-lg bg-white hover:bg-navy/[0.02] hover:text-navy transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* ── Bulk selection bar ─────────────────────────────────────────────── */}
      {someSelected && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-navy rounded-2xl shadow-2xl border border-white/10 min-w-max">
          <span className="text-sm font-semibold text-white shrink-0">
            {selected.size} seleccionada{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="w-px h-4 bg-white/20 shrink-0" />
          <select
            value={bulkCat}
            onChange={(e) => setBulkCat(e.target.value)}
            className="text-sm rounded-lg px-3 py-1.5 bg-white/10 text-white border border-white/20 outline-none focus:border-white/40 min-w-48 cursor-pointer"
          >
            <option value="" disabled>Cambiar categoría…</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value} className="text-navy bg-white">{c.label}</option>
            ))}
          </select>
          <button
            onClick={applyBulkCategory}
            disabled={!bulkCat || isPending}
            className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-white text-navy disabled:opacity-40 hover:bg-white/90 transition-colors shrink-0"
          >
            Aplicar
          </button>
          <button onClick={clearSelection} className="text-sm text-white/50 hover:text-white/80 px-1 shrink-0">✕</button>
        </div>
      )}

      {/* ── Mobile: month strip (sticky) ────────────────────────────────────── */}
      <div className="sm:hidden sticky top-14 z-20 -mx-2 px-2 pt-2 pb-3 bg-app-bg border-b border-navy/[0.06]">
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
                  const isRecurring = !!t.contact && recurringSet.has(t.contact.toLowerCase().trim());
                  const isSelected  = selected.has(t.id);
                  const primary     = t.contact || t.concept || "—";
                  const secondary   = t.contact && t.concept && t.concept !== t.contact ? t.concept : null;
                  return (
                    <div key={t.id} className={`px-3 py-4 transition-colors ${isSelected ? "bg-primary/[0.035]" : ""}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {mobileSelectMode && (
                            <input type="checkbox" checked={isSelected} onChange={() => toggleOne(t.id)}
                              className="shrink-0 rounded border-navy/20 accent-primary cursor-pointer" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-navy truncate">{primary}</span>
                              {isRecurring && <span className="shrink-0 text-[10px] text-primary/50">↺</span>}
                            </div>
                            {secondary && <p className="text-[11px] text-navy/40 truncate mt-0.5">{secondary}</p>}
                          </div>
                        </div>
                        <span className={`shrink-0 text-sm font-semibold tabular-nums ${t.amount > 0 ? "text-success" : "text-navy/75"}`}>
                          {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
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
            <col style={{ width: "32px" }} />
            <col />
            <col style={{ width: "172px" }} />
            <col style={{ width: "184px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "128px" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-navy/[0.06] bg-navy/[0.012] group/head">
              <th className="pl-3 py-3 align-middle">
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  className="block rounded border-navy/[0.12] accent-primary cursor-pointer"
                  aria-label="Seleccionar todas" />
              </th>
              <th className="text-left pl-2 pr-4 py-3 text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Concepto</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Categoría</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Notas</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Fecha</th>
              <th className="text-right pr-6 py-3 text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Importe</th>
            </tr>
          </thead>
          <tbody className={isPending ? "opacity-50 pointer-events-none" : ""}>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-navy/40">Sin resultados</td>
              </tr>
            )}
            {filtered.map((t) => {
              const isRecurring = !!t.contact && recurringSet.has(t.contact.toLowerCase().trim());
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
                  <td className="pl-3 align-middle" style={{ height: "60px" }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleOne(t.id)}
                      className="block rounded border-navy/[0.12] accent-primary cursor-pointer" />
                  </td>

                  <td className="pl-2 pr-4 align-middle overflow-hidden" style={{ height: "60px" }}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-semibold text-navy truncate">{primary}</span>
                      {isRecurring && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-primary/60 font-medium whitespace-nowrap">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                          </svg>
                          mensual
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {secondary && <p className="text-[11px] text-navy/40 truncate">{secondary}</p>}
                      <ContactTypePill contactType={t.contact_type} onChange={(ct) => handleContactTypeChange(t.id, ct)} />
                    </div>
                  </td>

                  <td className="px-4 align-middle" style={{ height: "60px" }}>
                    <CategoryPill category={t.category} categories={categories} onChange={(cat) => handleCategoryChange(t.id, cat)} />
                  </td>

                  <td className="px-4 align-middle overflow-hidden" style={{ height: "60px" }}>
                    {editingNotes === t.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus type="text" value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveNotes(t.id); if (e.key === "Escape") setEditingNotes(null); }}
                          className="text-xs border border-primary/30 rounded px-2 py-1 outline-none focus:border-primary/60 w-28"
                          placeholder="Añadir nota…"
                        />
                        <button onClick={() => saveNotes(t.id)} className="text-xs text-primary font-bold px-1">✓</button>
                        <button onClick={() => setEditingNotes(null)} className="text-xs text-navy/50">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => openNotes(t)} className="w-full text-left text-xs truncate block">
                        {t.notes
                          ? <span className="text-navy/50 hover:text-navy/70 transition-colors flex items-center gap-1"><span className="text-navy/30">↗</span> {t.notes}</span>
                          : <span className="text-navy/30 opacity-0 group-hover:opacity-100 transition-opacity">+ nota</span>
                        }
                      </button>
                    )}
                  </td>

                  <td className="px-4 align-middle text-right" style={{ height: "60px" }}>
                    <span className="text-xs text-navy/45 tabular-nums whitespace-nowrap">{fmtDate(t.date)}</span>
                  </td>

                  <td className="pr-6 pl-2 align-middle text-right" style={{ height: "60px" }}>
                    <span className={`text-sm font-semibold tabular-nums ${t.amount > 0 ? "text-success" : "text-navy/75"}`}>
                      {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
