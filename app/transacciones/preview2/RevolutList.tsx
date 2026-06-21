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

const FALLBACK_COLOR = { in: "#4e8c68", out: "#1c1917" };
const FALLBACK_ICON = { in: "trending-up", out: "package" };

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
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div>
          <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Ingresos</p>
          <p className="text-base font-semibold text-success tabular-nums">{Math.round(totalIn).toLocaleString("es-ES")} €</p>
        </div>
        <div>
          <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Gastos</p>
          <p className="text-base font-semibold text-danger tabular-nums">−{Math.round(totalOut).toLocaleString("es-ES")} €</p>
        </div>
        <div>
          <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Neto</p>
          <p className="text-base font-semibold text-navy tabular-nums">{Math.round(neto).toLocaleString("es-ES")} €</p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/30" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Buscar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-full bg-navy/[0.04] text-navy placeholder:text-navy/35 outline-none focus:bg-navy/[0.06] transition"
        />
      </div>

      {/* Banner */}
      {uncategorizedCount > 0 && (
        <button className="w-full flex items-center gap-3 pl-3 pr-4 py-3 mb-4 rounded-xl bg-warning/[0.06] border-l-[3px] border-l-warning text-left">
          <span className="flex-1 text-sm font-medium text-navy/80">{uncategorizedCount} movimientos sin clasificar</span>
          <span className="text-sm text-warning font-semibold whitespace-nowrap">Revisar</span>
        </button>
      )}

      {/* Tira de meses: estilo Revolut, sin bordes en inactivos */}
      <div className="flex gap-3 overflow-x-auto scrollbar-none mb-5">
        <button
          onClick={() => router.push(pathname)}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap ${
            !activeMonth ? "bg-navy text-white font-medium" : "text-navy/40 hover:text-navy/70"
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
                isActive ? "bg-navy text-white font-medium" : "text-navy/40 hover:text-navy/70"
              }`}
            >
              {label}{showYear && <span className="text-[10px] ml-0.5 opacity-60">{year}</span>}
            </button>
          );
        })}
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
              <div className="bg-white border border-navy/[0.06] rounded-2xl shadow-sm">
                {dayTxns.map((t, i) => {
                  const cat = t.category ? categories.find((c) => c.value === t.category) : undefined;
                  const accent = cat?.text_color ?? (t.amount > 0 ? FALLBACK_COLOR.in : FALLBACK_COLOR.out);
                  const iconKey = cat?.emoji ?? (t.amount > 0 ? FALLBACK_ICON.in : FALLBACK_ICON.out);
                  const label = cat?.label ?? t.concept ?? "";
                  return (
                    <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? "border-t border-navy/[0.04]" : ""}`}>
                      <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: accent }}>
                        <CatIcon iconKey={iconKey} name={label} color="#fff" size={17} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-navy truncate">{t.contact || t.concept || "—"}</p>
                        <p className="text-xs text-navy/40 truncate">{label || t.concept}</p>
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
