import { createServerClient } from "./supabase";
import type { Sale } from "./sales";

// "La primera clase de los suscriptores": de quien alguna vez se suscribió (Stripe), en qué
// clase entró — desglosado por profesora y por franja horaria. Combina la asistencia real de
// Momence (class_bookings_v2: primera clase asistida de cada persona) con la identificación
// del suscriptor por Stripe. Complementa el gráfico de "primera compra" (embudo de producto)
// con el embudo de experiencia (profesora / franja). Ver [[project-profesoras-v2]].

export type FirstClassBucket = { label: string; count: number; rate: number };

export type SubscriberFirstClassV2 = {
  hasData: boolean;
  totalSubscribers: number; // suscriptores con primera clase registrada en Momence
  matchedRate: number;      // de todos los que se suscribieron, cuántos tienen clase registrada
  byTeacher: FirstClassBucket[];
  byHour: FirstClassBucket[];
};

type Row = {
  member_id: number;
  email: string | null;
  teacher_name: string;
  session_starts_at: string;
};

// Hora de la clase en calendario de Madrid (session_starts_at viene en UTC).
function madridHour(iso: string): number {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date(iso))
    .find((p) => p.type === "hour")!.value;
  return Number(part);
}

const empty: SubscriberFirstClassV2 = { hasData: false, totalSubscribers: 0, matchedRate: 0, byTeacher: [], byHour: [] };

export async function getSubscriberFirstClassV2(sales: Sale[]): Promise<SubscriberFirstClassV2> {
  // Suscriptores = emails que alguna vez pagaron una Suscripción en Stripe (misma población
  // que el gráfico de primera compra).
  const subscriberEmails = new Set<string>();
  for (const s of sales) {
    if (s.category === "Suscripción" && s.email) subscriberEmails.add(s.email.toLowerCase());
  }
  if (subscriberEmails.size === 0) return empty;

  const db = createServerClient();
  // PostgREST corta en 1000 filas; paginamos (class_bookings_v2 supera esa cifra).
  const PAGE = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await db
      .from("class_bookings_v2")
      .select("member_id, email, teacher_name, session_starts_at")
      .eq("checked_in", true)
      .order("session_starts_at", { ascending: true })
      .range(from, from + PAGE - 1);
    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  if (rows.length === 0) return empty;

  // Primera clase asistida por miembro (rows ya viene ordenado ascendente por fecha).
  const firstByMember = new Map<number, Row>();
  for (const r of rows) if (!firstByMember.has(r.member_id)) firstByMember.set(r.member_id, r);

  const byTeacher = new Map<string, number>();
  const byHour = new Map<number, number>();
  let matched = 0;
  for (const r of firstByMember.values()) {
    if (!r.email || !subscriberEmails.has(r.email.toLowerCase())) continue;
    matched += 1;
    byTeacher.set(r.teacher_name, (byTeacher.get(r.teacher_name) ?? 0) + 1);
    const h = madridHour(r.session_starts_at);
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  if (matched === 0) return empty;

  const byTeacherRows: FirstClassBucket[] = [...byTeacher.entries()]
    .map(([label, count]) => ({ label, count, rate: count / matched }))
    .sort((a, b) => b.count - a.count);

  const byHourRows: FirstClassBucket[] = [...byHour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([h, count]) => ({ label: `${String(h).padStart(2, "0")}h`, count, rate: count / matched }));

  return {
    hasData: true,
    totalSubscribers: matched,
    matchedRate: matched / subscriberEmails.size,
    byTeacher: byTeacherRows,
    byHour: byHourRows,
  };
}
