import { NextResponse } from "next/server";
import { checkV2Connection } from "@/lib/momenceV2";

export const dynamic = "force-dynamic";

// Health check de la integración v2 de Momence, para el banner de desconexión.
// Devuelve siempre 200 con { connected } — el flag lleva el estado, así el
// cliente no tiene que distinguir errores de red del propio fetch.
// No expone PII (solo el booleano y, si falla, el motivo técnico).
export async function GET() {
  try {
    await checkV2Connection();
    return NextResponse.json({ connected: true });
  } catch (e) {
    return NextResponse.json({
      connected: false,
      reason: e instanceof Error ? e.message : String(e),
    });
  }
}
