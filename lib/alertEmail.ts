import { SyncSource } from "./syncRuns";

const SOURCE_LABELS: Record<SyncSource, string> = {
  momence_events: "Histórico de clases (Momence)",
  momence_subscribers: "Snapshot de suscriptores (Momence)",
  momence_subscribers_v2: "Snapshot de suscriptores v2 (Momence)",
  momence_attendance_v2: "Captura de asistencia por clase v2 (Momence)",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Avisa por email cuando una sincronización falla del todo (tras agotar los
// reintentos). Si falla el propio envío, solo se registra en consola - no
// debe tapar el error original del cron.
export async function sendSyncFailureAlert(source: SyncSource, error: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL ?? "juliamuliterno@gmail.com";
  if (!apiKey) {
    console.error("Alerta de sync no enviada: falta RESEND_API_KEY");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Aura Pilates <onboarding@resend.dev>",
        to,
        subject: `⚠️ Fallo de sincronización: ${SOURCE_LABELS[source]}`,
        html: `
          <p>La sincronización <strong>${SOURCE_LABELS[source]}</strong> ha fallado y no se ha podido guardar el histórico de hoy.</p>
          <p><strong>Error:</strong></p>
          <pre style="background:#f4f4f4;padding:12px;border-radius:8px;white-space:pre-wrap;">${escapeHtml(error)}</pre>
          <p>Hora: ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</p>
          <p style="color:#888;font-size:12px;">Hay una segunda ejecución programada más tarde que reintentará automáticamente.</p>
        `,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`sendSyncFailureAlert: Resend respondió ${res.status} - ${body}`);
    }
  } catch (e) {
    console.error("sendSyncFailureAlert: error al enviar email -", e);
  }
}
