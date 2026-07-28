/** Una cadena es "de referencia" (número de operación, parte de un IBAN, etc.) si la mayoría
 * de sus caracteres no son letras - no identifica a un contacto real, así que agruparía mal
 * (cada movimiento traería un número distinto en "Más datos": PAGO TRASPASOS, TGSS.COTIZACION...). */
export function isReferenceLike(s: string): boolean {
  const clean = s.replace(/[\s-]/g, "");
  if (!clean) return true;
  const digits = clean.replace(/[^0-9]/g, "").length;
  return digits / clean.length > 0.5;
}

/** Un token "parece un código" (de operación, de transferencia, de factura...) si es mayoría
 * dígitos, si es un bloque de mayúsculas sin vocales, o si mezcla letras y números (ej.
 * "WORKSPÑ2386", "HYVEDEMM488") - ese patrón no aparece en palabras o nombres reales, solo en
 * identificadores que el banco genera por movimiento y que cambian aunque sea siempre el mismo
 * contacto. */
function looksLikeCode(word: string): boolean {
  const w = word.replace(/[.,]/g, "");
  if (!w) return true;
  if (isReferenceLike(w)) return true;
  if (w.length >= 6 && w === w.toUpperCase() && !/[aeiouáéíóú]/i.test(w)) return true;
  return w.length >= 6 && /[0-9]/.test(w) && /[a-záéíóúñ]/i.test(w);
}

/** Sufijos genéricos de forma jurídica o términos bancarios que el extracto añade pero que no
 * identifican al contacto (GmbH, S.L., "client"...). No es identificación de empresa, solo ruido
 * a quitar antes de guardar el patrón de coincidencia. */
export const NOISE_WORDS = new Set([
  "gmbh", "ltd", "inc", "llc", "corp", "plc", "srl", "kg", "ag", "nv", "bv", "co",
  "sl", "sa", "slu", "sau", "sll", "scp",
  "client", "cliente", "clientes", "sucursal",
]);

function isNoiseWord(word: string): boolean {
  return NOISE_WORDS.has(word.replace(/[.,]/g, "").toLowerCase());
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Quita de un texto de banco los tokens que "parecen un código" (ver looksLikeCode) o que son
 * ruido genérico de forma jurídica (ver NOISE_WORDS), dejando solo lo que identifica de forma
 * estable a un contacto - así dos movimientos del mismo contacto con referencias distintas
 * ("SXPYDKKK", "QWERTYZZ"...) producen el mismo resultado. Si no queda ninguna palabra
 * reconocible, devuelve el texto original sin tocar. */
export function cleanBankText(s: string | null | undefined): string {
  if (!s) return "";
  const words = s.trim().replace(/[,\-–—*]/g, " ").split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !looksLikeCode(w) && !isNoiseWord(w));
  return (kept.length ? kept : words).join(" ");
}

function tokenize(s: string): string[] {
  return normalize(s).match(/[a-z0-9áéíóúñ]+/gi) ?? [];
}

/** ¿Aparece `pattern` como subsecuencia contigua de palabras dentro de `text`? Permite que un
 * "Concepto bancario" guardado más corto que el texto real del banco (ej. el contacto se editó
 * a mano de "Stripe Technology Eu" a "Stripe") siga reconociendo el mismo contacto en futuros
 * movimientos, en lugar de exigir igualdad exacta. */
export function matchesPattern(text: string, pattern: string): boolean {
  const p = tokenize(pattern);
  if (p.length === 0) return false;
  const t = tokenize(text);
  for (let i = 0; i + p.length <= t.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) {
      if (t[i + j] !== p[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
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
 * se generó antes de afinar cleanBankText - para poder migrar patrones guardados sin tener
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

const STOPWORDS = new Set(["de", "del", "la", "el", "los", "las", "y", "i", "en", "a", "al", "con"]);

/** Descripciones bancarias genéricas que se repiten en muchos contactos distintos y por tanto
 * no identifican a ninguno en particular (ej. "Recibo de suministros", "Recibos varios",
 * "Transfer. en div."). Sirve para no escoger esta parte del movimiento como nombre/patrón. */
const GENERIC_WORDS = new Set([
  "recibo", "recibos", "varios", "varias", "suministros", "transferencia", "transferencias",
  "transfer", "transf", "favor", "bizum", "pago", "pagos", "compra", "compras", "abono",
  "abonos", "ingreso", "ingresos", "domiciliacion", "adeudo", "adeudos", "traspaso",
  "traspasos", "nomina", "cuota", "cuotas", "liquidacion", "comision", "comisiones",
  "intereses", "devolucion", "devoluciones", "operacion", "operaciones", "movimiento", "div",
  "client", "cliente", "clientes",
]);

function isGenericLabel(s: string): boolean {
  const tokens = tokenize(s).filter((t) => !STOPWORDS.has(t));
  if (tokens.length === 0) return true;
  return tokens.every((t) => GENERIC_WORDS.has(t));
}

/** ¿El texto entero es solo un código de banco (referencia de operación, IBAN parcial...) sin
 * ninguna palabra que identifique al contacto? Ej. "PRES.32611770812". No sirve como nombre de
 * contacto aunque no esté en GENERIC_WORDS (esa lista es de palabras genéricas, no de códigos). */
function isCodeOnly(s: string): boolean {
  const words = s.trim().replace(/[,\-–—*]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => looksLikeCode(w) || isNoiseWord(w));
}

/** Decide cuál de "concepto" o "más datos" identifica mejor al contacto real. En
 * transferencias suele ser "más datos" (ej. "SXPYDKKK -Stripe Technology Eu"); en recibos o
 * domiciliaciones suele ser el concepto (ej. "IBERDROLA CLIENT.") y "más datos" es solo una
 * descripción genérica que se repite igual para contactos distintos ("Recibo de suministros",
 * "Recibos varios"). Prioriza el que no sea genérico ni un código puro (ej. "PRES.32611770812",
 * que el banco ya guarda como concepto bancario y no debe sugerirse como nombre). */
export function pickIdentifyingText(concept: string | null, bankDetails: string | null): string {
  const c = concept?.trim() || "";
  const b = bankDetails?.trim() || "";
  if (b && !isGenericLabel(b) && !isCodeOnly(b)) return b;
  if (c && !isGenericLabel(c) && !isCodeOnly(c)) return c;
  return b || c;
}
