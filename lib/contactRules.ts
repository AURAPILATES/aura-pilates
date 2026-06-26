/** Una cadena es "de referencia" (número de operación, parte de un IBAN, etc.) si la mayoría
 * de sus caracteres no son letras — no identifica a un contacto real, así que agruparía mal
 * (cada movimiento traería un número distinto en "Más datos": PAGO TRASPASOS, TGSS.COTIZACION...). */
export function isReferenceLike(s: string): boolean {
  const clean = s.replace(/[\s-]/g, "");
  if (!clean) return true;
  const digits = clean.replace(/[^0-9]/g, "").length;
  return digits / clean.length >= 0.5;
}

/** Un token "parece un código" (de operación, de transferencia, de factura...) si es mayoría
 * dígitos, o si es un bloque de mayúsculas sin vocales — ese patrón no aparece en palabras o
 * nombres reales, solo en identificadores que el banco genera por movimiento (ej. "SXPYDKKK"
 * en "SXPYDKKK -Stripe Technology Eu") y que cambian aunque sea siempre el mismo contacto. */
function looksLikeCode(word: string): boolean {
  const w = word.replace(/[.,]/g, "");
  if (!w) return true;
  if (isReferenceLike(w)) return true;
  return w.length >= 6 && w === w.toUpperCase() && !/[aeiouáéíóú]/i.test(w);
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Quita de un texto de banco los tokens que "parecen un código" (ver looksLikeCode),
 * dejando solo lo que identifica de forma estable a un contacto — así dos movimientos del
 * mismo contacto con referencias distintas ("SXPYDKKK", "QWERTYZZ"...) producen el mismo
 * resultado. Si no queda ninguna palabra reconocible, devuelve el texto original sin tocar. */
export function cleanBankText(s: string | null | undefined): string {
  if (!s) return "";
  const words = s.trim().replace(/[,\-–—]/g, " ").split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !looksLikeCode(w));
  return (kept.length ? kept : words).join(" ");
}

/** Clave de agrupación de un movimiento: combina concepto + "más datos", ya limpios de
 * referencias y códigos variables (ver cleanBankText), para que el mismo contacto real
 * produzca siempre la misma clave aunque el banco incluya un código distinto cada vez. Si
 * "más datos" es solo una referencia numérica o está vacío, se usa solo el concepto. */
export function contactKeyFor(concept: string | null, contact: string | null): string {
  const cleanConcept = cleanBankText(concept);
  const c = contact?.trim();
  if (c && !isReferenceLike(c)) {
    const cleanContact = cleanBankText(c);
    return normalize(`${cleanConcept}|${cleanContact}`);
  }
  return normalize(cleanConcept || c || "sin-concepto");
}

/** Re-limpia una clave ya calculada (con el formato "concepto|másdatos" o solo texto) por si
 * se generó antes de afinar cleanBankText — para poder migrar patrones guardados sin tener
 * que volver a leer la transacción original. */
export function recleanPattern(pattern: string): string {
  const parts = pattern.split("|");
  if (parts.length === 2) return normalize(`${cleanBankText(parts[0])}|${cleanBankText(parts[1])}`);
  return normalize(cleanBankText(pattern));
}

/** Sugiere un nombre legible a partir de un texto de banco, quitando códigos y referencias
 * que no identifican al contacto: "Spotify P4106A003" → "Spotify", "SXPYDKKK -Stripe
 * Technology Eu" → "Stripe Technology Eu". Conserva siempre al menos una palabra. */
export function cleanContactLabel(s: string): string {
  return cleanBankText(s) || s.trim();
}
