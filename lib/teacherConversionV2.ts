import { createServerClient } from "./supabase";
import type { Sale } from "./sales";

// Conversión por profesora: de las personas cuya PRIMERA clase asistida (checkedIn) fue con
// una profesora, ¿cuántas "volvieron a pagar" después? Combina dos fuentes:
//   - Momence v2 (class_bookings_v2): quién dio a cada persona su primera clase.
//   - Stripe (ventas): si esa persona pagó luego una suscripción o un pack.
// Definición de "convirtió" elegida por Julia: volvió a pagar una suscripción o un pack
// (la Benvinguda es la puerta de entrada, no cuenta como conversión). Ver [[project-profesoras-v2]].

export type TeacherConversionRow = {
  teacher: string;
  firstTimers: number; // personas cuya 1ª clase (checkedIn) fue con esta profesora
  converted: number;   // de esas, cuántas pagaron luego una sub o un pack
  rate: number;        // converted / firstTimers
};

export type TeacherConversionV2 = {
  hasData: boolean;
  rows: TeacherConversionRow[];
  totalFirstTimers: number;
  totalConverted: number;
  rate: number;
  // % de primeras-clases cuyo email se pudo cruzar con alguna venta de Stripe. Si es bajo,
  // las tasas son conservadoras (un email sin cruzar solo puede contar como "no convirtió").
  matchedRate: number;
};

type FirstClassRow = {
  member_id: number;
  email: string | null;
  teacher_name: string;
  session_starts_at: string;
};

// ¿Es una venta que cuenta como "volver a pagar"? Suscripción, o un pack que no sea la
// Benvinguda de entrada (ni una clase suelta, que es otra vía de entrada).
function isConvertingSale(s: Sale): boolean {
  if (s.category === "Suscripción") return true;
  if (s.category === "Paquete" && s.item !== "Benvinguda 2x1") return true;
  return false;
}

export async function getTeacherConversionV2(sales: Sale[]): Promise<TeacherConversionV2> {
  const db = createServerClient();
  // PostgREST corta las lecturas en 1000 filas; class_bookings_v2 ya supera eso (>2000),
  // así que paginamos con range() hasta agotar. Sin esto, se perderían las reservas más
  // recientes y la conversión quedaría infravalorada.
  const PAGE = 1000;
  const rows: FirstClassRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await db
      .from("class_bookings_v2")
      .select("member_id, email, teacher_name, session_starts_at")
      .eq("checked_in", true)
      .order("session_starts_at", { ascending: true })
      .range(from, from + PAGE - 1);
    const batch = (data ?? []) as FirstClassRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }

  if (rows.length === 0) {
    return { hasData: false, rows: [], totalFirstTimers: 0, totalConverted: 0, rate: 0, matchedRate: 0 };
  }

  // Primera clase asistida por miembro (rows ya viene ordenado ascendente por fecha).
  const firstByMember = new Map<number, { email: string | null; teacher: string; date: string }>();
  for (const r of rows) {
    if (firstByMember.has(r.member_id)) continue;
    firstByMember.set(r.member_id, {
      email: r.email ? r.email.toLowerCase() : null,
      teacher: r.teacher_name,
      date: r.session_starts_at.slice(0, 10),
    });
  }

  // Fechas de compras "de conversión" por email, y set de emails con cualquier venta (para matchedRate).
  const convertingDatesByEmail = new Map<string, string[]>();
  const emailsWithAnySale = new Set<string>();
  for (const s of sales) {
    if (!s.email) continue;
    const email = s.email.toLowerCase();
    emailsWithAnySale.add(email);
    if (!isConvertingSale(s)) continue;
    const arr = convertingDatesByEmail.get(email) ?? [];
    arr.push(s.paymentDate);
    convertingDatesByEmail.set(email, arr);
  }

  const perTeacher = new Map<string, { firstTimers: number; converted: number }>();
  let matched = 0;
  for (const { email, teacher, date } of firstByMember.values()) {
    const acc = perTeacher.get(teacher) ?? { firstTimers: 0, converted: 0 };
    acc.firstTimers += 1;
    if (email && emailsWithAnySale.has(email)) matched += 1;
    // Convirtió si pagó una sub/pack ESTRICTAMENTE después de su primera clase.
    const converted = !!email && (convertingDatesByEmail.get(email) ?? []).some((d) => d > date);
    if (converted) acc.converted += 1;
    perTeacher.set(teacher, acc);
  }

  const conversionRows: TeacherConversionRow[] = [...perTeacher.entries()]
    .map(([teacher, a]) => ({
      teacher,
      firstTimers: a.firstTimers,
      converted: a.converted,
      rate: a.firstTimers > 0 ? a.converted / a.firstTimers : 0,
    }))
    .sort((x, y) => y.firstTimers - x.firstTimers || y.rate - x.rate);

  const totalFirstTimers = conversionRows.reduce((s, r) => s + r.firstTimers, 0);
  const totalConverted = conversionRows.reduce((s, r) => s + r.converted, 0);

  return {
    hasData: true,
    rows: conversionRows,
    totalFirstTimers,
    totalConverted,
    rate: totalFirstTimers > 0 ? totalConverted / totalFirstTimers : 0,
    matchedRate: totalFirstTimers > 0 ? matched / totalFirstTimers : 0,
  };
}
