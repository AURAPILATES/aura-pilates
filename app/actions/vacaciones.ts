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

export async function archivePersonaAction(id: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("personas")
    .update({ archived: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vacaciones");
}
