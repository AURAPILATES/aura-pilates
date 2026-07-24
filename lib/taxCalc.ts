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
