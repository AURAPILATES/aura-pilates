import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const KEY = "9f1c2e7b4a6d8830f5e21bc7a094d6e1";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [products, prices, subscriptions] = await Promise.all([
    stripe.products.list({ limit: 100, active: true }),
    stripe.prices.list({ limit: 100, expand: ["data.product"] }),
    stripe.subscriptions.list({ limit: 100, status: "all", expand: ["data.items.data.price"] }),
  ]);

  const productList = products.data.map((p) => ({ id: p.id, name: p.name, active: p.active }));

  const priceList = prices.data.map((pr) => ({
    id: pr.id,
    nickname: pr.nickname,
    product: typeof pr.product === "string" ? pr.product : pr.product?.id,
    productName: typeof pr.product === "string" ? null : (pr.product as { name?: string })?.name,
    unitAmount: pr.unit_amount,
    currency: pr.currency,
    recurring: pr.recurring ? { interval: pr.recurring.interval, intervalCount: pr.recurring.interval_count } : null,
    active: pr.active,
  }));

  const subsByStatus: Record<string, number> = {};
  const subsByPrice: Record<string, { count: number; priceId: string; productName: string | null; amount: number | null; interval: string | null }> = {};
  for (const sub of subscriptions.data) {
    subsByStatus[sub.status] = (subsByStatus[sub.status] ?? 0) + 1;
    for (const item of sub.items.data) {
      const price = item.price;
      const pid = price.id;
      if (!subsByPrice[pid]) {
        subsByPrice[pid] = {
          count: 0,
          priceId: pid,
          productName: typeof price.product === "string" ? null : (price.product as { name?: string })?.name ?? null,
          amount: price.unit_amount,
          interval: price.recurring?.interval ?? null,
        };
      }
      subsByPrice[pid].count++;
    }
  }

  return NextResponse.json({
    productCount: products.data.length,
    products: productList,
    priceCount: prices.data.length,
    prices: priceList,
    subscriptionCount: subscriptions.data.length,
    subsByStatus,
    subsByPrice: Object.values(subsByPrice),
  });
}
