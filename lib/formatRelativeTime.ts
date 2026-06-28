/** Formatea una fecha ISO como "ahora" / "hace N min" / "hoy HH:MM" / "D mon AAAA". */
export function formatRelativeTime(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const diffSec = Math.floor((now - date.getTime()) / 1000);
  if (diffSec < 60) return "ahora";
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)} min`;

  const nowDate = new Date(now);
  const isToday =
    date.getFullYear() === nowDate.getFullYear() &&
    date.getMonth() === nowDate.getMonth() &&
    date.getDate() === nowDate.getDate();
  if (isToday) {
    return `hoy ${date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
  }

  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}
