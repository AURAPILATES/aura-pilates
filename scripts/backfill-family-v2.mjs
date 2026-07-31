// Migra las marcas "Familiar" antiguas (client_family, por customer_id de Stripe) a la nueva
// tabla client_family_v2 (por member_id de Momence). Mapea customer → email (Stripe) → member
// (Momence). One-shot, idempotente. Requiere la migración 028 aplicada y .env.local con
// credenciales de Stripe, Momence y Supabase.
//
// Uso:  node scripts/backfill-family-v2.mjs

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(path.join(__dirname, "..", ".env.local"), "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const V2 = "https://api.momence.com/api/v2";

async function momenceToken() {
  const basic = Buffer.from(`${env.MOMENCE_CLIENT_ID}:${env.MOMENCE_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${V2}/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", username: env.MOMENCE_USERNAME, password: env.MOMENCE_PASSWORD }).toString(),
  });
  return (await res.json()).accessToken;
}

// email de un cliente de Stripe: del propio cliente, o del billing_details de un cargo.
async function stripeEmail(customerId) {
  const c = await stripe.customers.retrieve(customerId).catch(() => null);
  if (c && !c.deleted && c.email) return c.email.toLowerCase();
  const charges = await stripe.charges.list({ customer: customerId, limit: 3 }).catch(() => ({ data: [] }));
  for (const ch of charges.data) if (ch.billing_details?.email) return ch.billing_details.email.toLowerCase();
  return null;
}

async function main() {
  const { data: marks, error } = await db.from("client_family").select("customer_id, is_family").eq("is_family", true);
  if (error) throw new Error(error.message);
  console.log(`Marcas Familiar antiguas: ${marks.length}`);

  const token = await momenceToken();
  const members = [];
  for (let page = 0; ; page++) {
    const r = await fetch(`${V2}/host/members?page=${page}&pageSize=100&sortBy=lastSeenAt&sortOrder=DESC`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    members.push(...(j.payload ?? []));
    if (!j.payload?.length || members.length >= (j.pagination?.totalCount ?? 0)) break;
  }
  const memberByEmail = new Map(members.filter((m) => m.email).map((m) => [m.email.toLowerCase(), m.id]));

  const rows = [];
  for (const mk of marks) {
    const email = await stripeEmail(mk.customer_id);
    const memberId = email ? memberByEmail.get(email) : null;
    if (memberId) {
      rows.push({ member_id: memberId, is_family: true, updated_at: new Date().toISOString() });
      console.log(`  ✓ ${mk.customer_id} → ${email} → member ${memberId}`);
    } else {
      console.log(`  ✗ ${mk.customer_id} → ${email ?? "(sin email)"} → sin miembro de Momence (revisar a mano)`);
    }
  }

  if (rows.length) {
    const { error: upErr } = await db.from("client_family_v2").upsert(rows, { onConflict: "member_id" });
    if (upErr) throw new Error(upErr.message);
  }
  console.log(`\nMigradas ${rows.length}/${marks.length} marcas a client_family_v2.`);
}

main().catch((e) => { console.error("Backfill falló:", e.message); process.exit(1); });
