"use server";
import { getMemberNotesV2, type MomenceV2MemberNote } from "@/lib/momenceV2";

// Notas CRM de Momence, cargadas bajo demanda al abrir la ficha del cliente (no en la carga
// general de Clientes: son N+1 y casi nadie tiene notas hoy, así que cargar las de todo el
// censo en cada visita sería coste sin beneficio).
export async function getMemberNotesAction(memberId: number): Promise<MomenceV2MemberNote[]> {
  return getMemberNotesV2(memberId).catch(() => []);
}
