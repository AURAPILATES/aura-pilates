/** Una cadena es "de referencia" (número de operación, parte de un IBAN, etc.) si la mayoría
 * de sus caracteres no son letras — no identifica a un contacto real, así que agruparía mal
 * (cada movimiento traería un número distinto en "Más datos": PAGO TRASPASOS, TGSS.COTIZACION...). */
export function isReferenceLike(s: string): boolean {
  const clean = s.replace(/[\s-]/g, "");
  if (!clean) return true;
  const digits = clean.replace(/[^0-9]/g, "").length;
  return digits / clean.length >= 0.5;
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Clave de agrupación de un movimiento: el contacto real ("Más datos") cuando identifica a
 * alguien (empresa, persona), o el concepto genérico del banco cuando el contacto es solo una
 * referencia numérica o está vacío. Así "TRANSFER. EN DIV." + Stripe y + Urban Sports quedan
 * separados, pero las distintas referencias de "PAGO TRASPASOS" caen en una sola clave. */
export function contactKeyFor(concept: string | null, contact: string | null): string {
  const c = contact?.trim();
  if (c && !isReferenceLike(c)) return normalize(`${concept ?? ""}|${c}`);
  return normalize(concept?.trim() || c || "sin-concepto");
}

/** Sugiere un nombre legible a partir de un texto de banco, quitando palabras finales de
 * referencia (números de operación, códigos de factura...) que no identifican al contacto:
 * "Spotify P4106A003" → "Spotify". Conserva siempre al menos una palabra. */
export function cleanContactLabel(s: string): string {
  const words = s.trim().replace(/,/g, " ").split(/\s+/).filter(Boolean);
  while (words.length > 1 && isReferenceLike(words[words.length - 1])) {
    words.pop();
  }
  return words.join(" ") || s.trim();
}
