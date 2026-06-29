import type { ConversionCohort } from "@/lib/sales";

export type CohortAnalysis = ConversionCohort & {
  /** n·p < 5 o n·(1-p) < 5 — la proporción no es estadísticamente concluyente. */
  lowConfidence: boolean;
  /** No han pasado los días medianos de conversión desde el cierre del mes — la tasa todavía puede subir. */
  immature: boolean;
  unreliable: boolean;
};

const DEFAULT_MATURITY_DAYS = 20;

function monthEndDate(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0);
}

export function analyzeCohorts(
  cohorts: ConversionCohort[],
  medianDaysToConvert: number | null,
  now: Date = new Date(),
): CohortAnalysis[] {
  const maturityWindow = medianDaysToConvert ?? DEFAULT_MATURITY_DAYS;
  return cohorts.map((c) => {
    const n = c.buyers;
    const p = c.rate;
    const lowConfidence = n === 0 || n * p < 5 || n * (1 - p) < 5;
    const daysSinceClose = Math.floor((now.getTime() - monthEndDate(c.month).getTime()) / 86_400_000);
    const immature = daysSinceClose < maturityWindow;
    return { ...c, lowConfidence, immature, unreliable: lowConfidence || immature };
  });
}

function fmtPct1(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

/** Frases en lenguaje llano para el "Análisis IA": meses inmaduros y meses con muestra insuficiente. */
export function buildConversionInsight(analyzed: CohortAnalysis[], medianDaysToConvert: number | null): string[] {
  const sentences: string[] = [];
  const maturityWindow = medianDaysToConvert ?? DEFAULT_MATURITY_DAYS;

  const immatureCohorts = analyzed.filter((c) => c.immature);
  if (immatureCohorts.length > 0) {
    const labels = immatureCohorts.map((c) => c.label).join(", ");
    const verb = immatureCohorts.length === 1 ? "no es comparable" : "no son comparables";
    sentences.push(
      `${labels}: todavía dentro de la ventana de conversión (~${maturityWindow}d desde el pack) — su tasa ${verb} con meses anteriores.`,
    );
  }

  const lowConfMature = analyzed.filter((c) => !c.immature && c.lowConfidence);
  if (lowConfMature.length > 0) {
    sentences.push(
      `${lowConfMature.map((c) => c.label).join(", ")}: muestra insuficiente para ser concluyente (n·p o n·(1-p) < 5).`,
    );
  }

  const matureReliable = analyzed.filter((c) => !c.immature && !c.lowConfidence);
  if (matureReliable.length > 0) {
    const rates = matureReliable.map((c) => c.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
    sentences.push(
      `Los meses completos y con muestra suficiente oscilan entre ${fmtPct1(min)}–${fmtPct1(max)}, media estable en ~${fmtPct1(avg)}.`,
    );
  }

  return sentences;
}
