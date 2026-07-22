import { MomenceEvent } from "@/lib/momence";
import type { BusinessEvent } from "@/lib/businessEvents";
import {
  occupancyRate,
  occupancyHeatmap,
  totalStudents,
  pct,
} from "@/lib/analytics";
import { ChartCard } from "@/components/charts";
import HorarioOcupacionEvolucion from "./HorarioOcupacionEvolucion";
import DeltaBadge, { type DeltaDirection } from "@/components/charts/DeltaBadge";

export type ReportingData = {
  main: MomenceEvent[];
  compare: MomenceEvent[];
  periodLabel: string;
  periodFrom: string;
  periodTo: string;
  businessEvents: BusinessEvent[];
};

function occTone(value: number) {
  if (value >= 0.75) return { soft: "bg-success/15 text-success", solid: "bg-success" };
  if (value >= 0.5)  return { soft: "bg-warning/15 text-warning", solid: "bg-warning" };
  return { soft: "bg-danger/15 text-danger", solid: "bg-danger" };
}

function delta(cur: number, prev: number, invert = false): { value: string; direction: DeltaDirection } | undefined {
  if (prev === 0) return undefined;
  const p = ((cur - prev) / prev) * 100;
  if (p === 0) return undefined;
  const up = invert ? p < 0 : p > 0;
  return {
    value: `${p > 0 ? "+" : ""}${p.toFixed(1).replace(".", ",")} %`,
    direction: up ? "pos" : "neg",
  };
}

const WEEKDAY_SHORT = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

function fmtD(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

export default function HorarioReporting({ data }: { data: ReportingData }) {
  const { main, compare, periodFrom, periodTo, businessEvents } = data;
  const dateRange = `${fmtD(periodFrom)} – ${fmtD(periodTo)}`;

  const occ     = occupancyRate(main);
  const occPrev = occupancyRate(compare);

  const studentsTotal     = totalStudents(main);
  const studentsTotalPrev = totalStudents(compare);
  const avgPerClass     = main.length > 0 ? studentsTotal / main.length : 0;
  const avgPerClassPrev = compare.length > 0 ? studentsTotalPrev / compare.length : 0;

  const heatmap    = occupancyHeatmap(main);
  const heatmapHours = [...new Set(heatmap.map((c) => c.hour))].sort((a, b) => a - b);
  const heatCell = (wd: number, hour: number) => heatmap.find((c) => c.weekday === wd && c.hour === hour);
  const heatDayAvg = (wd: number) => {
    const cells = heatmap.filter((c) => c.weekday === wd);
    const count = cells.reduce((s, c) => s + c.count, 0);
    return count > 0 ? { avgOcc: cells.reduce((s, c) => s + c.avgOcc * c.count, 0) / count, count } : null;
  };
  const heatHourAvg = (hour: number) => {
    const cells = heatmap.filter((c) => c.hour === hour);
    const count = cells.reduce((s, c) => s + c.count, 0);
    return count > 0 ? { avgOcc: cells.reduce((s, c) => s + c.avgOcc * c.count, 0) / count, count } : null;
  };

  return (
    <div className="space-y-4">

      <HorarioOcupacionEvolucion
        events={main}
        businessEvents={businessEvents}
        dateRange={dateRange}
        kpiItems={[
          {
            label: "Ocupación media",
            value: `${Math.round(occ * 100)}%`,
            valueClassName: occ >= 0.7 ? "text-success" : occ >= 0.4 ? "text-warning" : "text-danger",
            helper: delta(occ, occPrev) && <DeltaBadge {...delta(occ, occPrev)!} />,
          },
          {
            label: "Media alumnos/clase",
            value: avgPerClass.toFixed(1),
            helper: delta(avgPerClass, avgPerClassPrev) && <DeltaBadge {...delta(avgPerClass, avgPerClassPrev)!} />,
          },
        ]}
      />

      <ChartCard
        title="Mapa de calor · Día × Hora"
        subtitle="Ocupación media por franja horaria y día de la semana"
        dataSource="Eventos activos en Momence dentro del período seleccionado"
        sources={["momence"]}
      >
        {heatmap.length === 0 ? (
          <p className="text-sm text-navy/45">Sin datos de clases pasadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-20" />
                  {heatmapHours.map((h) => {
                    const hourAvg = heatHourAvg(h);
                    return (
                      <th key={h} className="text-[11px] font-medium text-navy/55 text-center pb-2 px-1 min-w-[56px]">
                        <div className="flex flex-col items-center gap-1">
                          <span>{String(h).padStart(2, "0")}h</span>
                          {hourAvg !== null && (
                            <span className={`inline-block rounded-full text-[10px] font-semibold px-1.5 py-0.5 tabular-nums cursor-default ${occTone(hourAvg.avgOcc).soft}`}>
                              {pct(hourAvg.avgOcc)}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map((wd) => {
                  const dayAvg = heatDayAvg(wd);
                  return (
                  <tr key={wd}>
                    <td className="text-xs text-navy/50 pr-3 py-1 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{WEEKDAY_SHORT[wd]}</span>
                        {dayAvg !== null && (
                          <span className={`inline-block rounded-full text-[10px] font-semibold px-1.5 py-0.5 tabular-nums cursor-default ${occTone(dayAvg.avgOcc).soft}`}>
                            {pct(dayAvg.avgOcc)}
                          </span>
                        )}
                      </div>
                    </td>
                    {heatmapHours.map((h) => {
                      const cell = heatCell(wd, h);
                      if (!cell) return (
                        <td key={h} className="px-1 py-1">
                          <div className="text-center text-[11px] text-navy/50 py-2 px-2">—</div>
                        </td>
                      );
                      return (
                        <td key={h} className="px-1 py-1">
                          <div className={`w-full rounded text-center text-[11px] font-semibold py-2 px-2 text-white ${occTone(cell.avgOcc).solid}`}>
                            {pct(cell.avgOcc)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

    </div>
  );
}
