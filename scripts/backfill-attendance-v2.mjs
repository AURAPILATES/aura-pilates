// Backfill one-shot de asistencia real por clase (class_sessions_v2 + class_bookings_v2).
// El cron capture-attendance-v2 solo cubre una ventana rolling reciente (por el límite de
// 60s de Vercel); este script carga TODO el histórico desde el arranque en Momence y no
// tiene límite de tiempo al correr en local. Idempotente (upsert): se puede relanzar.
//
// Requisitos: las tablas de la migración 027 aplicadas en Supabase y .env.local con las
// credenciales de Momence (MOMENCE_*) y de Supabase (NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY).
//
// Uso:  node scripts/backfill-attendance-v2.mjs [YYYY-MM-DD_desde]
//   (por defecto desde 2026-03-01, primer día con clases en Momence)

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(path.join(__dirname, "..", ".env.local"), "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const BASE = "https://api.momence.com/api/v2";
const FROM = process.argv[2] || "2026-03-01";
const BOOKINGS_BATCH = 10;

async function token() {
  const basic = Buffer.from(`${env.MOMENCE_CLIENT_ID}:${env.MOMENCE_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "password", username: env.MOMENCE_USERNAME, password: env.MOMENCE_PASSWORD });
  const res = await fetch(`${BASE}/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`auth ${res.status}`);
  return (await res.json()).accessToken;
}

async function getJson(tok, pathname, params = {}) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
  const res = await fetch(`${BASE}${pathname}?${qs}`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!res.ok) throw new Error(`${pathname} ${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

async function allPages(tok, pathname, params) {
  const first = await getJson(tok, pathname, { ...params, page: 0, pageSize: 200 });
  const all = [...first.payload];
  const pages = Math.ceil(first.pagination.totalCount / 200);
  for (let p = 1; p < pages; p++) {
    const n = await getJson(tok, pathname, { ...params, page: p, pageSize: 200 });
    all.push(...n.payload);
  }
  return all;
}

const teacherName = (t) => (t ? `${t.firstName} ${t.lastName}`.replace(/\s+/g, " ").trim() : "Sin asignar");

async function main() {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const tok = await token();
  const now = Date.now();

  const startAfter = new Date(FROM + "T00:00:00.000Z").toISOString();
  const startBefore = new Date(now).toISOString();
  const sessions = (await allPages(tok, "/host/sessions", { startAfter, startBefore, sortBy: "startsAt", sortOrder: "ASC" }))
    .filter((s) => s.type === "fitness" && !s.isCancelled && !s.isDraft && Date.parse(s.startsAt) <= now);

  console.log(`Clases fitness ya impartidas desde ${FROM}: ${sessions.length}. Capturando asistencia...`);

  const capturedAt = new Date().toISOString();
  const sessionRows = [];
  const bookingRows = [];
  let done = 0;

  for (let i = 0; i < sessions.length; i += BOOKINGS_BATCH) {
    const chunk = sessions.slice(i, i + BOOKINGS_BATCH);
    const results = await Promise.all(
      chunk.map(async (s) => ({ s, bookings: (await getJson(tok, `/host/sessions/${s.id}/bookings`, { includeCancelled: true, page: 0, pageSize: 100 })).payload ?? [] })),
    );
    for (const { s, bookings } of results) {
      const tName = teacherName(s.teacher);
      const tId = s.teacher?.id ?? null;
      const active = bookings.filter((b) => b.cancelledAt === null);
      sessionRows.push({
        session_id: s.id, starts_at: s.startsAt, ends_at: s.endsAt ?? null,
        teacher_id: tId, teacher_name: tName, type: s.type,
        capacity: s.capacity ?? 0, booking_count: active.length,
        checked_in_count: active.filter((b) => b.checkedIn).length,
        is_cancelled: false, captured_at: capturedAt,
      });
      for (const b of bookings) {
        bookingRows.push({
          booking_id: b.id, session_id: s.id, session_starts_at: s.startsAt,
          teacher_id: tId, teacher_name: tName, member_id: b.member.id,
          email: b.member.email ?? null, checked_in: b.checkedIn,
          cancelled: b.cancelledAt !== null, cancelled_at: b.cancelledAt,
          captured_at: capturedAt,
        });
      }
    }
    done += chunk.length;
    process.stdout.write(`\r  ${done}/${sessions.length} clases`);
  }
  console.log("");

  // Upsert en bloques para no pasar límites de tamaño de payload.
  const chunkUpsert = async (table, rows, conflict) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict: conflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };
  await chunkUpsert("class_sessions_v2", sessionRows, "session_id");
  await chunkUpsert("class_bookings_v2", bookingRows, "booking_id");

  const checkedIn = sessionRows.reduce((s, r) => s + r.checked_in_count, 0);
  const booked = sessionRows.reduce((s, r) => s + r.booking_count, 0);
  console.log(`\nListo. ${sessionRows.length} clases y ${bookingRows.length} reservas.`);
  console.log(`Asistencia global: ${checkedIn}/${booked} (no-show ${booked ? ((1 - checkedIn / booked) * 100).toFixed(1) : "0"}%).`);
}

main().catch((e) => { console.error("\nBackfill falló:", e.message); process.exit(1); });
