import { NextResponse } from "next/server";
import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { fetchStripeCustomerList, fetchFailedPayments } from "@/lib/stripeCustomers";
import { getCustomers, getMemberships, getProducts } from "@/lib/momence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Fuerza la recarga de las cachés más pesadas (todo el historial de Stripe,
// todos los clientes de Momence/Stripe) una vez al día, antes de que alguien
// entre al dashboard, para que esa persona no pague el coste del refetch en frío.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [payments, stripeCustomers, failedPayments, momenceCustomers, memberships, products] = await Promise.all([
      loadStripePaymentsCached(),
      fetchStripeCustomerList(),
      fetchFailedPayments(),
      getCustomers(),
      getMemberships(),
      getProducts(),
    ]);

    return NextResponse.json({
      warmed: {
        stripePayments: payments.length,
        stripeCustomers: stripeCustomers.length,
        stripeFailedPayments: failedPayments.length,
        momenceCustomers: momenceCustomers.length,
        momenceMemberships: memberships.length,
        momenceProducts: products.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
