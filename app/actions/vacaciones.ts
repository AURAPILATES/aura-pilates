"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function addAusenciasAction(personaId: string, tipo: string, dates: string[]) {
  const supabase = createServerClient();
  const rows = dates.map((fecha) => ({ persona_id: personaId, tipo, fecha }));
  const { error } = await supabase
    .from("ausencias")
    .upsert(rows, { onConflict: "persona_id,tipo,fecha" });
  if (error) throw new Error(error.message);
  revalidatePath("/vacaciones");
}

export async function removeAusenciasAction(
  personaId: string,
  tipo: string,
  start: string,
  end: string
) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("ausencias")
    .delete()
    .eq("persona_id", personaId)
    .eq("tipo", tipo)
    .gte("fecha", start)
    .lte("fecha", end);
  if (error) throw new Error(error.message);
  revalidatePath("/vacaciones");
}

export async function createPersonaAction(data: {
  nombre: string;
  inicio_contrato: string;
  jornada_dias: number;
  dias_totales: number;
}) {
  const supabase = createServerClient();
  const { error } = await supabase.from("personas").insert(data);
  if (error) throw new Error(error.message);
  revalidatePath("/vacaciones");
}

export async function updatePersonaDiasExtraAction(id: string, diasExtra: number) {
  const supabase = createServerClient();
  const value = Math.max(0, Math.round(diasExtra));
  const { error } = await supabase
    .from("personas")
    .update({ dias_extra: value })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vacaciones");
}

export async function archivePersonaAction(id: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("personas")
    .update({ archived: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vacaciones");
}

export async function deletePersonaAction(id: string) {
  const supabase = createServerClient();
  // Borrar ausencias primero (FK), luego la persona
  await supabase.from("ausencias").delete().eq("persona_id", id);
  const { error } = await supabase.from("personas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vacaciones");
}

export async function unarchivePersonaAction(id: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("personas")
    .update({ archived: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vacaciones");
}

export async function loadArchivedPersonasAction(): Promise<{ id: string; nombre: string; inicio_contrato: string; dias_totales: number }[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("personas")
    .select("id, nombre, inicio_contrato, dias_totales")
    .eq("archived", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}
