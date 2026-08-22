/**
 * Un movimiento bancario es el importe ya neto de IVA y retención: para una factura de
 * proveedor con retención, lo que sale del banco es `base + IVA - retención`. Para extraer
 * la base a partir del importe y los dos tipos:
 *
 *   base = importe / (1 + ivaRate/100 - retencionRate/100)
 *
 * Con retencionRate = 0 esto es la fórmula estándar de "extraer IVA de un bruto".
 */
export function taxBreakdown(amount: number, ivaRate: number, retencionRate: number) {
  const gross = Math.abs(amount);
  const divisor = 1 + ivaRate / 100 - retencionRate / 100;
  const base = divisor !== 0 ? gross / divisor : gross;
  return {
    base,
    ivaAmount: base * (ivaRate / 100),
    retencionAmount: base * (retencionRate / 100),
  };
}

/** Trimestre fiscal (Q1 ene-mar, Q2 abr-jun, Q3 jul-sep, Q4 oct-dic) en formato "2026-Q2". */
export function fiscalQuarterOf(date: string): string {
  const [year, month] = date.split("-");
  const q = Math.ceil(parseInt(month, 10) / 3);
  return `${year}-Q${q}`;
}

/**
 * IVA repercutido de una venta: el importe de Stripe/USC ya incluye el 21% de IVA (bruto),
 * así que se extrae igual que el IVA soportado de un gasto, con retención 0.
 */
export function ivaRepercutidoFromGross(amount: number, ivaRate: number = 21): number {
  return taxBreakdown(amount, ivaRate, 0).ivaAmount;
}

/**
 * IVA neto a pagar de un trimestre: IVA repercutido de ventas − IVA soportado de gastos.
 * No se clampa a 0 - un resultado negativo es "a favor"/a compensar y debe mostrarse tal cual.
 */
export function netIvaAPagar(ivaRepercutido: number, ivaSoportado: number): number {
  return ivaRepercutido - ivaSoportado;
}

const MONTH_ABBR_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export type FiscalObligationSource = { label: string; date: string; deadline: string; quarter: string };

/**
 * Vencimientos trimestrales de IVA (Modelo 303) e IRPF (Modelo 130): el día 20 del mes
 * siguiente al trimestre, incluido T4 (aquí se mantiene también a 20 de enero, mismo
 * criterio que ya usaba la app antes de esta función - a confirmar con la gestoría si el
 * vencimiento real de Hacienda para el resumen anual de IVA es el 30 de enero).
 *
 * Genera una ventana rodante en vez de fechas fijas: antes era un array hardcodeado solo
 * para los trimestres de 2026, que se quedaba sin "próxima obligación" a partir de 2027.
 *
 * IMPORTANTE: quartersBack + quartersAhead debe quedarse por debajo de 4 (un año). Con 4
 * trimestres por año, una ventana de 4 o más repite la etiqueta de un trimestre (p.ej. "IVA T3")
 * dos veces - la de este año y la del año siguiente, indistinguibles porque el label no lleva año.
 */
export function generateFiscalObligations(
  referenceDate: Date,
  quartersBack = 1,
  quartersAhead = 2,
): FiscalObligationSource[] {
  const obligations: FiscalObligationSource[] = [];
  const curYear = referenceDate.getFullYear();
  const curQuarter = Math.ceil((referenceDate.getMonth() + 1) / 3);
  const curIndex = curYear * 4 + (curQuarter - 1);

  for (let i = curIndex - quartersBack; i <= curIndex + quartersAhead; i++) {
    const year = Math.floor(i / 4);
    const q = (i % 4) + 1; // 1..4
    const deadlineMonth = q === 4 ? 1 : q * 3 + 1;
    const deadlineYear = q === 4 ? year + 1 : year;
    const deadline = `${deadlineYear}-${String(deadlineMonth).padStart(2, "0")}-20`;
    const date = `20 ${MONTH_ABBR_ES[deadlineMonth - 1]}`;
    const quarter = `${year}-Q${q}`;
    obligations.push({ label: q === 4 ? "IVA T4 / Anual" : `IVA T${q}`, date, deadline, quarter });
    obligations.push({ label: `IRPF T${q}`, date, deadline, quarter });
  }
  return obligations;
}
