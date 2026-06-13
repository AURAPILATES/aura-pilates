"use client";
import { useState, useTransition, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import type { Anomaly } from "./page";
import { updateTransactionCategory, updateTransactionNotes, updateTransactionContactType } from "./actions";
import type { ContactType } from "@/lib/transactions";

const MONTH_NAMES: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[m] ?? m} ${y}`;
}

const CAT_FALLBACK = { emoji: "📦", bg: "#F8FAFC", color: "#94A3B8" };

const CONTACT_TYPES: { value: ContactType; label: string; emoji: string; bg: string; color: string }[] = [
  { value: "empleado",      label: "Empleado/a",    emoji: "👤", bg: "#E0E7FF", color: "#3730A3" },
  { value: "socio",         label: "Socio/a",       emoji: "🤝", bg: "#EDE9FE", color: "#5B21B6" },
  { value: "proveedor",     label: "Proveedor",     emoji: "🏭", bg: "#FFF7ED", color: "#C2410C" },
  { value: "administracion",label: "Administración",emoji: "🏛️", bg: "#FEE2E2", color: "#991B1B" },
  { value: "banco",         label: "Banco",         emoji: "🏦", bg: "#EFF6FF", color: "#1D4ED8" },
];

function ContactTypePill({
  contactType,
  onChange,
}: {
  contactType: ContactType;
  onChange: (ct: ContactType) => void;
}) {
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
        <div className="flex items-center gap-1 pl-1 pr-2.5 py-0.5 rounded-full text-[11px] font-medium pointer-events-none select-none whitespace-nowrap bg-navy/[0.05] text-navy/30">
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


function CategoryPill({
  category,
  categories,
  onChange,
}: {
  category: string;
  categories: Category[];
  onChange: (cat: string) => void;
}) {
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
  const cfg = cat
    ? { emoji: cat.emoji, bg: cat.bg_color, color: cat.text_color }
    : CAT_FALLBACK;
  const label = cat?.label ?? category;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full text-xs font-medium whitespace-nowrap hover:brightness-95 transition-all"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        <span className="text-sm leading-none">{cfg.emoji}</span>
        <span>{label}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-navy/10 rounded-xl shadow-xl overflow-y-auto py-1"
          style={{ minWidth: "11rem", maxHeight: "13rem" }}>
          {categories.map((c) => {
            const cCfg = { emoji: c.emoji, bg: c.bg_color, color: c.text_color };
            return (
              <button
                key={c.value}
                onClick={() => { onChange(c.value); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-navy/[0.04] transition-colors ${c.value === category ? "font-semibold" : ""}`}
                style={{ color: cCfg.color }}
              >
                <span className="text-sm leading-none w-5 text-center">{cCfg.emoji}</span>
                <span className="text-navy/70">{c.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Props = {
  transactions: Transaction[];
  categories: Category[];
  uncategorizedCount: number;
  recurringContacts: string[];
  anomalies: Anomaly[];
};

export default function TransaccionesList({
  transactions,
  categories,
  uncategorizedCount,
  recurringContacts,
  anomalies,
}: Props) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState(() => searchParams.get("categoria") ?? "all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<ContactType | "all">("all");

  // Sync if URL param changes after mount (e.g. navigation)
  useEffect(() => {
    const cat = searchParams.get("categoria");
    if (cat) setCatFilter(cat);
  }, [searchParams]);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState("");
  const [isPending, startTransition] = useTransition();

  const recurringSet = new Set(recurringContacts);

  const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))]
    .sort()
    .reverse();

  const filtered = transactions.filter((t) => {
    const q = search.toLowerCase();
    if (q && !t.contact?.toLowerCase().includes(q) && !t.concept?.toLowerCase().includes(q)) return false;
    if (catFilter !== "all" && t.category !== catFilter) return false;
    if (monthFilter !== "all" && !t.date.startsWith(monthFilter)) return false;
    if (typeFilter !== "all" && t.contact_type !== typeFilter) return false;
    return true;
  });

  const totalIn  = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  // Selection helpers
  const allFilteredIds = filtered.map((t) => t.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allFilteredIds));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setBulkCat("");
  }

  function applyBulkCategory() {
    if (!bulkCat) return;
    const ids = [...selected];
    startTransition(async () => {
      await Promise.all(ids.map((id) => updateTransactionCategory(id, bulkCat)));
    });
    clearSelection();
  }

  function handleCategoryChange(id: string, category: string) {
    startTransition(() => updateTransactionCategory(id, category));
  }

  function handleContactTypeChange(id: string, ct: ContactType) {
    startTransition(() => updateTransactionContactType(id, ct));
  }

  // Resumen por contacto cuando se filtra por tipo
  const contactSummary = typeFilter !== "all"
    ? Object.values(
        filtered
          .filter((t) => t.amount < 0 && t.contact)
          .reduce<Record<string, { name: string; total: number; count: number }>>((acc, t) => {
            const key = t.contact!;
            if (!acc[key]) acc[key] = { name: key, total: 0, count: 0 };
            acc[key].total += Math.abs(t.amount);
            acc[key].count++;
            return acc;
          }, {})
      ).sort((a, b) => b.total - a.total)
    : [];

  function openNotes(t: Transaction) {
    setEditingNotes(t.id);
    setNotesValue(t.notes ?? "");
  }

  function saveNotes(id: string) {
    startTransition(() => updateTransactionNotes(id, notesValue));
    setEditingNotes(null);
  }

  const hasAlerts = uncategorizedCount > 0 || anomalies.length > 0;

  return (
    <div>
      {/* ── Bandeja de alertas ───────────────────────────────────────────── */}
      {hasAlerts && (
        <div className="bg-white border border-navy/10 rounded-xl shadow-sm overflow-hidden mb-5">
          {/* Sin categorizar */}
          {uncategorizedCount > 0 && (
            <button
              onClick={() => setCatFilter(catFilter === "Otros" ? "all" : "Otros")}
              className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors border-l-[3px] ${
                catFilter === "Otros"
                  ? "border-l-amber-400 bg-amber-50/70"
                  : "border-l-amber-300 bg-white hover:bg-amber-50/40"
              } ${anomalies.length > 0 ? "border-b border-navy/[0.06]" : ""}`}
            >
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-sm">
                ⚠
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  {uncategorizedCount} movimiento{uncategorizedCount !== 1 ? "s" : ""} sin categorizar
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {catFilter === "Otros"
                    ? "Mostrando ahora — click para ver todos"
                    : "Revisar categoría para un análisis preciso"}
                </p>
              </div>
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full shrink-0">
                {catFilter === "Otros" ? "Activo" : "Filtrar"}
              </span>
            </button>
          )}

          {/* Anomalías — una fila por categoría */}
          {anomalies.map((a, i) => {
            const up = a.deviationPct > 0;
            const severe = Math.abs(a.deviationPct) > 50;
            const isLast = i === anomalies.length - 1;
            const accentColor = up
              ? severe ? "border-l-red-400 bg-white hover:bg-red-50/30" : "border-l-amber-300 bg-white hover:bg-amber-50/30"
              : "border-l-emerald-400 bg-white hover:bg-emerald-50/30";
            const iconBg = up
              ? severe ? "bg-red-100" : "bg-amber-100"
              : "bg-emerald-100";
            const textColor = up
              ? severe ? "text-red-700" : "text-amber-700"
              : "text-emerald-700";
            const subColor = up
              ? severe ? "text-red-500" : "text-amber-500"
              : "text-emerald-500";
            const isActive = catFilter === a.category;
            return (
              <button
                key={a.category}
                onClick={() => setCatFilter(isActive ? "all" : a.category)}
                className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors border-l-[3px] ${accentColor} ${isActive ? "opacity-80 ring-inset ring-1 ring-navy/5" : ""} ${!isLast ? "border-b border-navy/[0.06]" : ""}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${iconBg} ${textColor}`}>
                  {up ? "↑" : "↓"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${textColor}`}>
                    {a.category} {up ? "por encima" : "por debajo"} de la media
                  </p>
                  <p className={`text-xs mt-0.5 ${subColor}`}>
                    {fmtAmt(a.currentAmount)} en {fmtMonth(a.currentMonth)} · media {fmtAmt(a.avgAmount)}
                  </p>
                </div>
                <span className={`text-xs font-bold tabular-nums ${textColor} bg-current/10 px-3 py-1 rounded-full shrink-0`}
                  style={{ backgroundColor: up ? (severe ? "#fee2e2" : "#fef3c7") : "#d1fae5" }}>
                  {up ? "+" : "−"}{Math.round(Math.abs(a.deviationPct))}%
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── 3. Barra de selección múltiple (flotante abajo) ─────────────── */}
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
          <button
            onClick={clearSelection}
            className="text-sm text-white/50 hover:text-white/80 transition-colors px-1 shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 4. Filtros ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar concepto o contacto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:flex-1 text-sm border border-navy/10 rounded-lg px-3 py-2 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 bg-white"
        />
        <div className="grid grid-cols-3 sm:contents gap-2">
          <select
            value={typeFilter ?? "all"}
            onChange={(e) => setTypeFilter(e.target.value === "all" ? "all" : e.target.value as ContactType)}
            className="text-sm border border-navy/10 rounded-lg px-2 sm:px-3 py-2 bg-white outline-none focus:border-primary/40 text-navy min-w-0"
          >
            <option value="all">Tipos</option>
            {CONTACT_TYPES.map((c) => (
              <option key={c.value} value={c.value ?? ""}>{c.emoji} {c.label}</option>
            ))}
          </select>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="text-sm border border-navy/10 rounded-lg px-2 sm:px-3 py-2 bg-white outline-none focus:border-primary/40 text-navy min-w-0"
          >
            <option value="all">Categoría</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="text-sm border border-navy/10 rounded-lg px-2 sm:px-3 py-2 bg-white outline-none focus:border-primary/40 text-navy min-w-0"
          >
            <option value="all">Mes</option>
            {months.map((m) => {
              const [y, mm] = m.split("-");
              return (
                <option key={m} value={m}>{MONTH_NAMES[mm]} {y}</option>
              );
            })}
          </select>
        </div>
      </div>

      {/* ── Resumen por contacto (cuando hay filtro de tipo activo) ──────── */}
      {contactSummary.length > 1 && (
        <div className="bg-white border border-navy/10 rounded-xl shadow-sm p-4 mb-4">
          <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-3">
            Desglose por persona · {CONTACT_TYPES.find(c => c.value === typeFilter)?.label}
          </p>
          <div className="space-y-2">
            {contactSummary.map((r) => {
              const maxTotal = contactSummary[0].total;
              return (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="text-sm text-navy truncate w-48 shrink-0">{r.name}</span>
                  <div className="flex-1 h-1.5 bg-navy/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/40 rounded-full" style={{ width: `${(r.total / maxTotal) * 100}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-navy tabular-nums shrink-0">−{fmtAmt(r.total)}</span>
                  <span className="text-xs text-navy/30 w-16 text-right tabular-nums shrink-0">{r.count} pagos</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. Barra de resumen ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-navy/40">
          {filtered.length} transacciones
        </span>
        {isPending && <span className="text-xs text-primary/60">Guardando…</span>}
        <div className="flex-1" />
        <span className="text-sm font-semibold text-emerald-600 tabular-nums">
          +{fmtAmt(totalIn)}
        </span>
        <span className="text-xs text-navy/20">·</span>
        <span className="text-sm font-semibold text-navy/50 tabular-nums">
          −{fmtAmt(totalOut)}
        </span>
      </div>

      {/* ── 6. Vista móvil (cards) ───────────────────────────────────────── */}
      <div className="sm:hidden bg-white border border-navy/10 rounded-xl shadow-sm overflow-hidden divide-y divide-navy/[0.04]">
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-navy/30">Sin resultados</p>
        )}
        {filtered.map((t) => {
          const isRecurring = !!t.contact && recurringSet.has(t.contact.toLowerCase().trim());
          const isSelected  = selected.has(t.id);
          const primary     = t.contact || t.concept || "—";
          const secondary   = t.contact && t.concept && t.concept !== t.contact ? t.concept : null;
          return (
            <div
              key={t.id}
              className={`px-4 py-3 transition-colors ${isSelected ? "bg-primary/[0.035]" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOne(t.id)}
                    className="shrink-0 rounded border-navy/20 accent-primary cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-medium text-navy truncate">{primary}</span>
                      {isRecurring && (
                        <span className="shrink-0 text-[10px] text-primary/50 font-medium">↺</span>
                      )}
                    </div>
                    {secondary && <p className="text-[11px] text-navy/30 truncate mt-0.5">{secondary}</p>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-sm font-semibold tabular-nums ${t.amount > 0 ? "text-emerald-600" : "text-navy/75"}`}>
                    {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                  </span>
                  <p className="text-[11px] text-navy/35 tabular-nums mt-0.5">{fmtDate(t.date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <CategoryPill
                  category={t.category}
                  categories={categories}
                  onChange={(cat) => handleCategoryChange(t.id, cat)}
                />
                <ContactTypePill
                  contactType={t.contact_type}
                  onChange={(ct) => handleContactTypeChange(t.id, ct)}
                />
                {editingNotes === t.id ? (
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      autoFocus
                      type="text"
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveNotes(t.id);
                        if (e.key === "Escape") setEditingNotes(null);
                      }}
                      className="text-xs border border-primary/30 rounded px-2 py-1 outline-none w-28"
                      placeholder="Nota…"
                    />
                    <button onClick={() => saveNotes(t.id)} className="text-xs text-primary font-bold">✓</button>
                    <button onClick={() => setEditingNotes(null)} className="text-xs text-navy/25">✕</button>
                  </div>
                ) : t.notes ? (
                  <button
                    onClick={() => openNotes(t)}
                    className="ml-auto text-xs text-navy/40 hover:text-navy/60 truncate max-w-[120px]"
                  >
                    {t.notes}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 6. Tabla (desktop) ───────────────────────────────────────────── */}
      <div className="hidden sm:block bg-white border border-navy/10 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "40px" }} />   {/* checkbox */}
            <col />                              {/* concepto — flex */}
            <col style={{ width: "168px" }} />  {/* categoría */}
            <col style={{ width: "180px" }} />  {/* notas */}
            <col style={{ width: "108px" }} />  {/* fecha */}
            <col style={{ width: "120px" }} />  {/* importe */}
          </colgroup>

          <thead>
            <tr className="border-b border-navy/5 bg-navy/[0.015]">
              <th className="pl-4 py-3 align-middle">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="block rounded border-navy/20 accent-primary cursor-pointer"
                  aria-label="Seleccionar todas"
                />
              </th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider">Concepto</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider">Categoría</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider">Notas</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider">Fecha</th>
              <th className="text-right pr-5 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider">Importe</th>
            </tr>
          </thead>

          <tbody className={isPending ? "opacity-50 pointer-events-none" : ""}>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-navy/30">
                  Sin resultados
                </td>
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
                    isSelected ? "bg-primary/[0.035]" : "hover:bg-navy/[0.012]"
                  }`}
                >
                  {/* Checkbox */}
                  <td className="pl-4 align-middle" style={{ height: "52px" }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(t.id)}
                      className="block rounded border-navy/20 accent-primary cursor-pointer"
                    />
                  </td>

                  {/* Concept */}
                  <td className="px-4 align-middle overflow-hidden" style={{ height: "52px" }}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-medium text-navy truncate leading-snug">
                        {primary}
                      </span>
                      {isRecurring && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-primary/50 font-medium leading-none">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                          </svg>
                          mensual
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {secondary && (
                        <p className="text-[11px] text-navy/30 truncate leading-none">{secondary}</p>
                      )}
                      <ContactTypePill
                        contactType={t.contact_type}
                        onChange={(ct) => handleContactTypeChange(t.id, ct)}
                      />
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-4 align-middle" style={{ height: "52px" }}>
                    <CategoryPill
                      category={t.category}
                      categories={categories}
                      onChange={(cat) => handleCategoryChange(t.id, cat)}
                    />
                  </td>

                  {/* Notes */}
                  <td className="px-4 align-middle overflow-hidden" style={{ height: "52px" }}>
                    {editingNotes === t.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          type="text"
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveNotes(t.id);
                            if (e.key === "Escape") setEditingNotes(null);
                          }}
                          className="text-xs border border-primary/30 rounded px-2 py-1 outline-none focus:border-primary/60 w-28 leading-none"
                          placeholder="Añadir nota…"
                        />
                        <button onClick={() => saveNotes(t.id)} className="text-xs text-primary font-bold px-1 hover:text-primary/70 leading-none">✓</button>
                        <button onClick={() => setEditingNotes(null)} className="text-xs text-navy/25 hover:text-navy/50 leading-none">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openNotes(t)}
                        className="w-full text-left text-xs truncate block leading-none"
                      >
                        {t.notes
                          ? <span className="text-navy/45 hover:text-navy/65 transition-colors">{t.notes}</span>
                          : <span className="text-navy/20 opacity-0 group-hover:opacity-100 transition-opacity">+ nota</span>
                        }
                      </button>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-4 align-middle text-right" style={{ height: "52px" }}>
                    <span className="text-xs text-navy/35 tabular-nums whitespace-nowrap">
                      {fmtDate(t.date)}
                    </span>
                  </td>

                  {/* Amount */}
                  <td className="pr-5 pl-2 align-middle text-right" style={{ height: "52px" }}>
                    <span className={`text-sm font-semibold tabular-nums ${t.amount > 0 ? "text-emerald-600" : "text-navy/75"}`}>
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
