import { createServerClient } from "@/lib/supabase";

export type EventCategoria = "precios" | "horarios" | "promociones" | "operativo" | "otro";

export interface BusinessEvent {
  id: string;
  fecha: string;
  categoria: EventCategoria;
  titulo: string;
  descripcion: string | null;
  created_at: string;
}

export async function loadBusinessEvents(): Promise<BusinessEvent[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("business_events")
    .select("*")
    .order("fecha", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
