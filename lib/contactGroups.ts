import { normalizeText } from "./normalizeText";

export type ContactGroup = "proveedor" | "instructor" | "socio";

export const CONTACT_GROUP_ORDER: ContactGroup[] = ["proveedor", "instructor", "socio"];

export const CONTACT_GROUP_LABELS: Record<ContactGroup, string> = {
  proveedor: "Proveedores",
  instructor: "Instructores",
  socio: "Socios",
};

// Nombres conocidos que se clasifican solos si el contacto no tiene grupo fijado a mano.
const INSTRUCTOR_NAMES = ["gisele", "zuzana", "ursula", "yuruani"];
const SOCIO_NAMES = ["victor", "carles", "olga", "celia"];

function isGroup(v: unknown): v is ContactGroup {
  return v === "proveedor" || v === "instructor" || v === "socio";
}

/** ¿Aparece `word` como palabra completa en el nombre? Por palabras, no por subcadena de
 * caracteres - así un proveedor que se llame, p. ej., "Óptica Víctor" no se clasifica como
 * socio solo porque "victor" aparece dentro del texto. */
function hasWord(label: string, word: string): boolean {
  return normalizeText(label).split(/[^a-z0-9]+/).includes(word);
}

/** Grupo del contacto: el fijado a mano si existe; si no, se deduce del nombre (instructores
 * y socios conocidos van a su grupo, el resto a proveedores). */
export function contactGroupOf(label: string, group?: string | null): ContactGroup {
  if (isGroup(group)) return group;
  if (INSTRUCTOR_NAMES.some((name) => hasWord(label, name))) return "instructor";
  if (SOCIO_NAMES.some((name) => hasWord(label, name))) return "socio";
  return "proveedor";
}
