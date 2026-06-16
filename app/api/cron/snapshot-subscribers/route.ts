import { NextResponse } from "next/server";
import { getCustomers } from "@/lib/momence";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const customers = await getCustomers();
  const today = new Date().toISOString().slice(0, 10);

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
    return NextResponse.json({ date: today, snapshotted: 0 });
  }

  const db = createServerClient();
  const { error } = await db.from("subscriber_snapshots").upsert(rows, { onConflict: "date,subscription_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ date: today, snapshotted: rows.length });
}
