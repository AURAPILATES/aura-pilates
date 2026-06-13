import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Endpoint temporal de diagnóstico — visita /api/debug-subs para ver qué devuelve Stripe
export async function GET() {
  try {
    const page = await stripe.subscriptions.list({
      limit: 10,
      status: "all",
    });

    const summary = page.data.map((sub) => {
      const raw = sub as unknown as Record<string, unknown>;
      return {
        id: sub.id,
        status: sub.status,
        created: sub.created,
        billing_mode: raw["billing_mode"],
        current_period_end: raw["current_period_end"],
        billing_cycle_anchor: sub.billing_cycle_anchor,
        customer: typeof sub.customer === "string" ? sub.customer : (sub.customer as { id: string })?.id,
        items_count: sub.items?.data?.length ?? 0,
      };
    });

    return NextResponse.json({
      total_in_page: page.data.length,
      has_more: page.has_more,
      subscriptions: summary,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
