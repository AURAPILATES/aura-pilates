import { NextResponse } from "next/server";

const BASE = "https://momence.com/_api/primary/api/v1";

async function probe(endpoint: string, extraParams: Record<string, string> = {}) {
  const p = new URLSearchParams({
    hostId: process.env.MOMENCE_HOST_ID ?? "",
    token:  process.env.MOMENCE_TOKEN ?? "",
    ...extraParams,
  });
  try {
    const res  = await fetch(`${BASE}/${endpoint}?${p}`, { cache: "no-store" });
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
    return { endpoint, status: res.status, ok: res.ok, sample: JSON.stringify(body).slice(0, 300) };
  } catch (e) {
    return { endpoint, status: 0, ok: false, sample: String(e) };
  }
}

export async function GET() {
  // Get a real event ID and customer memberId
  const [eventsRaw, customersRaw] = await Promise.all([
    fetch(`${BASE}/Events?hostId=${process.env.MOMENCE_HOST_ID}&token=${process.env.MOMENCE_TOKEN}`, { cache: "no-store" }).then(r => r.json()).catch(() => []),
    fetch(`${BASE}/Customers?hostId=${process.env.MOMENCE_HOST_ID}&token=${process.env.MOMENCE_TOKEN}&page=1&pageSize=1`, { cache: "no-store" }).then(r => r.json()).catch(() => null),
  ]);

  const eventId    = Array.isArray(eventsRaw) ? eventsRaw[0]?.id : null;
  const memberId   = customersRaw?.payload?.[0]?.memberId ?? null;
  const customerId = customersRaw?.payload?.[0]?.memberId ?? null;

  const results = await Promise.all([
    // Per-event endpoints
    eventId && probe(`Events/${eventId}/Registrations`),
    eventId && probe(`Events/${eventId}/Attendees`),
    eventId && probe(`Events/${eventId}/Tickets`),
    eventId && probe(`Events/${eventId}/Bookings`),
    eventId && probe(`Events/${eventId}/Members`),
    eventId && probe(`Events/${eventId}/CheckIns`),
    // Per-customer endpoints
    memberId && probe(`Customers/${memberId}/Bookings`),
    memberId && probe(`Customers/${memberId}/Attendances`),
    memberId && probe(`Customers/${memberId}/Sessions`),
    memberId && probe(`Members/${memberId}/Bookings`),
    // Other patterns
    probe("EventBookings"),
    probe("SessionRegistrations"),
    probe("MemberBookings"),
  ].filter(Boolean) as Promise<{ endpoint: string; status: number; ok: boolean; sample: string }>[]);

  return NextResponse.json({ eventId, memberId, results });
}
