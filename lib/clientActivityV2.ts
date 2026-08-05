import { unstable_cache } from "next/cache";
import { createServerClient } from "./supabase";
import { getMembersV2 } from "./momenceV2";
import { rateForDate, type UrbanRate } from "./urbanRates";

// Actividad de clientes desde la asistencia real de Momence (class_bookings_v2), con un flag
// de "sin pago detectado": personas que han asistido a clase (checkedIn) pero de las que no
// encontramos ningún pago — ni en Stripe ni como membresía/pack en Momence. Es lo más cercano
// a "clases gratis" que permiten los datos (Momence no expone el precio por clase).
//
// AVISO de método: quien paga solo en efectivo o entra por Urban Sports Club puede no dejar
// rastro en Stripe ni en las membresías, así que "sin pago detectado" hay que revisarlo antes
// de actuar (puede ser cortesía real, o un pago que no vemos). Ver [[project-profesoras-v2]].

// paid = rastro de pago (Stripe o membresía/pack de Momence); urban = entra por Urban Sports
// Club (paga vía Urban, no gratis); none = asistió sin rastro de pago = el cohorte "gratis".
export type Coverage = "paid" | "urban" | "none";

export type ClientActivityRow = {
  memberId: number;
  name: string;
  email: string | null;
  attended: number;       // clases asistidas (checkedIn)
  noShows: number;        // reservas sin aparecer
  firstDate: string | null;   // fecha de su 1ª clase asistida (YYYY-MM-DD)
  firstTeacher: string | null;
  lastDate: string | null;    // fecha de su última clase asistida
  coverage: Coverage;
};

export type ClientActivityV2 = {
  hasData: boolean;
  rows: ClientActivityRow[];
  totalWithAttendance: number;
  freeCount: number;        // clientes sin pago detectado (coverage none)
  freeClasses: number;      // suma de clases asistidas por esos clientes
};

// Los miembros de Urban Sports Club llegan con un email del dominio de Urban; pagan vía Urban
// (Aura cobra por transferencia), así que NO son clases gratis.
function isUrbanEmail(email: string | null): boolean {
  return !!email && email.toLowerCase().includes("urbansportsclub.com");
}

type BookingRow = {
  member_id: number;
  email: string | null;
  teacher_name: string;
  session_starts_at: string;
  checked_in: boolean;
};

// Lee todas las filas de una tabla paginando (PostgREST corta en 1000).
async function readAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

