import { NextResponse } from "next/server";
import { getCustomers } from "@/lib/momence";
import { createServerClient } from "@/lib/supabase";
import { logSyncRun } from "@/lib/syncRuns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const customers = await getCustomers();

    const rows = customers.flatMap((customer) =>
      customer.activeSubscriptions.map((sub) => ({
        date: today,
        email: customer.email,
        membership_id: sub.membership.id,
        membership_name: sub.membership.name,
        subscription_id: sub.id,
        subscription_type: sub.type,
        is_freezed: sub.isFreezed,
        created_at_momence: sub.createdAt,
        end_date: sub.endDate,
      })),
    );

    if (rows.length === 0) {
      await logSyncRun("momence_subscribers", { ok: true, items: 0 });
      return NextResponse.json({ date: today, snapshotted: 0 });
    }

    const db = createServerClient();
    const { error } = await db.from("subscriber_snapshots").upsert(rows, { onConflict: "date,subscription_id" });
    if (error) throw new Error(error.message);

    await logSyncRun("momence_subscribers", { ok: true, items: rows.length });
    return NextResponse.json({ date: today, snapshotted: rows.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSyncRun("momence_subscribers", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
