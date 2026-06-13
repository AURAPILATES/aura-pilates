"use client";
import { useState } from "react";
import { BookOpen } from "react-feather";
import type { Sale } from "@/lib/sales";
import type { Transaction } from "@/lib/transactions";

type Period    = "dia" | "semana" | "mes" | "trimestre" | "año";
type ChartType = "bar" | "line";

const PERIODS: { key: Period; label: string }[] = [
  { key: "dia",       label: "Día" },
  { key: "semana",    label: "Semana" },
  { key: "mes",       label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "año",       label: "Año" },
];

const MONTH_NAMES: Record<string, string> = {
  "01":"Ene","02":"Feb","03":"Mar","04":"Abr",
  "05":"May","06":"Jun","07":"Jul","08":"Ago",
  "09":"Sep","10":"Oct","11":"Nov","12":"Dic",
};

const EXPENSE_CATS = new Set([
  "Alquiler","Salarios","Electricidad","Agua","Software","Gestoría y legal",
  "Impuestos y tasas","Teléfono","Seguros","Comisiones bancarias","Merchandising",
  "Local","Otros","Inversión","Material y maquinaria","Mobiliario","Reforma",
]);

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = (d.getDay() + 6) % 7;
  const thu = new Date(d);
  thu.setDate(d.getDate() - dow + 3);
  const jan1 = new Date(thu.getFullYear(), 0, 1);
  const week = Math.ceil(((thu.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return `${thu.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getPeriodKey(date: string, period: Period): string {
  const [y, m] = date.split("-");
  switch (period) {
    case "dia":       return date;
    case "semana":    return isoWeek(date);
    case "mes":       return `${y}-${m}`;
    case "trimestre": return `${y}-Q${Math.ceil(parseInt(m) / 3)}`;
    case "año":       return y;
  }
}

function formatLabel(key: string, period: Period): string {
  switch (period) {
    case "dia": {
      const [, m, d] = key.split("-");
      return `${d}/${m}`;
    }
    case "semana": {
      const [y, w] = key.split("-");
      return `${w}'${y.slice(2)}`;
    }
    case "mes": {
      const [y, m] = key.split("-");
      return `${MONTH_NAMES[m] ?? m}'${y.slice(2)}`;
    }
    case "trimestre": return key.replace("-", " ");
    case "año":       return key;
  }
}

function groupData(sales: Sale[], txns: Transaction[], period: Period) {
  const map = new Map<string, { income: number; expense: number }>();

  for (const s of sales) {
    const key = getPeriodKey(s.paymentDate, period);
    const p = map.get(key) ?? { income: 0, expense: 0 };
    map.set(key, { ...p, income: p.income + s.amount });
  }

  for (const t of txns) {
    if (t.amount >= 0 || !EXPENSE_CATS.has(t.category)) continue;
    const key = getPeriodKey(t.date, period);
    const p = map.get(key) ?? { income: 0, expense: 0 };
    map.set(key, { ...p, expense: p.expense + Math.abs(t.amount) });
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { income, expense }]) => ({
      key,
      label: formatLabel(key, period),
      income,
      expense,
    }));
}

function fmtTick(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;
}

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

function IconLine() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block">
      <polyline points="1,13 5,7 9,10 15,3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function IconBar() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block">
      <rect x="2"  y="9"  width="3" height="6" rx="1" fill="currentColor" />
      <rect x="7"  y="5"  width="3" height="10" rx="1" fill="currentColor" />
      <rect x="12" y="2"  width="3" height="13" rx="1" fill="currentColor" />
    </svg>
  );
}

const SVG_W = 900;
const SVG_H  = 220;
const MT = 30;
const MR = 12;
const MB = 28;
const ML = 42;

const INCOME_COLOR  = "#818CF8";
const EXPENSE_COLOR = "#FCA5A5";

