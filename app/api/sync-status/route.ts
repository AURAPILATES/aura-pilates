import { NextResponse } from "next/server";
import { getLatestImportDate } from "@/lib/transactions";
import { getLatestSyncRuns } from "@/lib/syncRuns";

export const dynamic = "force-dynamic";

async function checkMomence() {
  const checkedAt = new Date().toISOString();
  try {
    const params = new URLSearchParams({
      hostId: process.env.MOMENCE_HOST_ID ?? "",
      token: process.env.MOMENCE_TOKEN ?? "",
    });
    const res = await fetch(
      `https://momence.com/_api/primary/api/v1/Events?${params}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    return { ok: res.ok, checkedAt, error: res.ok ? null : `HTTP ${res.status}` };
  } catch {
    return { ok: false, checkedAt, error: "Sin conexión" };
  }
}

async function checkStripe() {
  const checkedAt = new Date().toISOString();
  try {
    const { stripe } = await import("@/lib/stripe");
    await stripe.balance.retrieve();
    return { ok: true, checkedAt, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return { ok: false, checkedAt, error: msg.slice(0, 60) };
  }
}

export async function GET() {
  const [momence, stripe, bancoLastImport, syncRuns] = await Promise.all([
    checkMomence(),
    checkStripe(),
    getLatestImportDate(),
    getLatestSyncRuns().catch(() => null),
  ]);

  // El ping de Momence solo confirma que la API responde ahora; si el cron
  // nocturno falló (p.ej. token caducado a las 3am), eso no se vería con el
  // ping en horario de oficina. Si el último snapshot falló, se marca como error.
  const eventsRun = syncRuns?.momence_events ?? null;
  const subscribersRun = syncRuns?.momence_subscribers ?? null;
  const failedRun = [eventsRun, subscribersRun].find((r) => r && !r.ok) ?? null;

  const momenceCombined = failedRun
    ? {
        ok: false,
        checkedAt: failedRun.ranAt,
        error: `Último snapshot falló: ${failedRun.error}`,
      }
    : momence;

  return NextResponse.json({
    momence: momenceCombined,
    stripe,
    banco: { lastImport: bancoLastImport },
    momenceSyncRuns: { events: eventsRun, subscribers: subscribersRun },
  });
}
