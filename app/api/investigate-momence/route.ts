import { NextResponse } from "next/server";
import { getMemberships, getProducts } from "@/lib/momence";

export const dynamic = "force-dynamic";

const KEY = "5b3e9f1a7c2d4860e1f9a3b6c8d04e72";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [memberships, products] = await Promise.all([getMemberships(), getProducts()]);
  return NextResponse.json({ memberships, products });
}
