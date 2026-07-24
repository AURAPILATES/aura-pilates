"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import { CatIcon } from "../catIcons";

const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function fmtDayLabel(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yest  = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  if (dateStr === today) return "Hoy";
  if (dateStr === yest)  return "Ayer";
  const [, m, d] = dateStr.split("-");
  return `${parseInt(d)} de ${MONTHS_ES[parseInt(m) - 1]}`;
}

function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

const FALLBACK_COLOR = { in: "var(--color-income)", out: "var(--color-navy)" };
const FALLBACK_ICON = { in: "trending-up", out: "package" };

function bankLabel(method: string) {
  if (method === "banco") return "CaixaBank";
  if (method === "efectivo") return "Efectivo";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

function rgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type Props = {
  transactions: Transaction[];
  categories: Category[];
  uncategorizedCount: number;
  allMonthKeys: string[];
};

export default function RevolutList({ transactions, categories, uncategorizedCount, allMonthKeys }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentRange = searchParams.get("range") ?? "all";
  const customFrom = searchParams.get("from") ?? "";

  const [search, setSearch] = useState("");

  const activeMonth = useMemo(() => {
    if (currentRange === "custom" && customFrom) return customFrom.slice(0, 7);
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

  const monthStrip = allMonthKeys.map((key) => {
    const m = parseInt(key.slice(5)) - 1;
    return { key, label: MONTHS_ES[m], year: parseInt(key.slice(0, 4)) };
  });

  const filtered = transactions.filter((t) => {
    const q = search.toLowerCase();
    if (q && !t.contact?.toLowerCase().includes(q) && !t.concept?.toLowerCase().includes(q)) return false;
    return true;
  });

  const totalIn  = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const neto     = totalIn - totalOut;

  const byDay = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div>
      <div className="mb-5">
        <p className="text-[11px] font-semibold text-navy/50 uppercase tracking-[0.15em]">Movimientos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 text-center gap-1 mb-3 bg-card border border-navy/[0.08] rounded-xl py-3">
        <div className="min-w-0">
          <p className="text-[12px] text-navy/40 uppercase tracking-wider leading-none mb-0.5 whitespace-nowrap">Ingresos</p>
          <p className="text-[14px] font-semibold text-success tabular-nums truncate">{Math.round(totalIn).toLocaleString("es-ES")} €</p>
        </div>
        <div className="min-w-0">
          <p className="text-[12px] text-navy/40 uppercase tracking-wider leading-none mb-0.5 whitespace-nowrap">Gastos</p>
          <p className="text-[14px] font-semibold text-[#B85C3A] dark:text-[#cf9e8b] tabular-nums truncate">−{Math.round(totalOut).toLocaleString("es-ES")} €</p>
        </div>
        <div className="min-w-0">
          <p className="text-[12px] text-navy/40 uppercase tracking-wider leading-none mb-0.5 whitespace-nowrap">Neto</p>
          <p className={`text-[14px] font-semibold tabular-nums truncate ${neto >= 0 ? "text-navy" : "text-danger"}`}>
            {neto < 0 && "−"}{Math.round(Math.abs(neto)).toLocaleString("es-ES")} €
          </p>
        </div>
      </div>

      {/* Búsqueda + filtros */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/30" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar concepto o contacto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-navy/[0.12] rounded-lg bg-card text-navy placeholder:text-navy/35 outline-none focus:ring-2 focus:ring-primary/20 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/30 hover:text-navy/60">✕</button>
          )}
        </div>
        <button
          title="Filtros"
          className="relative shrink-0 flex items-center justify-center w-[42px] h-[42px] bg-card border border-navy/[0.12] rounded-lg text-navy"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
        </button>
        <button
          title="Más acciones"
          className="shrink-0 flex items-center justify-center w-[42px] h-[42px] text-navy/55 border border-navy/[0.12] rounded-lg bg-card"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>
          </svg>
        </button>
      </div>

      {/* Banner */}
      {uncategorizedCount > 0 && (
        <button className="w-full flex items-center gap-2 px-4 py-2.5 mb-3 rounded-xl bg-warning/10 border border-warning/20 text-navy/70 text-sm font-medium text-left">
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

      {/* Tira de meses: estilo Revolut, pills sueltas sin caja */}
      <div className="flex gap-3 overflow-x-auto scrollbar-none mb-5">
        <button
          onClick={() => router.push(pathname)}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap ${
            !activeMonth ? "bg-navy-solid text-white font-medium" : "text-navy/40 hover:text-navy/70"
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
                isActive ? "bg-navy-solid text-white font-medium" : "text-navy/40 hover:text-navy/70"
              }`}
            >
              {label}{showYear && <span className="text-[10px] ml-0.5 opacity-60">{year}</span>}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-stretch gap-2 mb-4">
        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 h-9 bg-card text-navy text-[13px] font-medium border border-navy/15 rounded-xl hover:bg-navy/[0.02] transition-colors">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Añadir movimiento
        </button>
        <button className="shrink-0 flex items-center justify-center gap-1.5 w-[124px] h-9 text-[13px] font-medium px-4 rounded-xl border bg-card text-navy border-navy/15 hover:bg-navy/[0.02] transition-colors">
          <span className="w-3.5 h-3.5 rounded-[3px] border border-navy/35 flex items-center justify-center shrink-0">
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <polyline points="1,3.5 3.5,6 8,1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-navy/35"/>
            </svg>
          </span>
          Seleccionar
        </button>
      </div>

      {/* Lista por día, icono circular sólido estilo Revolut */}
      <div className="space-y-5">
        {byDay.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/45">Sin resultados</p>
        )}
        {byDay.map(([date, dayTxns]) => {
          const dayNet = dayTxns.reduce((s, t) => s + t.amount, 0);
          return (
            <div key={date}>
              <div className="flex items-baseline justify-between mb-2 px-1">
                <span className="text-sm font-semibold text-navy">{fmtDayLabel(date)}</span>
                <span className={`text-xs tabular-nums ${dayNet < 0 ? "text-danger" : "text-navy/40"}`}>
                  {dayNet < 0 ? "−" : "+"}{fmtAmt(Math.abs(dayNet))}
                </span>
              </div>
              <div className="bg-card border border-navy/[0.06] rounded-2xl">
                {dayTxns.map((t, i) => {
                  const cat = t.category ? categories.find((c) => c.value === t.category) : undefined;
                  const accent = cat?.text_color ?? (t.amount > 0 ? FALLBACK_COLOR.in : FALLBACK_COLOR.out);
                  const iconKey = cat?.emoji ?? (t.amount > 0 ? FALLBACK_ICON.in : FALLBACK_ICON.out);
                  const label = cat?.label ?? "Sin categoría";
                  const badgeBg = cat
                    ? (cat.bg_color === cat.text_color ? rgba(cat.text_color, 0.12) : cat.bg_color)
                    : rgba(accent, 0.12);
                  const primary = t.contact || t.concept || "-";
                  const secondary = t.contact && t.concept && t.concept !== t.contact ? t.concept : null;
                  return (
                    <div key={t.id} className={`flex items-start gap-3 px-3 py-3 ${i > 0 ? "border-t border-navy/[0.04]" : ""}`}>
                      <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: accent }}>
                        <CatIcon iconKey={iconKey} name={label} color="#fff" size={17} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-navy truncate">{primary}</p>
                        {secondary && <p className="text-xs text-navy/40 truncate">{secondary}</p>}
                        <p className="text-xs text-navy/35 truncate">{bankLabel(t.payment_method)}</p>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium mt-1"
                          style={{ backgroundColor: badgeBg, color: accent }}
                        >
                          {label}
                        </span>
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
    </div>
  );
}
