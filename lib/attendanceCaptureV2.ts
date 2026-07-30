import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionsV2, getSessionBookingsV2 } from "./momenceV2";

// Captura de asistencia real (checkedIn) por clase desde la API pública v2 de Momence,
// para class_sessions_v2 + class_bookings_v2 (migración 027). Lo usan el cron rolling
// diario y el backfill. checkedIn solo es definitivo cuando la clase ya ha pasado, así
// que solo capturamos clases ya impartidas. Ver [[project-profesoras-v2]].

// Las reservas se piden clase a clase (N+1); se lanzan en lotes paralelos para caber en
// el maxDuration del cron. Con lotes de 10, ~200 clases ≈ 23s (medido jul 2026).
const BOOKINGS_BATCH = 10;

type SessionListItem = {
  id: number;
  type: string;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  isCancelled: boolean;
  isDraft: boolean;
  teacher: { id: number; firstName: string; lastName: string } | null;
};

function teacherName(t: { firstName: string; lastName: string } | null): string {
  return t ? `${t.firstName} ${t.lastName}`.replace(/\s+/g, " ").trim() : "Sin asignar";
}

export type CaptureResult = { sessions: number; bookings: number };

// Captura las clases fitness ya impartidas en [startAfter, startBefore] y upserta sesiones
// + reservas. Idempotente: para cada sesión recapturada, borra sus reservas y reinserta las
// activas actuales (así una reserva cancelada a posteriori no queda como falso no-show).
export async function captureAttendanceWindow(
  db: SupabaseClient,
  startAfter: string,
  startBefore: string,
): Promise<CaptureResult> {
  const sessions = (await getSessionsV2({ startAfter, startBefore })) as unknown as SessionListItem[];
  const now = Date.now();
  const targets = sessions.filter(
    (s) => s.type === "fitness" && !s.isCancelled && !s.isDraft && Date.parse(s.startsAt) <= now,
  );

  const sessionRows: Record<string, unknown>[] = [];
  const bookingRows: Record<string, unknown>[] = [];
  const capturedAt = new Date().toISOString();

  for (let i = 0; i < targets.length; i += BOOKINGS_BATCH) {
    const chunk = targets.slice(i, i + BOOKINGS_BATCH);
    const results = await Promise.all(
      chunk.map(async (s) => ({
        s,
        bookings: await getSessionBookingsV2(s.id, { includeCancelled: false }),
      })),
    );
    for (const { s, bookings } of results) {
      const tName = teacherName(s.teacher);
      const tId = s.teacher?.id ?? null;
      const checkedIn = bookings.filter((b) => b.checkedIn).length;
      sessionRows.push({
        session_id: s.id,
        starts_at: s.startsAt,
        ends_at: s.endsAt ?? null,
        teacher_id: tId,
        teacher_name: tName,
        type: s.type,
        capacity: s.capacity ?? 0,
        booking_count: bookings.length,
        checked_in_count: checkedIn,
        is_cancelled: false,
        captured_at: capturedAt,
      });
      for (const b of bookings) {
        bookingRows.push({
          booking_id: b.id,
          session_id: s.id,
          session_starts_at: s.startsAt,
          teacher_id: tId,
          teacher_name: tName,
          member_id: b.member.id,
          email: b.member.email ?? null,
          checked_in: b.checkedIn,
          captured_at: capturedAt,
        });
      }
    }
  }

  if (sessionRows.length > 0) {
    const { error } = await db.from("class_sessions_v2").upsert(sessionRows, { onConflict: "session_id" });
    if (error) throw new Error(`class_sessions_v2 upsert: ${error.message}`);

    // Reemplaza las reservas de las sesiones tocadas (borra + inserta) para reflejar el
    // estado actual sin dejar reservas obsoletas de una captura anterior.
    const sessionIds = sessionRows.map((r) => r.session_id as number);
    const { error: delError } = await db.from("class_bookings_v2").delete().in("session_id", sessionIds);
    if (delError) throw new Error(`class_bookings_v2 delete: ${delError.message}`);
    if (bookingRows.length > 0) {
      const { error: insError } = await db.from("class_bookings_v2").insert(bookingRows);
      if (insError) throw new Error(`class_bookings_v2 insert: ${insError.message}`);
    }
  }

  return { sessions: sessionRows.length, bookings: bookingRows.length };
}
