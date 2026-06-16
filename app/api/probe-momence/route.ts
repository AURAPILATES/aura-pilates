import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KEY = "c4a9e21f6b8d3057a1e4f9c2b7d6038f";
const BASE_URL = "https://momence.com/_api/primary/api/v1";

const CANDIDATES = [
  "Customers",
  "Members",
  "CustomerMemberships",
  "Memberships/Active",
  "ActiveMemberships",
  "Subscriptions",
  "CustomerSubscriptions",
  "Sales",
  "Transactions",
  "Payments",
  "Bookings",
  "Orders",
  "CustomerPayments",
  "MembershipSubscriptions",
];

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = new URLSearchParams({
    hostId: process.env.MOMENCE_HOST_ID ?? "",
    token: process.env.MOMENCE_TOKEN ?? "",
  });

  const results: Record<string, unknown> = {};
  for (const endpoint of CANDIDATES) {
    try {
      const res = await fetch(`${BASE_URL}/${endpoint}?${params}`, { cache: "no-store" });
      const text = await res.text();
      let preview: unknown = text.slice(0, 400);
      try {
        const json = JSON.parse(text);
        preview = Array.isArray(json) ? { isArray: true, length: json.length, sample: json[0] } : json;
      } catch {
        // keep text preview
      }
      results[endpoint] = { status: res.status, preview };
    } catch (e) {
      results[endpoint] = { error: e instanceof Error ? e.message : "fetch error" };
    }
  }

  return NextResponse.json(results);
}
