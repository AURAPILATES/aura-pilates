import { createServerClient } from "@/lib/supabase";
import festivosData from "@/data/vacaciones.json";

export type AbsenceKey = "vacaciones" | "enfermedad" | "familiar" | "otros";

export type Persona = {
  id: string;
  nombre: string;
  inicioContrato: string;
  jornadaDias: number;
  diasTotales: number;
  vacaciones: string[];
  enfermedad: string[];
  familiar: string[];
  otros: string[];
};

type PersonaRow = {
  id: string;
  nombre: string;
  inicio_contrato: string;
  jornada_dias: number;
  dias_totales: number;
  archived: boolean;
};

type AusenciaRow = {
  persona_id: string;
  tipo: string;
  fecha: string;
};

export async function loadPersonas(): Promise<{ personas: Persona[]; festivos: string[] }> {
  const supabase = createServerClient();

  const [{ data: rows, error: pErr }, { data: aus, error: aErr }] = await Promise.all([
    supabase
      .from("personas")
      .select("id, nombre, inicio_contrato, jornada_dias, dias_totales")
      .eq("archived", false)
      .order("nombre"),
    supabase
      .from("ausencias")
      .select("persona_id, tipo, fecha"),
  ]);

  if (pErr) throw pErr;
  if (aErr) throw aErr;

  const personas: Persona[] = (rows as PersonaRow[] ?? []).map((p) => {
    const pa = (aus as AusenciaRow[] ?? []).filter((a) => a.persona_id === p.id);
    const byType = (t: string) => pa.filter((a) => a.tipo === t).map((a) => a.fecha).sort();
    return {
      id: p.id,
      nombre: p.nombre,
      inicioContrato: p.inicio_contrato,
      jornadaDias: p.jornada_dias,
      diasTotales: p.dias_totales,
      vacaciones: byType("vacaciones"),
      enfermedad: byType("enfermedad"),
      familiar: byType("familiar"),
      otros: byType("otros"),
    };
  });

  return { personas, festivos: festivosData.festivos };
}
