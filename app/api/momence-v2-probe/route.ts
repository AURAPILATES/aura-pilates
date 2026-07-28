import { NextResponse } from "next/server";
import {
  getSessionsV2, getSessionDetailV2, getSessionBookingsV2,
  getMembersV2, getMemberBoughtMembershipsV2,
} from "@/lib/momenceV2";

export const dynamic = "force-dynamic";

// Ruta de verificación de la API v2 de Momence. Abrila en el navegador
// (/api/momence-v2-probe) tras poner MOMENCE_CLIENT_ID / _SECRET / _USERNAME /
// _PASSWORD en .env.local. Confirma auth + sesiones/reservas + members/suscripciones.
// Enmascara los emails para no volcar datos personales en claro.
// NOTA: es una ruta de test — NO debe deployarse pública tal cual (expone PII).
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

async function checkSessions() {
  const now = Date.now();
  const startAfter = new Date(now - 14 * 24 * 3600_000).toISOString();
  const startBefore = new Date(now + 24 * 3600_000).toISOString();
  const sessions = await getSessionsV2({ startAfter, startBefore });

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
  return {
    sessionsInLast14Days: sessions.length,
    firstSessions: sessions.slice(0, 5).map((s) => ({ id: s.id, name: s.name, type: s.type })),
    sampleWithBookings: sample ?? "ninguna sesión con reservas en el rango",
  };
}

async function checkSubscriptions() {
  const members = await getMembersV2({ filterPreset: "with-active-membership" });
  let sample: unknown = null;
  for (const m of members.slice(0, 10)) {
    const subs = await getMemberBoughtMembershipsV2(m.id);
    if (subs.length > 0) {
      sample = {
        member: `${m.firstName} ${m.lastName}`,
        email: maskEmail(m.email),
        firstSeen: m.firstSeen,
        subscriptions: subs.map((s) => ({
          membership: s.membership?.name ?? null,
          type: s.type,
          startDate: s.startDate,
          endDate: s.endDate,
          isFrozen: s.isFrozen,
          eventCreditsLeft: s.eventCreditsLeft,
          eventCreditsTotal: s.eventCreditsTotal,
        })),
      };
      break;
    }
  }
  return {
    membersWithActiveMembership: members.length,
    sampleSubscriptions: sample ?? "ningún miembro con suscripción en la muestra",
  };
}

export async function GET() {
  const result: Record<string, unknown> = {};
  try {
    result.sessions = await checkSessions();
  } catch (e) {
    result.sessions = { error: e instanceof Error ? e.message : String(e) };
  }
  try {
    result.subscriptions = await checkSubscriptions();
  } catch (e) {
    result.subscriptions = { error: e instanceof Error ? e.message : String(e) };
  }
  const ok = !("error" in (result.sessions as object)) && !("error" in (result.subscriptions as object));
  return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 500 });
}
