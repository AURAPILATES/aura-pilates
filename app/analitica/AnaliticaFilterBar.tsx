"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense } from "react";

const MONTHS = [
  { value: "month_01", label: "Ene" },
  { value: "month_02", label: "Feb" },
  { value: "month_03", label: "Mar" },
  { value: "month_04", label: "Abr" },
  { value: "month_05", label: "May" },
  { value: "month_06", label: "Jun" },
  { value: "month_07", label: "Jul" },
  { value: "month_08", label: "Ago" },
  { value: "month_09", label: "Sep" },
  { value: "month_10", label: "Oct" },
  { value: "month_11", label: "Nov" },
  { value: "month_12", label: "Dic" },
];

const QUARTERS = [
  { value: "q1", label: "Q1" },
  { value: "q2", label: "Q2" },
  { value: "q3", label: "Q3" },
  { value: "q4", label: "Q4" },
];

type PeriodType = "month" | "quarter" | "year";

function getType(period: string): PeriodType {
  if (period.startsWith("month_")) return "month";
  if (/^q[1-4]$/.test(period)) return "quarter";
  return "year";
}

function AnaliticaFilterBarInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const period = sp.get("period") ?? `month_${String(currentMonth).padStart(2, "0")}`;
  const year = parseInt(sp.get("year") ?? String(currentYear));
  const compareWith = sp.get("compareWith") ?? "previous";

  const type = getType(period);

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

  function setType(newType: PeriodType) {
    if (newType === "year") {
      update({ period: "year" });
    } else if (newType === "quarter") {
      update({ period: "q1" });
    } else {
      update({ period: `month_${String(currentMonth).padStart(2, "0")}` });
    }
  }

  const pill = (active: boolean) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
      active ? "bg-white shadow-sm text-navy" : "text-navy/50 hover:text-navy"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-navy/[0.06]">

      {/* Granularity */}
      <div className="flex items-center gap-0.5 bg-navy/[0.04] rounded-xl p-1">
        {(["month", "quarter", "year"] as const).map((t) => (
          <button key={t} onClick={() => setType(t)} className={pill(type === t)}>
            {t === "month" ? "Mes" : t === "quarter" ? "Trimestre" : "Año"}
          </button>
        ))}
      </div>

      {/* Specific period */}
      {type === "month" && (
        <div className="flex items-center gap-0.5 bg-navy/[0.04] rounded-xl p-1 overflow-x-auto">
          {MONTHS.map((m) => (
            <button key={m.value} onClick={() => update({ period: m.value })} className={pill(period === m.value)}>
              {m.label}
            </button>
          ))}
        </div>
      )}

      {type === "quarter" && (
        <div className="flex items-center gap-0.5 bg-navy/[0.04] rounded-xl p-1">
          {QUARTERS.map((q) => (
            <button key={q.value} onClick={() => update({ period: q.value })} className={pill(period === q.value)}>
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Year */}
      <div className="flex items-center gap-0.5 bg-navy/[0.04] rounded-xl p-1">
        {availableYears.map((y) => (
          <button key={y} onClick={() => update({ year: String(y) })} className={pill(year === y)}>
            {y}
          </button>
        ))}
      </div>

      {/* Compare with */}
      <div className="flex items-center gap-2 sm:ml-auto">
        <span className="text-[11px] text-navy/40">Comparar con</span>
        <div className="flex items-center gap-0.5 bg-navy/[0.04] rounded-xl p-1">
          {([
            { value: "previous", label: "Período anterior" },
            { value: "year_ago", label: "Año anterior" },
            { value: "none", label: "—" },
          ] as const).map((opt) => (
            <button key={opt.value} onClick={() => update({ compareWith: opt.value })} className={pill(compareWith === opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
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
