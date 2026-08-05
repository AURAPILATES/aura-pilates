import type { Sale } from "./sales";
import { fetchCheckedInFirstClassRows } from "./firstClassBookingsV2";

// Conversión por profesora: de las personas cuya PRIMERA clase asistida (checkedIn) fue con
// una profesora, ¿cuántas "volvieron a pagar" después? Combina dos fuentes:
//   - Momence v2 (class_bookings_v2): quién dio a cada persona su primera clase.
//   - Stripe (ventas): si esa persona pagó luego una suscripción o un pack.
// Definición de "convirtió" elegida por Julia: volvió a pagar una suscripción o un pack
// (la Benvinguda es la puerta de entrada, no cuenta como conversión). Ver [[project-profesoras-v2]].

export type TeacherFirstTimer = {
  memberId: number;
  email: string | null;
  name: string | null;
  date: string;
  converted: boolean;
};

export type TeacherConversionRow = {
  teacher: string;
  firstTimers: number; // personas cuya 1ª clase (checkedIn) fue con esta profesora
  converted: number;   // de esas, cuántas pagaron luego una sub o un pack
  rate: number;        // converted / firstTimers
  /** Detalle de a quién dio la 1ª clase, para el drawer al clicar la fila. */
  people: TeacherFirstTimer[];
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

// ¿Es una venta que cuenta como "volver a pagar"? Suscripción, o un pack que no sea la
// Benvinguda de entrada (ni una clase suelta, que es otra vía de entrada).
function isConvertingSale(s: Sale): boolean {
  if (s.category === "Suscripción") return true;
  if (s.category === "Paquete" && s.item !== "Benvinguda 2x1") return true;
  return false;
}

export async function getTeacherConversionV2(sales: Sale[]): Promise<TeacherConversionV2> {
  const rows = await fetchCheckedInFirstClassRows();

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

  // Fechas de compras "de conversión" por email, set de emails con cualquier venta (para
  // matchedRate) y nombre por email (las reservas de Momence no traen nombre, solo email).
  const convertingDatesByEmail = new Map<string, string[]>();
  const emailsWithAnySale = new Set<string>();
  const nameByEmail = new Map<string, string>();
  for (const s of sales) {
    if (!s.email) continue;
    const email = s.email.toLowerCase();
    emailsWithAnySale.add(email);
    if (s.name && !nameByEmail.has(email)) nameByEmail.set(email, s.name);
    if (!isConvertingSale(s)) continue;
    const arr = convertingDatesByEmail.get(email) ?? [];
    arr.push(s.paymentDate);
    convertingDatesByEmail.set(email, arr);
  }

  const perTeacher = new Map<string, { firstTimers: number; converted: number; people: TeacherFirstTimer[] }>();
  let matched = 0;
  for (const [memberId, { email, teacher, date }] of firstByMember.entries()) {
    const acc = perTeacher.get(teacher) ?? { firstTimers: 0, converted: 0, people: [] };
    acc.firstTimers += 1;
    if (email && emailsWithAnySale.has(email)) matched += 1;
    // Convirtió si pagó una sub/pack ESTRICTAMENTE después de su primera clase.
    const converted = !!email && (convertingDatesByEmail.get(email) ?? []).some((d) => d > date);
    if (converted) acc.converted += 1;
    acc.people.push({ memberId, email, name: (email && nameByEmail.get(email)) ?? null, date, converted });
    perTeacher.set(teacher, acc);
  }

  const conversionRows: TeacherConversionRow[] = [...perTeacher.entries()]
    .map(([teacher, a]) => ({
      teacher,
      firstTimers: a.firstTimers,
      converted: a.converted,
      rate: a.firstTimers > 0 ? a.converted / a.firstTimers : 0,
      people: a.people.sort((x, y) => y.date.localeCompare(x.date)),
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
