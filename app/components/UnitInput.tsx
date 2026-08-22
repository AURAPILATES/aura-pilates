import type { InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  unit: string;
  unitSide?: "left" | "right";
  className?: string;
  /** Sin borde/fondo propios, para ir dentro de un <Field> (el fieldset ya pone el borde). */
  bare?: boolean;
  /** Alineación del número, independiente de dónde va la unidad. Por defecto sigue a
   * `unitSide` (número pegado a la unidad), pero un importe grande dentro de un <Field> con
   * label suele leerse mejor pegado a la izquierda aunque la unidad quede a la derecha. */
  numberAlign?: "left" | "right";
};

/** Campo numérico con la unidad integrada en una caja con separador (IVA, IRPF, importe…),
 * como en el mockup. Puramente controlado: el valor y el commit los gestiona quien lo usa. */
export default function UnitInput({ unit, unitSide = "right", className = "", bare = false, numberAlign, ...props }: Props) {
  const align = numberAlign ?? unitSide;
  return (
    <div
      className={
        bare
          ? `flex items-center w-full ${className}`
          : `flex items-center h-[38px] border border-border rounded-[10px] overflow-hidden bg-card focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition-colors ${className}`
      }
    >
      {unitSide === "left" && (
        <span className={bare ? "text-muted shrink-0 mr-1.5" : "h-full px-2.5 flex items-center bg-subtle border-r border-border text-[12.5px] text-muted shrink-0"}>
          {unit}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        className={
          bare
            ? `flex-1 min-w-0 bg-transparent outline-none ${align === "right" ? "text-right" : ""}`
            : `flex-1 min-w-0 h-full px-3 text-[13.5px] text-navy bg-transparent outline-none ${align === "right" ? "text-right" : ""}`
        }
        {...props}
      />
      {unitSide === "right" && (
        <span className={bare ? "text-muted shrink-0 ml-1.5" : "h-full px-2.5 flex items-center bg-subtle border-l border-border text-[12.5px] text-muted shrink-0"}>
          {unit}
        </span>
      )}
    </div>
  );
}
