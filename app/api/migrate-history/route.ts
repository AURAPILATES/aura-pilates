import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import snapshot from "@/data/historySnapshot.json";

export const dynamic = "force-dynamic";

const MIGRATION_KEY = "286368827178defbfaeddb81ade51f7c";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== MIGRATION_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  const rows = Object.entries(snapshot).map(([date, events]) => ({ date, events }));

  const { data: existing, error: selErr } = await db.from("momence_history").select("date");
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  const existingDates = new Set((existing ?? []).map((r) => r.date));
  const toInsert = rows.filter((r) => !existingDates.has(r.date));

  if (toInsert.length > 0) {
    const { error } = await db.from("momence_history").insert(toInsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: toInsert.length, alreadyInDb: existingDates.size });
}
