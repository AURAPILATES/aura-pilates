"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense } from "react";
import { ChevronDown } from "react-feather";

const MONTHS = [
  { value: "month_01", label: "Enero" },
  { value: "month_02", label: "Febrero" },
  { value: "month_03", label: "Marzo" },
  { value: "month_04", label: "Abril" },
  { value: "month_05", label: "Mayo" },
  { value: "month_06", label: "Junio" },
  { value: "month_07", label: "Julio" },
  { value: "month_08", label: "Agosto" },
  { value: "month_09", label: "Septiembre" },
  { value: "month_10", label: "Octubre" },
  { value: "month_11", label: "Noviembre" },
  { value: "month_12", label: "Diciembre" },
];

const QUARTERS = [
  { value: "q1", label: "Q1 · Ene–Mar" },
  { value: "q2", label: "Q2 · Abr–Jun" },
  { value: "q3", label: "Q3 · Jul–Sep" },
  { value: "q4", label: "Q4 · Oct–Dic" },
];

const COMPARE_OPTIONS = [
  { value: "previous", label: "Período anterior" },
  { value: "year_ago", label: "Año anterior" },
  { value: "none", label: "Sin comparación" },
] as const;

function SelectPill({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-navy/[0.13] rounded-xl pl-3 pr-7 py-1.5 text-sm font-semibold text-navy shadow-sm outline-none cursor-pointer hover:border-navy/25 transition-colors"
      >
        {children}
      </select>
      <ChevronDown size={12} className="absolute right-2 text-navy/35 pointer-events-none" />
    </div>
  );
}

function AnaliticaFilterBarInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const period = sp.get("period") ?? `month_${String(currentMonth).padStart(2, "0")}`;
  const year = sp.get("year") ?? String(currentYear);
  const compareWith = sp.get("compareWith") ?? "previous";

  const availableYears: number[] = [];
  for (let y = 2025; y <= currentYear; y++) availableYears.push(y);

  function update(changes: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  function onPeriodChange(value: string) {
    update({ period: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-navy/[0.06]">

      {/* Period selector: months + quarters + year + all-time grouped */}
      <SelectPill value={period} onChange={onPeriodChange}>
        <optgroup label="Mes">
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </optgroup>
        <optgroup label="Trimestre">
          {QUARTERS.map((q) => (
            <option key={q.value} value={q.value}>{q.label}</option>
          ))}
        </optgroup>
        <option value="year">Año completo</option>
        <option value="all">Desde el inicio</option>
      </SelectPill>

      {/* Year selector — disabled when period is "all" */}
      <div className={period === "all" ? "opacity-35 pointer-events-none" : undefined}>
        <SelectPill value={year} onChange={(v) => update({ year: v })}>
          {availableYears.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </SelectPill>
      </div>

      {/* Compare with — disabled when period is "all" */}
      <div className={`flex items-center gap-2 sm:ml-auto ${period === "all" ? "opacity-35 pointer-events-none" : ""}`}>
        <span className="text-[11px] text-navy/40">Comparar con</span>
        <SelectPill value={compareWith} onChange={(v) => update({ compareWith: v })}>
          {COMPARE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </SelectPill>
      </div>
    </div>
  );
}

export default function AnaliticaFilterBar() {
  return (
    <Suspense fallback={<div className="h-10 mb-4" />}>
      <AnaliticaFilterBarInner />
    </Suspense>
  );
}
