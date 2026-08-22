"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Users, Clock, AlertTriangle, Package } from "react-feather";
import Avatar from "@/app/components/Avatar";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import ClearFiltersButtonV2 from "@/app/components/v2/ClearFiltersButtonV2";
import { IconButtonV2 } from "@/app/components/v2/ButtonsV2";
import { InfoDot } from "@/components/charts";
import { tableHeadClassV2, tableRowClassV2, tableCardClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { normalizeText } from "@/lib/normalizeText";
import { drawerNav } from "@/lib/drawerNav";
import { fmt } from "@/lib/analytics";
import { initials, fmtDate, timeAgo } from "./ClientesTable";
import MemberDrawer from "./MemberDrawer";
import type { MemberClient, StatusTone } from "@/lib/memberClientsV2";
import type { StripePayment } from "@/lib/stripePayments";

// <div role="button"> en vez de <button>: adentro va InfoDot, que ya monta su propio <button>
// - un <button> real no puede contener otro <button> (HTML inválido), y React lo detectaba como
// error de hidratación porque el navegador reordena el DOM al parsear el HTML mal anidado.
function StatBox({ icon, label, value, valueClassName, dotClassName, tooltip, onClick, active }: {
  icon: ReactNode; label: string; value: ReactNode; valueClassName?: string; dotClassName?: string; tooltip: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={`w-full text-left bg-card border rounded-[14px] px-3.5 py-3 transition-colors ${
        active ? "border-navy/40" : "border-border"
      } ${onClick ? "hover:bg-navy/[0.015] cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-navy/50 mb-1.5">
        {dotClassName && <span className={`shrink-0 w-[7px] h-[7px] rounded-full ${dotClassName}`} />}
        {icon}
        <span className="text-[12.5px] font-medium">{label}</span>
        <InfoDot text={tooltip} />
      </div>
      <span className={`text-2xl font-medium leading-tight tabular-nums ${valueClassName ?? "text-navy"}`}>{value}</span>
    </div>
  );
}

const COLS = "2.1fr 1.05fr .85fr 1.3fr .55fr .95fr .9fr .9fr .8fr";
const PAGE_SIZE = 100;

// Filtros "especiales" restantes (KPIs + Más filtros): de un solo valor a la vez, porque son
// alertas puntuales o etiquetas, no ejes de navegación habituales. El resto de ejes (procedencia,
// plan, última clase) viven en su propio estado independiente más abajo, para poder combinarlos
// entre sí (p.ej. "Urban" + "Bàsic" a la vez).
type Filter =
  | "all" | "duplicadas" | "pago_pendiente" | "renueva_pronto" | "familiares"
  | "congelada" | "infrautiliza" | "al_limite" | "pocas_clases";
type Procedencia = "momence" | "urban";
type PlanFilter = "all" | "basic" | "plus" | "pro" | "pack" | "sin_plan";
// "Clientes" (el KPI) sigue siendo el censo completo de Momence tal cual - esto es solo una
// forma de aislar a quien nunca ha pisado el estudio (reservó y canceló, o nunca reservó) sin
// redefinir qué cuenta como cliente.
type Asistencia = "all" | "con_clases" | "sin_clases";
type CancelTardia = "all" | "con_tardias" | "sin_tardias";
type SortKey = "name" | "attended" | "cancellations" | "totalSpent" | "firstClass" | "lastClass" | "renew";

// Mismo criterio que planBadge() (abajo) para que el filtro y la insignia de la tabla coincidan
// siempre. Urban no tiene hueco aquí a propósito: es procedencia, no plan (ver Procedencia).
function planTier(plan: MemberClient["plan"]): PlanFilter | "urban" {
  if (!plan) return "sin_plan";
  if (plan.kind === "urban") return "urban";
  if (plan.kind === "pack") return "pack";
  const n = plan.name.toLowerCase();
  if (n.includes("plus")) return "plus";
  if (n.includes("pro")) return "pro";
  return "basic";
}

// Días desde la última clase asistida (mismo dato que la columna "Última clase" de la tabla),
// para poder filtrar por un rango en vez de solo mirarlo fila a fila.
function daysSinceLastClass(r: MemberClient): number | null {
  if (!r.lastClassDate) return null;
  return Math.floor((Date.now() - new Date(r.lastClassDate).getTime()) / 86_400_000);
}
// Tope del slider de "Última clase" - en el extremo derecho equivale a "sin máximo" (no hay
// forma de arrastrar hasta "infinito", así que el último escalón hace ese papel).
const LAST_CLASS_MAX = 180;

/** Slider de rango doble (mín. y máx.) hecho con dos <input type="range"> superpuestos - truco
 * habitual sin librería: cada uno es transparente y solo su tirador (::-webkit-slider-thumb)
 * capta el puntero, así el carril deja pasar el clic al tirador que esté debajo y ambos se
 * pueden arrastrar por separado aunque compartan el mismo espacio. */
function DualRangeSlider({ min, max, step = 5, valueMin, valueMax, onChangeMin, onChangeMax }: {
  min: number; max: number; step?: number;
  valueMin: number; valueMax: number;
  onChangeMin: (v: number) => void; onChangeMax: (v: number) => void;
}) {
  const pctMin = ((valueMin - min) / (max - min)) * 100;
  const pctMax = ((valueMax - min) / (max - min)) * 100;
  const thumbCls =
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-[16px] [&::-webkit-slider-thumb]:h-[16px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-navy [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-card [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer " +
    "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-[16px] [&::-moz-range-thumb]:h-[16px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-navy [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-card [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer " +
    "[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent";
  return (
    <div className="relative w-full h-[16px] flex items-center">
      <div className="absolute inset-x-0 h-[3px] rounded-full bg-navy/15" />
      <div className="absolute h-[3px] rounded-full bg-navy" style={{ left: `${pctMin}%`, right: `${100 - pctMax}%` }} />
      <input
        type="range" min={min} max={max} step={step} value={valueMin}
        onChange={(e) => onChangeMin(Math.min(Number(e.target.value), valueMax))}
        className={`absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none z-20 ${thumbCls}`}
      />
      <input
        type="range" min={min} max={max} step={step} value={valueMax}
        onChange={(e) => onChangeMax(Math.max(Number(e.target.value), valueMin))}
        className={`absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none z-10 ${thumbCls}`}
      />
    </div>
  );
}

// "Sin pago" (asistió sin rastro de cobro) y "Error de pago" (Stripe) son dos síntomas del
// mismo problema de fondo - se muestran fusionados en un único KPI/filtro para no duplicar.
const hasPagoPendiente = (r: MemberClient) => (r.coverage === "none" && r.attended > 0) || r.status.key === "error_pago";

const TONE_CLS: Record<StatusTone, string> = {
  success: "bg-card border border-border text-navy/70",
  warning: "bg-card border border-border text-navy/70",
  danger: "bg-card border border-border text-navy/70",
  muted: "bg-card border border-border text-navy/50",
};
const TONE_DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-[#b45309] dark:bg-[#e8a572]",
  danger: "bg-danger",
  muted: "bg-navy/30",
};

function planBadge(plan: MemberClient["plan"]): { label: string; cls: string } {
  if (!plan) return { label: "Sin plan", cls: "bg-navy/[0.05] text-navy/50" };
  if (plan.kind === "urban") return { label: "Urban", cls: "bg-[#3b82f6]/10 text-[#3b82f6]" };
  const n = plan.name.toLowerCase();
  if (plan.kind === "subscription") {
    if (n.includes("bàsic") || n.includes("basic")) return { label: plan.name, cls: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400" };
    if (n.includes("plus")) return { label: plan.name, cls: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" };
    if (n.includes("pro")) return { label: plan.name, cls: "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400" };
    return { label: plan.name, cls: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400" };
  }
  return { label: plan.name, cls: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400" };
}

// Días hasta la renovación/caducidad del plan (endDate). null si no aplica.
function daysToRenew(r: MemberClient): number | null {
  if (!r.plan?.endDate) return null;
  return Math.ceil((new Date(r.plan.endDate).getTime() - Date.now()) / 86_400_000);
}
const renewsSoon = (r: MemberClient) => { const d = daysToRenew(r); return d != null && d >= 0 && d <= 14; };

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={`inline-block ml-1 transition-all ${active ? "opacity-100 text-muted" : "opacity-0"} ${active && dir === "desc" ? "" : "rotate-180"}`}>
      <path d="M6 10l6 6 6-6" />
    </svg>
  );
}

/** Filtros secundarios (menos urgentes que los KPI o el tipo de plan): oportunidades de venta
 * y una etiqueta manual, agrupados aparte para no competir por espacio con lo prioritario. */
function MoreFiltersMenu({ filter, onChange, counts }: {
  filter: Filter;
  onChange: (f: Filter) => void;
  counts: { al_limite: number; infrautiliza: number; congelada: number; duplicadas: number; familiares: number };
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const DROP_W = 220;
  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      // Ancla el desplegable al borde derecho del botón (no al izquierdo) para que no se salga
      // de la pantalla cuando el botón está cerca del borde derecho de la barra de filtros.
      setDropPos({ top: rect.bottom + 4, left: rect.right - DROP_W });
    }
    setOpen((v) => !v);
  }

  const items: { key: Filter; label: string; count: number }[] = [
    { key: "al_limite", label: "Posible upsell", count: counts.al_limite },
    { key: "infrautiliza", label: "Infrautiliza plan", count: counts.infrautiliza },
    { key: "congelada", label: "Congeladas", count: counts.congelada },
    { key: "familiares", label: "Familiares", count: counts.familiares },
    { key: "duplicadas", label: "2+ suscripciones", count: counts.duplicadas },
  ];
  const hasActive = items.some((i) => i.key === filter);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        title="Más filtros"
        className={`shrink-0 flex items-center gap-2 px-3 py-2 text-[13.5px] font-medium border rounded-[10px] transition-colors whitespace-nowrap ${
          hasActive ? "border-primary/40 text-primary bg-primary/5" : "text-navy/70 border-border bg-card hover:bg-navy/[0.02]"
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span className="hidden sm:inline">Más filtros</span>
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed z-[9999] bg-card border border-navy/10 rounded-xl shadow-xl py-1"
          style={{ top: dropPos.top, left: dropPos.left, width: `${DROP_W}px` }}
        >
          {items.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => { onChange(filter === key ? "all" : key); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors ${
                filter === key ? "text-navy font-medium bg-navy/[0.04]" : "text-navy/60 hover:bg-navy/[0.04]"
              }`}
            >
              {label}
              {count > 0 && <span className="text-[11px] font-semibold text-[#b45309] dark:text-[#e8a572]">{count}</span>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function ClientesEstado({ clients, payments }: { clients: MemberClient[]; payments: StripePayment[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [procedencia, setProcedencia] = useState<Procedencia>("momence");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [asistencia, setAsistencia] = useState<Asistencia>("all");
  const [cancelTardia, setCancelTardia] = useState<CancelTardia>("all");
  const [minLastClassDays, setMinLastClassDays] = useState(0);
  const [maxLastClassDays, setMaxLastClassDays] = useState(LAST_CLASS_MAX);
  const [sortKey, setSortKey] = useState<SortKey>("lastClass");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<MemberClient | null>(null);

  const counts = useMemo(() => {
    const c = {
      congelada: 0, pago_pendiente: 0, duplicadas: 0, familiares: 0, urban: 0, momence: 0,
      renueva_pronto: 0, infrautiliza: 0, al_limite: 0, pocas_clases: 0,
      basic: 0, plus: 0, pro: 0, pack: 0, sinPlan: 0, sinClases: 0, conTardias: 0,
    };
    for (const r of clients) {
      if (r.activeSubCount >= 2) c.duplicadas++;
      if (r.isFamily) c.familiares++;
      if (hasPagoPendiente(r)) c.pago_pendiente++;
      if (renewsSoon(r)) c.renueva_pronto++;
      if (r.attended === 0) c.sinClases++;
      if (r.lateCancellations > 0) c.conTardias++;
      if (r.planUsage?.level === "bajo") c.infrautiliza++;
      else if (r.planUsage?.level === "alto") c.al_limite++;
      if (r.status.key === "pack_bajo") c.pocas_clases++;
      if (r.status.key === "congelada") c.congelada++;
      if (r.status.key === "urban") c.urban++; else c.momence++;
      const tier = planTier(r.plan);
      if (tier === "basic") c.basic++;
      else if (tier === "plus") c.plus++;
      else if (tier === "pro") c.pro++;
      else if (tier === "pack") c.pack++;
      else if (tier === "sin_plan") c.sinPlan++;
    }
    return c;
  }, [clients]);

  const minLastClassDaysNum = minLastClassDays > 0 ? minLastClassDays : null;
  const maxLastClassDaysNum = maxLastClassDays < LAST_CLASS_MAX ? maxLastClassDays : null;

  const hasActiveFilters =
    filter !== "all" || planFilter !== "all" || asistencia !== "all" ||
    cancelTardia !== "all" || minLastClassDaysNum != null || maxLastClassDaysNum != null;

  const filtered = useMemo(() => {
    const q = normalizeText(search.trim());
    return clients
      .filter((r) => {
        if (procedencia === "urban") { if (r.status.key !== "urban") return false; }
        else if (procedencia === "momence") { if (r.status.key === "urban") return false; }
        if (planFilter !== "all") { if (planTier(r.plan) !== planFilter) return false; }
        if (asistencia === "con_clases") { if (r.attended === 0) return false; }
        else if (asistencia === "sin_clases") { if (r.attended > 0) return false; }
        if (cancelTardia === "con_tardias") { if (r.lateCancellations === 0) return false; }
        else if (cancelTardia === "sin_tardias") { if (r.lateCancellations > 0) return false; }
        if (minLastClassDaysNum != null || maxLastClassDaysNum != null) {
          const d = daysSinceLastClass(r);
          if (d === null) {
            // Nunca ha venido a clase: cuenta como "hace muchísimo" (cumple cualquier mínimo),
            // pero no se puede afirmar que caiga dentro de un máximo concreto.
            if (maxLastClassDaysNum != null) return false;
          } else {
            if (minLastClassDaysNum != null && d < minLastClassDaysNum) return false;
            if (maxLastClassDaysNum != null && d > maxLastClassDaysNum) return false;
          }
        }
        if (filter === "duplicadas") { if (r.activeSubCount < 2) return false; }
        else if (filter === "pago_pendiente") { if (!hasPagoPendiente(r)) return false; }
        else if (filter === "renueva_pronto") { if (!renewsSoon(r)) return false; }
        else if (filter === "familiares") { if (!r.isFamily) return false; }
        else if (filter === "infrautiliza") { if (r.planUsage?.level !== "bajo") return false; }
        else if (filter === "al_limite") { if (r.planUsage?.level !== "alto") return false; }
        else if (filter === "pocas_clases") { if (r.status.key !== "pack_bajo") return false; }
        else if (filter === "congelada") { if (r.status.key !== "congelada") return false; }
        if (!q) return true;
        return normalizeText(`${r.name} ${r.email ?? ""} ${r.plan?.name ?? ""}`).includes(q);
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortKey === "totalSpent") diff = (a.stripe?.totalSpent ?? a.urbanEstimated ?? 0) - (b.stripe?.totalSpent ?? b.urbanEstimated ?? 0);
        else if (sortKey === "attended") diff = a.attended - b.attended;
        else if (sortKey === "cancellations") diff = a.cancellations - b.cancellations;
        else if (sortKey === "renew") diff = (daysToRenew(a) ?? Infinity) - (daysToRenew(b) ?? Infinity);
        else if (sortKey === "firstClass") diff = (a.firstClassDate ?? "").localeCompare(b.firstClassDate ?? "");
        else if (sortKey === "lastClass") diff = (a.lastClassDate ?? "").localeCompare(b.lastClassDate ?? "");
        else diff = a.name.localeCompare(b.name, "es");
        return sortDir === "desc" ? -diff : diff;
      });
  }, [clients, search, filter, procedencia, planFilter, asistencia, cancelTardia, minLastClassDaysNum, maxLastClassDaysNum, sortKey, sortDir]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setSortDir("desc"); }
  }
  function changeFilter(f: Filter) { setFilter(f); setPage(0); }
  function changeSearch(v: string) { setSearch(v); setPage(0); }
  function toggleBox(f: Filter) { setFilter((cur) => (cur === f ? "all" : f)); setPage(0); }
  function changeProcedencia(v: Procedencia) {
    setProcedencia(v);
    if (v === "urban") setPlanFilter("all"); // el filtro de Plan de Momence no aplica a Urban
    setPage(0);
  }
  function changePlanFilter(v: PlanFilter) { setPlanFilter(v); setPage(0); }
  function changeAsistencia(v: Asistencia) { setAsistencia(v); setPage(0); }
  function changeCancelTardia(v: CancelTardia) { setCancelTardia(v); setPage(0); }
  function changeMinLastClassDays(v: number) { setMinLastClassDays(v); setPage(0); }
  function changeMaxLastClassDays(v: number) { setMaxLastClassDays(v); setPage(0); }
  function clearFilters() {
    setFilter("all"); setPlanFilter("all"); setAsistencia("all"); setCancelTardia("all");
    setMinLastClassDays(0); setMaxLastClassDays(LAST_CLASS_MAX);
    setPage(0);
  }

  function downloadCsv() {
    const head = ["Nombre", "Email", "Teléfono", "Plan", "Renueva", "Estado", "Detalle", "Clases", "Cancelaciones", "No-shows", "Primera clase", "Última clase", "Total pagado (€)", "Uso del plan"];
    const rows = filtered.map((r) => [
      r.name, r.email ?? "", r.phone ?? "",
      r.plan?.name ?? "Sin plan", r.plan?.endDate ? r.plan.endDate.slice(0, 10) : "",
      r.status.label, r.status.detail ?? "",
      String(r.attended), String(r.cancellations), String(r.noShows),
      r.firstClassDate ?? "", r.lastClassDate ?? "",
      r.stripe ? String(Math.round(r.stripe.totalSpent)) : r.urbanEstimated != null ? `~${Math.round(r.urbanEstimated)}` : "",
      r.planUsage ? `${r.planUsage.attended}/${r.planUsage.limit} (${r.planUsage.level})` : "",
    ]);
    const csv = [head, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = "clientes.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* KPIs en caja (clic → filtra la tabla) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatBox
          icon={<Users size={14} />} label="Clientes" value={clients.length}
          tooltip="Total de clientes del censo de Momence (incluye efectivo y Urban)."
          onClick={clearFilters} active={!hasActiveFilters}
        />
        <StatBox
          icon={<Clock size={14} />} label="Renuevan pronto" value={counts.renueva_pronto}
          valueClassName={counts.renueva_pronto > 0 ? "text-[#b45309] dark:text-[#e8a572]" : "text-navy/50"}
          dotClassName={counts.renueva_pronto > 0 ? "bg-[#b45309] dark:bg-[#e8a572]" : undefined}
          tooltip="Suscripción o pack que caduca en 14 días o menos. Momento clave para retener."
          onClick={() => toggleBox("renueva_pronto")} active={filter === "renueva_pronto"}
        />
        <StatBox
          icon={<AlertTriangle size={14} />} label="Pago pendiente" value={counts.pago_pendiente}
          valueClassName={counts.pago_pendiente > 0 ? "text-[#b45309] dark:text-[#e8a572]" : "text-navy/50"}
          dotClassName={counts.pago_pendiente > 0 ? "bg-[#b45309] dark:bg-[#e8a572]" : undefined}
          tooltip="Asistieron a clase sin rastro de pago, o su último cobro falló en Stripe. Revisa antes de actuar (efectivo no se detecta)."
          onClick={() => toggleBox("pago_pendiente")} active={filter === "pago_pendiente"}
        />
        <StatBox
          icon={<Package size={14} />} label="Pocas clases" value={counts.pocas_clases}
          valueClassName={counts.pocas_clases > 0 ? "text-[#b45309] dark:text-[#e8a572]" : "text-navy/50"}
          dotClassName={counts.pocas_clases > 0 ? "bg-[#b45309] dark:bg-[#e8a572]" : undefined}
          tooltip="Le quedan 2 clases o menos en su pack — momento de ofrecerle renovarlo antes de que se quede sin crédito."
          onClick={() => toggleBox("pocas_clases")} active={filter === "pocas_clases"}
        />
      </div>

      <div className="flex items-center gap-[9px] flex-wrap">
        <SearchInputV2 value={search} onChange={changeSearch} placeholder="Buscar por nombre, email o plan…" className="min-w-[160px] flex-1" />
        <MoreFiltersMenu filter={filter} onChange={changeFilter} counts={counts} />
        {hasActiveFilters && <ClearFiltersButtonV2 onClick={clearFilters} />}
        <IconButtonV2 onClick={downloadCsv} title="Exportar a CSV">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v10M8 11l4 4 4-4M5 19h14" />
          </svg>
        </IconButtonV2>
        <FilterPillGroupV2
          variant="segmented"
          active={procedencia}
          onChange={changeProcedencia}
          options={[
            { key: "momence", label: "Momence" },
            { key: "urban", label: "Urban" },
          ]}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {procedencia === "momence" && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-navy/40 uppercase tracking-wider shrink-0">Plan</span>
          <FilterPillGroupV2
            variant="segmented"
            active={planFilter}
            onChange={changePlanFilter}
            options={[
              { key: "all", label: "Todos" },
              { key: "basic", label: "Bàsic", count: counts.basic || undefined },
              { key: "plus", label: "Plus", count: counts.plus || undefined },
              { key: "pro", label: "Pro", count: counts.pro || undefined },
              { key: "pack", label: "Pack", count: counts.pack || undefined },
              { key: "sin_plan", label: "Sin plan", count: counts.sinPlan || undefined, countTone: "warning" },
            ]}
          />
        </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-navy/40 uppercase tracking-wider shrink-0">Asistencia</span>
          <FilterPillGroupV2
            variant="segmented"
            active={asistencia}
            onChange={changeAsistencia}
            options={[
              { key: "all", label: "Todos" },
              { key: "con_clases", label: "Ha venido" },
              { key: "sin_clases", label: "Nunca vino", count: counts.sinClases || undefined, countTone: "warning" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-navy/40 uppercase tracking-wider shrink-0">Cancel. tardías</span>
          <FilterPillGroupV2
            variant="segmented"
            active={cancelTardia}
            onChange={changeCancelTardia}
            options={[
              { key: "all", label: "Todos" },
              { key: "con_tardias", label: "Con tardías", count: counts.conTardias || undefined, countTone: "warning" },
              { key: "sin_tardias", label: "Sin tardías" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-navy/40 uppercase tracking-wider shrink-0">Última clase</span>
          <div className="flex items-center gap-2 bg-navy/5 rounded-[10px] px-2.5 py-1.5">
            <span className="text-[12px] font-medium text-navy tabular-nums shrink-0 w-5 text-right">
              {minLastClassDays}
            </span>
            <div className="w-[110px]">
              <DualRangeSlider
                min={0}
                max={LAST_CLASS_MAX}
                step={5}
                valueMin={minLastClassDays}
                valueMax={maxLastClassDays}
                onChangeMin={changeMinLastClassDays}
                onChangeMax={changeMaxLastClassDays}
              />
            </div>
            <span className="text-[12px] font-medium text-navy tabular-nums shrink-0 w-7">
              {maxLastClassDays >= LAST_CLASS_MAX ? `${LAST_CLASS_MAX}+` : maxLastClassDays}
            </span>
          </div>
        </div>
      </div>

      <div className={`mt-[20px] -mx-4 sm:-mx-6 ${tableCardClassV2} overflow-hidden`}>
        {/* Escritorio (scroll horizontal si no caben las columnas) */}
        <div className="hidden sm:block overflow-x-auto">
          <div className="min-w-[1080px]">
            <div className={`${tableHeadClassV2} px-5`} style={gridColsV2(COLS)}>
              <span className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("name")}>Cliente<SortArrow active={sortKey === "name"} dir={sortDir} /></span>
              <span>Plan</span>
              <span className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("renew")}>Renueva<SortArrow active={sortKey === "renew"} dir={sortDir} /></span>
              <span>Estado</span>
              <span className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("attended")}>Clases<SortArrow active={sortKey === "attended"} dir={sortDir} /></span>
              <span className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("cancellations")}>Cancelac.<SortArrow active={sortKey === "cancellations"} dir={sortDir} /></span>
              <span className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("firstClass")}>1ª clase<SortArrow active={sortKey === "firstClass"} dir={sortDir} /></span>
              <span className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("lastClass")}>Última clase<SortArrow active={sortKey === "lastClass"} dir={sortDir} /></span>
              <span className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("totalSpent")}>Total<SortArrow active={sortKey === "totalSpent"} dir={sortDir} /></span>
            </div>

            {pageRows.length === 0 ? (
              <div className="py-12 px-5 text-center text-faint text-sm">No hay clientes que coincidan.</div>
            ) : (
              pageRows.map((r) => {
                const pb = planBadge(r.plan);
                const dRenew = daysToRenew(r);
                return (
                  <div key={r.id} onClick={() => setSelected(r)} className={`${tableRowClassV2} px-5 cursor-pointer`} style={gridColsV2(COLS)}>
                    <div className="flex items-center gap-[11px] min-w-0">
                      <Avatar seed={r.id} initials={initials(r.name, r.email)} size={30} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-[13px] font-semibold text-navy truncate">{r.name}</p>
                          {r.isFamily && <span className="shrink-0 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 px-[5px] py-[1px] rounded-full">Familiar</span>}
                        </div>
                        {r.email && <p className="text-[12px] text-faint truncate">{r.email}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className={`inline-block px-2 py-[3px] rounded-[8px] text-[12.5px] font-medium whitespace-nowrap ${pb.cls}`}>{pb.label}</span>
                      {r.activeSubCount >= 2 && (
                        <span title="Varias suscripciones activas a la vez — posible doble cobro." className="inline-flex items-center gap-1 px-[5px] py-[1px] rounded-full text-[11px] font-semibold bg-danger/10 text-danger whitespace-nowrap">⚠ {r.activeSubCount}</span>
                      )}
                      {r.planUsage?.level === "bajo" && (
                        <span title={`Infrautiliza el plan: ${r.planUsage.attended} de ~${r.planUsage.limit} clases en el período actual.`} className="inline-flex items-center gap-1 px-[5px] py-[1px] rounded-full text-[11px] font-semibold bg-[#b45309]/10 text-[#b45309] dark:text-[#e8a572] whitespace-nowrap">▽ {r.planUsage.attended}/{r.planUsage.limit}</span>
                      )}
                      {r.planUsage?.level === "alto" && (
                        <span title={`Al límite o por encima de su plan: ${r.planUsage.attended} de ${r.planUsage.limit} clases — candidata a subir de plan.`} className="inline-flex items-center gap-1 px-[5px] py-[1px] rounded-full text-[11px] font-semibold bg-primary/10 text-primary whitespace-nowrap">△ {r.planUsage.attended}/{r.planUsage.limit}</span>
                      )}
                    </div>
                    <div className={`text-[13px] tabular-nums ${dRenew != null && dRenew <= 14 ? "text-[#b45309] dark:text-[#e8a572] font-medium" : "text-muted"}`}>
                      {r.plan?.endDate ? fmtDate(r.plan.endDate.slice(0, 10)) : "-"}
                    </div>
                    <div className="min-w-0">
                      <span className={`inline-flex items-center gap-[7px] rounded-full px-2 py-[2px] text-[12.5px] font-medium whitespace-nowrap ${TONE_CLS[r.status.tone]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[r.status.tone]}`} />
                        {r.status.label}
                      </span>
                      {r.status.detail && <p className="text-[11px] text-faint mt-0.5 truncate">{r.status.detail}</p>}
                    </div>
                    <div className="text-[13px] text-navy tabular-nums">{r.attended}</div>
                    <div className={`text-[13px] tabular-nums ${r.cancellations > r.attended && r.cancellations > 2 ? "text-danger font-medium" : "text-muted"}`}>{r.cancellations}</div>
                    <div className="text-[13px] text-muted tabular-nums">{r.firstClassDate ? fmtDate(r.firstClassDate) : "-"}</div>
                    <div className="text-[13px] text-muted">{r.lastClassDate ? timeAgo(r.lastClassDate).replace("Hace ", "") : "-"}</div>
                    <div className="text-[13px] font-semibold text-navy tabular-nums">
                      {r.stripe
                        ? fmt(r.stripe.totalSpent)
                        : r.urbanEstimated != null
                          ? <span title="Estimado: clases asistidas × tarifa Urban vigente en la fecha de cada clase. Urban Sports Club no pasa por Stripe, así que no es un cobro real registrado.">~{fmt(r.urbanEstimated)}</span>
                          : "-"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Móvil */}
        <div className="sm:hidden">
          {pageRows.length === 0 ? (
            <div className="py-12 px-5 text-center text-faint text-sm">No hay clientes que coincidan.</div>
          ) : (
            pageRows.map((r) => {
              const pb = planBadge(r.plan);
              return (
                <div key={r.id} onClick={() => setSelected(r)} className="flex items-center gap-[10px] py-[10px] px-5 border-t border-subtle cursor-pointer active:bg-subtle">
                  <Avatar seed={r.id} initials={initials(r.name, r.email)} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-[14px] font-semibold text-navy truncate">{r.name}</p>
                      {r.isFamily && <span className="shrink-0 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 px-1 py-[1px] rounded-full">Fam</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-block px-[7px] py-[1px] rounded-[6px] text-[11px] font-medium whitespace-nowrap ${pb.cls}`}>{pb.label}</span>
                      {r.activeSubCount >= 2 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger whitespace-nowrap">⚠ {r.activeSubCount} suscr.</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted whitespace-nowrap">
                          <span className={`w-[5px] h-[5px] rounded-full shrink-0 ${TONE_DOT[r.status.tone]}`} />
                          {r.status.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-medium text-navy tabular-nums">{r.attended} clases</p>
                    <p className="text-[11px] text-faint">{r.lastClassDate ? timeAgo(r.lastClassDate).replace("Hace ", "") : "sin clases"}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <TablePaginationV2 page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {selected && (() => {
        const { prev, next } = drawerNav(filtered, selected.id, (r) => r.id);
        return (
          <MemberDrawer
            key={selected.id}
            client={selected}
            payments={payments}
            onClose={() => setSelected(null)}
            onPrev={prev ? () => setSelected(prev) : undefined}
            onNext={next ? () => setSelected(next) : undefined}
            hasPrev={!!prev}
            hasNext={!!next}
          />
        );
      })()}
    </div>
  );
}
