import { pct } from "@/lib/analytics";

// ── Shared ────────────────────────────────────────────────────────────────────

function BlockCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-navy/10 rounded shadow-card p-5">
      <p className="text-xs font-semibold text-navy/40 uppercase tracking-wider mb-4">{title}</p>
      {children}
    </div>
  );
}

function OccBar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? (value / max) * 100 : 0;
  const color = value >= 0.7 ? "bg-success" : value >= 0.5 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex-1 h-1.5 bg-navy/5 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function CountBar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex-1 h-1.5 bg-navy/5 rounded-full overflow-hidden">
      <div className="h-full rounded-full bg-primary/60" style={{ width: `${w}%` }} />
    </div>
  );
}

// ── Profesoras ────────────────────────────────────────────────────────────────

type TeacherRow = { teacher: string; occupancy: number; classes: number; students: number };

export function ProfessorasBlock({ data }: { data: TeacherRow[] }) {
  const sorted = [...data].sort((a, b) => b.occupancy - a.occupancy);
  const max = Math.max(...sorted.map((r) => r.occupancy));
  return (
    <BlockCard title="Ocupación por profesora">
      <div className="space-y-3">
        {sorted.map((r) => (
          <div key={r.teacher} className="flex items-center gap-3">
            <span className="text-xs text-navy w-28 shrink-0 truncate">{r.teacher || "Sin asignar"}</span>
            <OccBar value={r.occupancy} max={max} />
            <span className={`text-xs font-medium w-9 text-right tabular-nums ${
              r.occupancy >= 0.7 ? "text-success" : r.occupancy >= 0.5 ? "text-warning" : "text-danger"
            }`}>{pct(r.occupancy)}</span>
            <span className="text-xs text-navy/30 w-16 text-right tabular-nums">{r.classes} clases</span>
          </div>
        ))}
      </div>
    </BlockCard>
  );
}

// ── Por hora del día ──────────────────────────────────────────────────────────

type HourRow = { label: string; avgOcc: number; count: number };

export function HorarioDelDiaBlock({ data }: { data: HourRow[] }) {
  const max = Math.max(...data.map((r) => r.avgOcc));
  return (
    <BlockCard title="Ocupación por franja horaria">
      <div className="space-y-3">
        {data.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="text-xs font-mono text-navy/60 w-12 shrink-0">{r.label}</span>
            <OccBar value={r.avgOcc} max={max} />
            <span className={`text-xs font-medium w-9 text-right tabular-nums ${
              r.avgOcc >= 0.7 ? "text-success" : r.avgOcc >= 0.5 ? "text-warning" : "text-danger"
            }`}>{pct(r.avgOcc)}</span>
            <span className="text-xs text-navy/30 w-16 text-right tabular-nums">{r.count} clases</span>
          </div>
        ))}
      </div>
    </BlockCard>
  );
}

// ── Por día de la semana ──────────────────────────────────────────────────────

type WeekdayRow = { label: string; avgOcc: number; count: number };

export function DiaSemanaBlock({ data }: { data: WeekdayRow[] }) {
  const max = Math.max(...data.map((r) => r.avgOcc));
  return (
    <BlockCard title="Ocupación por día de la semana">
      <div className="space-y-3">
        {data.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="text-xs text-navy/60 w-20 shrink-0">{r.label}</span>
            <OccBar value={r.avgOcc} max={max} />
            <span className={`text-xs font-medium w-9 text-right tabular-nums ${
              r.avgOcc >= 0.7 ? "text-success" : r.avgOcc >= 0.5 ? "text-warning" : "text-danger"
            }`}>{pct(r.avgOcc)}</span>
            <span className="text-xs text-navy/30 w-16 text-right tabular-nums">{r.count} clases</span>
          </div>
        ))}
      </div>
    </BlockCard>
  );
}

// ── Heatmap día × hora ────────────────────────────────────────────────────────

type HeatmapCell = { weekday: number; weekdayLabel: string; hour: number; avgOcc: number; count: number };

export function HeatmapBlock({ data }: { data: HeatmapCell[] }) {
  const weekdays = Array.from(new Set(data.map((d) => d.weekday))).sort();
  const hours = Array.from(new Set(data.map((d) => d.hour))).sort((a, b) => a - b);
  const byKey = new Map(data.map((d) => [`${d.weekday}-${d.hour}`, d]));
  const weekdayLabels: Record<number, string> = Object.fromEntries(
    data.map((d) => [d.weekday, d.weekdayLabel])
  );

  function cellColor(avgOcc: number) {
    if (avgOcc >= 0.85) return "bg-success text-white";
    if (avgOcc >= 0.7) return "bg-success/60 text-navy";
    if (avgOcc >= 0.5) return "bg-warning/70 text-navy";
    if (avgOcc >= 0.3) return "bg-warning/30 text-navy";
    return "bg-navy/5 text-navy/40";
  }

  return (
    <BlockCard title="Mapa de calor: día × hora">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-navy/40 font-medium pb-2 pr-3 w-20"></th>
              {hours.map((h) => (
                <th key={h} className="text-center text-navy/40 font-mono font-normal pb-2 px-1">
                  {String(h).padStart(2, "0")}h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekdays.map((wd) => (
              <tr key={wd}>
                <td className="text-navy/60 pr-3 py-1 font-medium">{weekdayLabels[wd]}</td>
                {hours.map((h) => {
                  const cell = byKey.get(`${wd}-${h}`);
                  return (
                    <td key={h} className="px-0.5 py-1">
                      {cell ? (
                        <div
                          className={`rounded text-center py-1 px-1 tabular-nums font-medium ${cellColor(cell.avgOcc)}`}
                          title={`${cell.count} clases`}
                        >
                          {pct(cell.avgOcc)}
                        </div>
                      ) : (
                        <div className="rounded bg-transparent py-1 px-1 text-center text-navy/10">—</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlockCard>
  );
}

// ── Urban Sport Club ──────────────────────────────────────────────────────────

type UrbanHourRow = { label: string; count: number };
type UrbanWeekdayRow = { label: string; count: number };

export function UrbanBlock({
  byHour,
  byWeekday,
}: {
  byHour: UrbanHourRow[];
  byWeekday: UrbanWeekdayRow[];
}) {
  const maxH = Math.max(...byHour.map((r) => r.count));
  const maxW = Math.max(...byWeekday.map((r) => r.count));
  const total = byHour.reduce((s, r) => s + r.count, 0);

  return (
    <BlockCard title={`Urban Sport Club · ${total} reservas`}>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-navy/40 mb-3">Por franja horaria</p>
          <div className="space-y-2.5">
            {byHour.map((r) => (
              <div key={r.label} className="flex items-center gap-2">
                <span className="text-xs font-mono text-navy/60 w-12 shrink-0">{r.label}</span>
                <CountBar value={r.count} max={maxH} />
                <span className="text-xs font-medium text-navy w-8 text-right tabular-nums">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-navy/40 mb-3">Por día de la semana</p>
          <div className="space-y-2.5">
            {byWeekday.map((r) => (
              <div key={r.label} className="flex items-center gap-2">
                <span className="text-xs text-navy/60 w-20 shrink-0">{r.label}</span>
                <CountBar value={r.count} max={maxW} />
                <span className="text-xs font-medium text-navy w-8 text-right tabular-nums">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BlockCard>
  );
}