export default function FinanzasBarChart({
  sales,
  txns,
}: {
  sales: Sale[];
  txns: Transaction[];
}) {
  const [period,     setPeriod]     = useState<Period>("mes");
  const [chartType,  setChartType]  = useState<ChartType>("bar");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const data = groupData(sales, txns, period);
  const maxValue = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1);
  const mag      = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const niceTop  = Math.ceil(maxValue / mag) * mag;
  const yTicks   = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(niceTop * t));

  const cW = SVG_W - ML - MR;
  const cH = SVG_H - MT - MB;
  const N  = data.length;

  // Bar geometry
  const groupW    = cW / Math.max(N, 1);
  const barW      = Math.min(Math.max(groupW * 0.3, 3), 32);
  const barGap    = 3;
  const showEveryN = N > 30 ? 7 : N > 14 ? 3 : 1;

  // Line geometry
  const xOf = (i: number) => ML + (i / Math.max(N - 1, 1)) * cW;
  const yOf = (v: number) => MT + cH * (1 - v / niceTop);
  const barCx = (i: number) => ML + (i + 0.5) * groupW;

  const hoverX = hoveredIdx !== null
    ? (chartType === "line" ? xOf(hoveredIdx) : barCx(hoveredIdx))
    : null;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg  = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = SVG_W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    if (chartType === "line") {
      const raw = ((mouseX - ML) / cW) * (N - 1);
      setHoveredIdx(Math.max(0, Math.min(N - 1, Math.round(raw))));
    } else {
      setHoveredIdx(Math.max(0, Math.min(N - 1, Math.floor((mouseX - ML) / groupW))));
    }
  }

  // Tooltip geometry
  const TW = 160;
  const TH = 56;

  // Legend swatch changes shape with chart type
  const swatchClass = chartType === "bar"
    ? "w-3 h-2.5 rounded-sm inline-block"
    : "inline-block w-8 h-0.5 rounded-full";

  return (
    <div className="bg-white border border-navy/10 rounded shadow-card p-5">
      {/* Header */}
      <div className="flex flex-col gap-2 mb-5">
        {/* Row 1: tipo + título */}
        <div className="flex items-center gap-2">
          <div className="flex border border-navy/10 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setChartType("bar")}
              title="Barras"
              className={`px-2.5 py-1.5 transition-colors ${
                chartType === "bar" ? "bg-navy text-white" : "bg-white text-navy/40 hover:text-navy/70"
              }`}
            >
              <IconBar />
            </button>
            <button
              onClick={() => setChartType("line")}
              title="Línea"
              className={`px-2.5 py-1.5 transition-colors border-l border-navy/10 ${
                chartType === "line" ? "bg-navy text-white" : "bg-white text-navy/40 hover:text-navy/70"
              }`}
            >
              <IconLine />
            </button>
          </div>
          <p className="text-xs font-semibold text-navy/40 uppercase tracking-widest">
            Ingresos y gastos
          </p>
        </div>

        {/* Row 2: leyenda + período */}
        <div className="flex items-center justify-between gap-3">
          {/* Legend */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-navy/50">
              <span className={swatchClass} style={{ backgroundColor: INCOME_COLOR }} />
              Ingresos
            </span>
            <span className="flex items-center gap-1.5 text-xs text-navy/50">
              <span className={swatchClass} style={{ backgroundColor: EXPENSE_COLOR }} />
              Gastos
            </span>
          </div>

          {/* Period: select en móvil, botones en desktop */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="sm:hidden text-xs border border-navy/10 rounded-lg px-2 py-1.5 bg-white text-navy/60 outline-none"
          >
            {PERIODS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <div className="hidden sm:flex border border-navy/10 rounded-lg overflow-hidden text-xs">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  period === key
                    ? "bg-navy text-white"
                    : "bg-white text-navy/40 hover:text-navy/70 hover:bg-navy/[0.03]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-navy/30 text-center py-10">Sin datos para este período</p>
      ) : (
        <svg
          width="100%"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          overflow="visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIdx(null)}
          style={{ cursor: "crosshair" }}
        >
          <defs>
            <filter id="bar-shadow" x="-10%" y="-20%" width="120%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Grid + Y axis */}
          {yTicks.map((t) => {
            const y = MT + cH * (1 - t / niceTop);
            return (
              <g key={t}>
                <line x1={ML} y1={y} x2={SVG_W - MR} y2={y} stroke="#E2E8F0" strokeWidth="1" />
                <text x={ML - 5} y={y + 3.5} textAnchor="end" fontSize="10" fill="#94A3B8">
                  {fmtTick(t)}
                </text>
              </g>
            );
          })}

          {chartType === "bar" ? (
            data.map(({ key, label, income, expense }, i) => {
              const cx   = ML + (i + 0.5) * groupW;
              const ix   = cx - barGap / 2 - barW;
              const ex   = cx + barGap / 2;
              const ih   = income  > 0 ? (income  / niceTop) * cH : 0;
              const eh   = expense > 0 ? (expense / niceTop) * cH : 0;
              const isH  = hoveredIdx === i;
              const show = i % showEveryN === 0;
              return (
                <g key={key}>
                  {income > 0 && (
                    <rect x={ix} y={MT + cH - ih} width={barW} height={ih} rx="3"
                      fill={INCOME_COLOR} opacity={hoveredIdx !== null && !isH ? 0.4 : 1} />
                  )}
                  {expense > 0 && (
                    <rect x={ex} y={MT + cH - eh} width={barW} height={eh} rx="3"
                      fill={EXPENSE_COLOR} opacity={hoveredIdx !== null && !isH ? 0.4 : 1} />
                  )}
                  {show && (
                    <text x={cx} y={SVG_H - MB + 14} textAnchor="middle" fontSize="9.5" fill="#94A3B8">
                      {label}
                    </text>
                  )}
                </g>
              );
            })
          ) : (
            <>
              {/* Area fills */}
              {[
                { values: data.map((d) => d.income),  color: INCOME_COLOR },
                { values: data.map((d) => d.expense), color: EXPENSE_COLOR },
              ].map(({ values, color }) => {
                const pts = values.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
                const d =
                  pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") +
                  ` L${pts[pts.length - 1].x},${MT + cH} L${pts[0].x},${MT + cH} Z`;
                return <path key={color} d={d} fill={color} fillOpacity="0.08" />;
              })}

              {/* Lines + dots */}
              {[
                { values: data.map((d) => d.income),  color: INCOME_COLOR,  label: "income" },
                { values: data.map((d) => d.expense), color: EXPENSE_COLOR, label: "expense" },
              ].map(({ values, color, label }) => {
                const pts = values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(" ");
                return (
                  <g key={label}>
                    <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
                      strokeLinejoin="round" strokeLinecap="round" />
                    {values.map((v, i) => {
                      const isH = hoveredIdx === i;
                      if (v === 0 && !isH) return null;
                      return (
                        <circle key={i} cx={xOf(i)} cy={yOf(v)}
                          r={isH ? 4.5 : 3} fill={color} stroke="white" strokeWidth={isH ? 2 : 1.5} />
                      );
                    })}
                  </g>
                );
              })}

              {/* X-axis labels */}
              {data.map(({ key, label }, i) => {
                if (i % showEveryN !== 0) return null;
                return (
                  <text key={key} x={xOf(i)} y={SVG_H - MB + 14} textAnchor="middle" fontSize="9.5" fill="#94A3B8">
                    {label}
                  </text>
                );
              })}
            </>
          )}

          {/* Crosshair */}
          {hoverX !== null && (
            <line x1={hoverX} y1={MT} x2={hoverX} y2={MT + cH}
              stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 3" pointerEvents="none" />
          )}

          {/* Tooltip */}
          {hoveredIdx !== null && (() => {
            const { label, income, expense } = data[hoveredIdx];
            const sx     = hoverX!;
            const flipL  = sx + TW + 16 > SVG_W - MR;
            const tx     = flipL ? sx - TW - 12 : sx + 12;
            const ty     = MT;
            return (
              <g pointerEvents="none">
                <rect x={tx} y={ty} width={TW} height={TH} rx="6"
                  fill="white" stroke="#E2E8F0" strokeWidth="1" filter="url(#bar-shadow)" />
                <text x={tx + 10} y={ty + 15} fontSize="10" fontWeight="700" fill="#334155">
                  {label}
                </text>
                <g>
                  <circle cx={tx + 14} cy={ty + 29} r="3.5" fill={INCOME_COLOR} />
                  <text x={tx + 24} y={ty + 33} fontSize="9.5" fill="#64748B">Ingresos</text>
                  <text x={tx + TW - 10} y={ty + 33} fontSize="9.5" fontWeight="600"
                    fill="#0F172A" textAnchor="end">{fmtEur(income)}</text>
                </g>
                <g>
                  <circle cx={tx + 14} cy={ty + 45} r="3.5" fill={EXPENSE_COLOR} />
                  <text x={tx + 24} y={ty + 49} fontSize="9.5" fill="#64748B">Gastos</text>
                  <text x={tx + TW - 10} y={ty + 49} fontSize="9.5" fontWeight="600"
                    fill="#0F172A" textAnchor="end">{fmtEur(expense)}</text>
                </g>
              </g>
            );
          })()}

          {/* Transparent overlay */}
          <rect x={ML} y={MT} width={cW} height={cH} fill="transparent" />
        </svg>
      )}

      <p className="text-xs text-navy/30 mt-2 flex items-center gap-1.5">
        <BookOpen size={12} className="shrink-0" />
        Ingresos: Momence sales.csv · Gastos: exportación bancaria Caixabank.
      </p>
    </div>
  );
}
