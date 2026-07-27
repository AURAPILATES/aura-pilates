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

/** Grupo del contacto: el fijado a mano si existe; si no, se deduce del nombre (instructores
 * y socios conocidos van a su grupo, el resto a proveedores). */
export function contactGroupOf(label: string, group?: string | null): ContactGroup {
  if (isGroup(group)) return group;
  const n = normalizeText(label);
  if (INSTRUCTOR_NAMES.some((name) => n.includes(name))) return "instructor";
  if (SOCIO_NAMES.some((name) => n.includes(name))) return "socio";
  return "proveedor";
}
