"use client";

const SECTIONS: { id: string; label: string }[] = [
  { id: "clientes-resumen", label: "Resumen" },
  { id: "clientes-suscripcion", label: "Suscripción" },
  { id: "clientes-atencion", label: "Atención" },
  { id: "clientes-actividad", label: "Actividad" },
  { id: "clientes-profesoras", label: "Profesoras" },
  { id: "clientes-adquisicion", label: "Adquisición" },
  { id: "clientes-cohortes", label: "Cohortes" },
];

// Índice rápido para la pestaña Clientes: sin esto, orientarse en un scroll de ~14 bloques
// significaba escanear toda la página. No es sticky a propósito (evita pelearse con el resto
// de elementos fijos del header) - vive arriba del todo, como un mapa de la pestaña al entrar.
export default function ClientesJumpNav() {
  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => goTo(s.id)}
          className="shrink-0 text-xs font-medium text-navy/55 bg-navy/[0.04] hover:bg-navy/[0.08] hover:text-navy px-2.5 py-1 rounded-full transition-colors whitespace-nowrap"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
