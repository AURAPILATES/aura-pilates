import type { ReactNode } from "react";

/** Envoltorio de campo compartido: el label vive incrustado en el propio borde
 * (fieldset/legend nativos, sin trucos de color de fondo - funciona igual en modo oscuro).
 * El contenido (input, Select, ContactPicker...) va sin su propio borde: lo pone el fieldset.
 * `align="start"` es para contenido multilínea (textarea) que no debe centrarse verticalmente. */
export default function Field({ label, children, align = "center", className = "" }: {
  label: ReactNode;
  children: ReactNode;
  align?: "center" | "start";
  className?: string;
}) {
  return (
    <fieldset
      className={`group flex ${align === "start" ? "items-start" : "items-center"} gap-2 border border-navy/[0.12] rounded-[8px] pt-2 px-3 pb-2.5 text-[13px] text-navy transition-colors focus-within:border-primary/40 ${className}`}
    >
      <legend className="px-1.5 ml-1 text-[12.5px] font-medium text-navy/55 group-focus-within:text-primary">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}
