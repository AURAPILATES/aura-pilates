"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";

const SOCIO_INITIALS: Record<string, { initials: string; bg: string; color: string }> = {
  victor: { initials: "V",  bg: "#EDE9FE", color: "#5B21B6" },
  celia:  { initials: "Ce", bg: "#FCE7F3", color: "#9D174D" },
  olga:   { initials: "O",  bg: "#D1FAE5", color: "#065F46" },
  carles: { initials: "Ca", bg: "#DBEAFE", color: "#1D4ED8" },
};

function SourceLogo({ method }: { method: string }) {
  if (method === "efectivo") {
    return (
      <div className="shrink-0 w-10 flex flex-col items-center gap-1">
        <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="13" r="3"/><path d="M6 10h.01M18 10h.01"/>
          </svg>
        </div>
        <span className="text-[9px] text-navy/40 font-medium leading-none text-center">Efectivo</span>
      </div>
    );
  }
  const socio = SOCIO_INITIALS[method];
  if (socio) {
    return (
      <div className="shrink-0 w-10 flex flex-col items-center gap-1">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: socio.bg, color: socio.color }}>
          <span style={{ fontSize: "13px", fontWeight: 700 }}>{socio.initials}</span>
        </div>
        <span className="text-[9px] text-navy/40 font-medium leading-none capitalize text-center">{method}</span>
      </div>
    );
  }
  return (
    <div className="shrink-0 w-10 flex flex-col items-center gap-1">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden">
        <img src="/Caixabank logo.png" alt="CaixaBank" width={36} height={36} className="object-contain" />
      </div>
      <span className="text-[9px] text-navy/40 font-medium leading-none text-center">CaixaBank</span>
    </div>
  );
}

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

export default function PreviewList({ transactions, categories, uncategorizedCount, allMonthKeys }: Props) {
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
        <p className="text-[11px] font-semibold text-navy/50 uppercase tracking-[0.15em]">Movimientos (preview)</p>
      </div>

      {/* KPIs agrupados en una sola caja */}
      <div className="grid grid-cols-3 divide-x divide-navy/[0.08] border border-navy/[0.1] rounded-xl bg-[#F3F0E7] mb-4 text-center">
        <div className="px-2 py-3">
          <p className="text-[10px] text-navy/45 uppercase tracking-wider mb-1">Ingresos</p>
          <p className="text-base font-semibold text-success tabular-nums">{Math.round(totalIn).toLocaleString("es-ES")} €</p>
        </div>
        <div className="px-2 py-3">
          <p className="text-[10px] text-navy/45 uppercase tracking-wider mb-1">Gastos</p>
          <p className="text-base font-semibold text-danger tabular-nums">−{Math.round(totalOut).toLocaleString("es-ES")} €</p>
        </div>
        <div className="px-2 py-3">
          <p className="text-[10px] text-navy/45 uppercase tracking-wider mb-1">Neto</p>
          <p className="text-base font-semibold text-navy tabular-nums">{Math.round(neto).toLocaleString("es-ES")} €</p>
        </div>
      </div>

      {/* Búsqueda + filtros */}
      <div className="flex gap-2 mb-[19px]">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/30" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar concepto o contacto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-navy/[0.15] rounded-lg bg-white text-navy placeholder:text-navy/35 outline-none focus:ring-2 focus:ring-primary/20 transition"
          />
        </div>
        <button className="shrink-0 flex items-center justify-center w-[42px] h-[42px] bg-white border border-navy/[0.15] rounded-lg text-navy/60">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
        </button>
        <button className="shrink-0 flex items-center justify-center w-[42px] h-[42px] bg-white border border-navy/[0.15] rounded-lg text-navy/60">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>
          </svg>
        </button>
      </div>

      {/* Banner: barra de acento, sin pastilla */}
      {uncategorizedCount > 0 && (
        <button className="w-full flex items-center gap-3 pl-3 pr-4 py-3 mb-4 rounded-lg bg-warning/[0.06] border border-navy/[0.08] border-l-[3px] border-l-warning text-left">
          <span className="flex-1 text-sm font-medium text-navy/80">{uncategorizedCount} movimientos sin clasificar</span>
          <span className="flex items-center gap-1 text-sm text-warning font-semibold whitespace-nowrap">
            Revisar
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </span>
        </button>
      )}

      {/* Tira de meses: pills sueltas con borde */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none mb-4">
        <button
          onClick={() => router.push(pathname)}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm border transition-colors whitespace-nowrap ${
            !activeMonth ? "bg-navy text-white border-navy font-medium" : "text-navy/60 border-navy/[0.18]"
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
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm border transition-colors capitalize whitespace-nowrap ${
                isActive ? "bg-navy text-white border-navy font-medium" : "text-navy/60 border-navy/[0.18] hover:text-navy"
              }`}
            >
              {label}{showYear && <span className="text-[10px] ml-0.5 opacity-60">{year}</span>}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-stretch gap-2 mb-2">
        <button className="flex-1 flex items-center justify-center gap-1.5 h-10 bg-white border border-navy/[0.18] rounded-lg text-sm font-medium text-navy">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Añadir
        </button>
        <button className="shrink-0 flex items-center justify-center gap-1.5 px-4 h-10 bg-white border border-navy/[0.18] rounded-lg text-sm font-medium text-navy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          Seleccionar
        </button>
      </div>

      {/* Lista plana con barra de acento por fila ─────────────────────────── */}
      <div>
        {byDay.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/45">Sin resultados</p>
        )}
        {byDay.map(([date, dayTxns], i) => {
          const dayNet = dayTxns.reduce((s, t) => s + t.amount, 0);
          return (
            <div key={date}>
              <div className={`flex items-baseline justify-between pb-2 ${i === 0 ? "pt-0" : "pt-5"}`}>
                <span className="text-sm font-semibold text-navy">{fmtDayLabel(date)}</span>
                <span className={`text-xs tabular-nums ${dayNet < 0 ? "text-danger" : "text-navy/40"}`}>
                  {dayNet < 0 ? "−" : "+"}{fmtAmt(Math.abs(dayNet))}
                </span>
              </div>
              <div className="divide-y divide-navy/[0.06]">
                {dayTxns.map((t) => {
                  const cat = t.category ? categories.find((c) => c.value === t.category) : undefined;
                  const accent = cat?.text_color ?? (t.amount > 0 ? FALLBACK_COLOR.in : FALLBACK_COLOR.out);
                  const label = cat?.label ?? t.concept ?? "—";
                  const badgeBg = cat
                    ? (cat.bg_color === cat.text_color ? rgba(cat.text_color, 0.12) : cat.bg_color)
                    : rgba(accent, 0.12);
                  return (
                    <div key={t.id} className="flex items-center gap-3 py-3">
                      <SourceLogo method={t.payment_method} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-navy truncate">{t.contact || t.concept || "—"}</p>
                        <p className="text-xs text-navy/40 truncate">{t.concept}</p>
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
                          <p className="text-[11px] text-navy/40 tabular-nums mt-0.5">{fmtAmt(t.balance)}</p>
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
