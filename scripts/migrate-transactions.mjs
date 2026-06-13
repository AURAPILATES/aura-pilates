// Run with: node --env-file=.env.local scripts/migrate-transactions.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, "../data/transactions.json"), "utf8"));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const rows = data
  .filter((t) => t.category !== "skip")
  .map((t) => ({
    date: t.date,
    amount: t.amount,
    balance: t.balance ?? null,
    concept: t.concept || null,
    contact: t.contact || null,
    labels: t.labels || null,
    category: t.category,
    notes: null,
    source: "caixabank",
  }));

const { error, count } = await supabase
  .from("transactions")
  .insert(rows, { count: "exact" });

if (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
} else {
  console.log(`✅ Migradas ${rows.length} transacciones`);
}
