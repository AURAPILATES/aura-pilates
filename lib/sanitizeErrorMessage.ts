// Las excepciones de Stripe (y potencialmente otras APIs) a veces repiten un
// fragmento de la clave usada en el mensaje de error (p. ej. "Invalid API Key
// provided: sk_live_****...ab12"). Estos mensajes se muestran tal cual en el
// panel de sync y en la pantalla de error — esta función quita cualquier
// fragmento con pinta de clave antes de que lleguen a la UI.
const KEY_PATTERN = /\b(sk|rk|pk|whsec)_(live|test)_[A-Za-z0-9*]{4,}\b/gi;

export function sanitizeErrorMessage(message: string): string {
  return message.replace(KEY_PATTERN, "[clave oculta]");
}
