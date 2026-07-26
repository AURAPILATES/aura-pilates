/** Normaliza texto para búsquedas: minúsculas y sin acentos/diacríticos, para que
 * "José", "jose" y "JOSE" (o "María"/"maria", "año"/"ano") coincidan por igual.
 * Se usa en todas las barras de búsqueda para que acentos y mayúsculas no afecten. */
export function normalizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
