import type { EventCategoria } from "@/lib/businessEvents";

/** Estilo único de anotación de business_events, compartido por todos los gráficos de evolución (Recharts o SVG puro). */
export const EVENT_COLORS: Record<EventCategoria, string> = {
  precios: "#F59E0B",
  horarios: "#3B82F6",
  promociones: "#10B981",
  operativo: "#A855F7",
  otro: "#64748B",
};

export const EVENT_LABELS: Record<EventCategoria, string> = {
  precios: "Precios",
  horarios: "Horarios",
  promociones: "Promociones",
  operativo: "Operativo",
  otro: "Otro",
};

const MONTH_NAMES: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

export function fmtEventDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTH_NAMES[m]} ${y}`;
}
