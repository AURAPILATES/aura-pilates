import { NextResponse } from "next/server";
import { getSessionsV2, getSessionDetailV2, getSessionBookingsV2 } from "@/lib/momenceV2";

export const dynamic = "force-dynamic";

// Ruta de verificación de la API v2 de Momence. Abrila en el navegador
// (/api/momence-v2-probe) tras poner MOMENCE_CLIENT_ID / _SECRET / _USERNAME /
// _PASSWORD en .env.local. Confirma auth + sesiones + reservas por clase.
// Enmascara los emails para no volcar datos personales en claro.
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

export async function GET() {
  try {
    const now = Date.now();
    const startAfter = new Date(now - 14 * 24 * 3600_000).toISOString();
    const startBefore = new Date(now + 24 * 3600_000).toISOString();

    const sessions = await getSessionsV2({ startAfter, startBefore });

    // Busca la primera sesión con reservas para mostrar un ejemplo real.
    let sample: unknown = null;
    for (const s of sessions.slice(0, 20)) {
      const bookings = await getSessionBookingsV2(s.id, { includeCancelled: true });
      if (bookings.length > 0) {
        const detail = await getSessionDetailV2(s.id);
        sample = {
          session: { id: s.id, name: s.name, type: s.type, startsAt: detail.startsAt },
          capacity: detail.capacity,
          bookingCount: detail.bookingCount,
          teacher: detail.teacher ? `${detail.teacher.firstName} ${detail.teacher.lastName}` : null,
          bookings: bookings.map((b) => ({
            member: `${b.member.firstName} ${b.member.lastName}`,
            email: maskEmail(b.member.email),
            checkedIn: b.checkedIn,
            ticketsBought: b.ticketsBought,
            isRecurring: b.isRecurring,
            cancelled: b.cancelledAt !== null,
          })),
        };
        break;
      }
    }

    return NextResponse.json({
      ok: true,
      sessionsInLast14Days: sessions.length,
      firstSessions: sessions.slice(0, 5).map((s) => ({ id: s.id, name: s.name, type: s.type })),
      sampleWithBookings: sample ?? "ninguna sesión con reservas en el rango",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
