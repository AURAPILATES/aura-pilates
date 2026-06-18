"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import type { EventCategoria } from "@/lib/businessEvents";

export interface EventInput {
  fecha: string;
  categoria: EventCategoria;
  titulo: string;
  descripcion: string | null;
}

export async function createBusinessEvent(data: EventInput) {
  const supabase = createServerClient();
  const { error } = await supabase.from("business_events").insert(data);
  if (error) throw new Error(error.message);
  revalidatePath("/historial");
}

export async function updateBusinessEvent(id: string, data: EventInput) {
  const supabase = createServerClient();
  const { error } = await supabase.from("business_events").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/historial");
}

export async function deleteBusinessEvent(id: string) {
  const supabase = createServerClient();
  const { error } = await supabase.from("business_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/historial");
}
