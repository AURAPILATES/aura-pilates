import { NextResponse } from "next/server";

const BASE = "https://momence.com/_api/primary/api/v1";

async function probe(endpoint: string, extraParams: Record<string, string> = {}) {
  const hostId = process.env.MOMENCE_HOST_ID ?? "";
  const token  = process.env.MOMENCE_TOKEN ?? "";
  const p = new URLSearchParams({ hostId, token, ...extraParams });
  try {
    const res  = await fetch(`${BASE}/${endpoint}?${p}`, { cache: "no-store" });
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
    return { endpoint, status: res.status, ok: res.ok, sample: JSON.stringify(body).slice(0, 400) };
  } catch (e) {
    return { endpoint, status: 0, ok: false, sample: String(e) };
  }
}

export async function GET() {
  const hostId = process.env.MOMENCE_HOST_ID;
  const token  = process.env.MOMENCE_TOKEN;

  if (!hostId || !token) {
    return NextResponse.json({
      error: "Credenciales no disponibles en local",
      MOMENCE_HOST_ID: hostId ? "✓ presente" : "✗ falta",
      MOMENCE_TOKEN:   token  ? "✓ presente" : "✗ falta",
      fix: "Ejecuta: vercel env pull .env.local  (necesita vercel CLI)"
    }, { status: 500 });
  }

  // Get a real event ID first
  const eventsResult = await probe("Events");
  let firstId: number | null = null;
  try {
    const parsed = JSON.parse(eventsResult.sample);
    if (Array.isArray(parsed)) firstId = parsed[0]?.id ?? null;
  } catch { /* ignore */ }

  const perEventEndpoints = firstId ? [
    probe(`Events/${firstId}/Registrations`),
    probe(`Events/${firstId}/Attendees`),
    probe(`Events/${firstId}/Tickets`),
    probe(`Events/${firstId}/Bookings`),
    probe(`Events/${firstId}/Members`),
  ] : [];

  const results = await Promise.all([
    Promise.resolve(eventsResult),
    probe("EventRegistrations"),
    probe("EventAttendees"),
    probe("Registrations"),
    probe("Bookings"),
    probe("Attendees"),
    probe("ClassAttendees"),
    ...perEventEndpoints,
  ]);

  return NextResponse.json({ firstEventId: firstId, results });
}