export async function getClientActivityV2(paidEmails: Set<string>): Promise<ClientActivityV2> {
  const db = createServerClient();

  const bookings = await readAll<BookingRow>((from, to) =>
    db
      .from("class_bookings_v2")
      .select("member_id, email, teacher_name, session_starts_at, checked_in")
      .order("session_starts_at", { ascending: true })
      .range(from, to),
  );
  if (bookings.length === 0) {
    return { hasData: false, rows: [], totalWithAttendance: 0, freeCount: 0, freeClasses: 0 };
  }

  // Emails que han tenido alguna membresía/pack en Momence (cualquier fecha de snapshot).
  const snapshotRows = await readAll<{ email: string }>((from, to) =>
    db.from("subscriber_snapshots_v2").select("email").range(from, to),
  );
  const membershipEmails = new Set(snapshotRows.map((r) => r.email.toLowerCase()));

  // Nombres reales desde Momence (la reserva solo guarda member_id + email).
  const members = await getMembersV2().catch(() => []);
  const nameById = new Map<number, string>();
  for (const m of members) {
    nameById.set(m.id, `${m.firstName} ${m.lastName}`.replace(/\s+/g, " ").trim());
  }

  type Acc = { email: string | null; attended: number; noShows: number; firstDate: string | null; firstTeacher: string | null; lastDate: string | null };
  const byMember = new Map<number, Acc>();
  for (const b of bookings) {
    const acc = byMember.get(b.member_id) ?? { email: b.email, attended: 0, noShows: 0, firstDate: null, firstTeacher: null, lastDate: null };
    if (b.email && !acc.email) acc.email = b.email;
    const date = b.session_starts_at.slice(0, 10);
    if (b.checked_in) {
      acc.attended += 1;
      // bookings viene ordenado ascendente: la primera checkedIn que veamos es la 1ª clase.
      if (!acc.firstDate) {
        acc.firstDate = date;
        acc.firstTeacher = b.teacher_name;
      }
      acc.lastDate = date; // última al recorrer en orden ascendente
    } else {
      acc.noShows += 1;
    }
    byMember.set(b.member_id, acc);
  }

  const rows: ClientActivityRow[] = [];
  for (const [memberId, a] of byMember.entries()) {
    if (a.attended === 0) continue; // solo clientes que han pisado una clase
    const email = a.email ? a.email.toLowerCase() : null;
    const coverage: Coverage = isUrbanEmail(a.email)
      ? "urban"
      : !!email && (paidEmails.has(email) || membershipEmails.has(email))
        ? "paid"
        : "none";
    rows.push({
      memberId,
      name: nameById.get(memberId) ?? a.email ?? `Cliente ${memberId}`,
      email: a.email,
      attended: a.attended,
      noShows: a.noShows,
      firstDate: a.firstDate,
      firstTeacher: a.firstTeacher,
      lastDate: a.lastDate,
      coverage,
    });
  }
  rows.sort((x, y) => y.attended - x.attended);

  const freeRows = rows.filter((r) => r.coverage === "none");
  return {
    hasData: true,
    rows,
    totalWithAttendance: rows.length,
    freeCount: freeRows.length,
    freeClasses: freeRows.reduce((s, r) => s + r.attended, 0),
  };
}

// Actividad de Urban Sports Club por mes ("YYYY-MM"), desde la asistencia real capturada en
// class_bookings_v2 (Momence v2). Es una señal EN VIVO del mes en curso, útil antes de que
// llegue la transferencia del banco (que es la única fuente del dinero REAL de Urban).
//   classes   = nº de clases asistidas (check-ins). Solo cuenta asistió, no no-shows.
//   estimated = € estimado = suma de la tarifa pactada vigente en la fecha de cada clase
//               (ver lib/urbanRates). No es el cobro real: Momence no expone lo que Urban paga.
// Si una clase cae fuera de toda tarifa, suma a `classes` pero no a `estimated`.
export type UrbanMonthActivity = { classes: number; estimated: number };

// Cacheado (30 min, invalidable con el botón de sincronizar): esta lectura completa de
// class_bookings_v2 se repetía en cada carga de Analítica sin caché.
const fetchAllBookingsForUrban = unstable_cache(
  async (): Promise<{ email: string | null; session_starts_at: string; checked_in: boolean }[]> => {
    const db = createServerClient();
    return readAll<{ email: string | null; session_starts_at: string; checked_in: boolean }>((from, to) =>
      db.from("class_bookings_v2").select("email, session_starts_at, checked_in").range(from, to),
    );
  },
  ["urban-activity-bookings-v2"],
  { revalidate: 1800, tags: ["momence"] },
);

export async function urbanActivityByMonth(
  rates: UrbanRate[] = [],
): Promise<Map<string, UrbanMonthActivity>> {
  const bookings = await fetchAllBookingsForUrban();
  const byMonth = new Map<string, UrbanMonthActivity>();
  for (const b of bookings) {
    if (!b.checked_in || !isUrbanEmail(b.email)) continue;
    const m = b.session_starts_at.slice(0, 7);
    const acc = byMonth.get(m) ?? { classes: 0, estimated: 0 };
    acc.classes += 1;
    const rate = rateForDate(rates, b.session_starts_at);
    if (rate != null) acc.estimated += rate;
    byMonth.set(m, acc);
  }
  return byMonth;
}
