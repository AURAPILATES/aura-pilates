"use server";
import { getSessionBookingsV2, type MomenceV2SessionBooking } from "@/lib/momenceV2";

// Reservas de una clase (quién viene, si hizo check-in), cargadas bajo demanda al abrir el
// detalle de una clase en Horario — igual que las notas CRM: es N+1 por sesión, así que no
// se precarga para toda la semana.
export async function getSessionBookingsAction(sessionId: number): Promise<MomenceV2SessionBooking[]> {
  return getSessionBookingsV2(sessionId).catch(() => []);
}
