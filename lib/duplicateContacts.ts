import { normalizeText } from "./normalizeText";
import { NOISE_WORDS } from "./contactRules";

/** Palabras significativas de un nombre (sin acentos/mayúsculas, sin sufijos genéricos de
 * forma jurídica como "SL"/"SA" ni palabras de 1 letra), para comparar nombres por contenido
 * en vez de carácter a carácter. */
function nameTokens(label: string): string[] {
  return normalizeText(label)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !NOISE_WORDS.has(w));
}

/** ¿Dos nombres de contacto parecen la misma persona/empresa? Coincidencia exacta tras
 * normalizar, uno contiene literalmente al otro (ej. "Iberdrola" y "Iberdrola Clientes"), o
 * comparten la mayoría de sus palabras significativas (ej. "Stripe Technology Eu" y "Stripe
 * Technology Europe Limited"). */
export function namesLookAlike(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const na = ta.join(" ");
  const nb = tb.join(" ");
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
  const sa = new Set(ta);
  const sb = new Set(tb);
  const shared = [...sa].filter((t) => sb.has(t) && t.length >= 3);
  if (shared.length === 0) return false;
  return shared.length / Math.min(sa.size, sb.size) >= 0.6;
}

/** Cada "parte" de un patrón de contacto (los patrones pueden ir en formato "concepto|más
 * datos"), normalizada y sin fragmentos demasiado cortos para comparar con fiabilidad. */
function patternParts(pattern: string): string[] {
  return pattern
    .split("|")
    .map((p) => normalizeText(p).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 4);
}

/** ¿Comparten algún concepto bancario dos contactos (mismo texto, o uno contiene al otro)? Si
 * es así, los movimientos de ambos podrían estar reconociendo a la misma entidad real. */
export function patternsOverlap(a: string[], b: string[]): boolean {
  const partsA = a.flatMap(patternParts);
  const partsB = b.flatMap(patternParts);
  return partsA.some((pa) => partsB.some((pb) => pa === pb || pa.includes(pb) || pb.includes(pa)));
}

export type DuplicateReason = "name" | "pattern";
export type DuplicatePair = { aId: number; bId: number; reason: DuplicateReason };

/** Clave canónica de un par de contactos (id menor primero), para deduplicar pares y
 * persistir descartes sin importar en qué orden se detectaron. */
export function duplicateKey(idA: number, idB: number): string {
  return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
}

/** Todos los pares de contactos que parecen duplicados entre sí, por nombre parecido o por
 * compartir algún concepto bancario. O(n²) sobre la lista de contactos - aceptable para el
 * volumen manejado en Configuración > Contactos. */
export function findDuplicatePairs(
  contacts: { id: number; label: string; patterns: string[] }[],
): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      const a = contacts[i];
      const b = contacts[j];
      if (namesLookAlike(a.label, b.label)) pairs.push({ aId: a.id, bId: b.id, reason: "name" });
      else if (patternsOverlap(a.patterns, b.patterns)) pairs.push({ aId: a.id, bId: b.id, reason: "pattern" });
    }
  }
  return pairs;
}
