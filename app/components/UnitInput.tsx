import type { InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  unit: string;
  unitSide?: "left" | "right";
  className?: string;
};

/** Campo numérico con la unidad integrada en una caja con separador (IVA, IRPF, importe…),
 * como en el mockup. Puramente controlado: el valor y el commit los gestiona quien lo usa. */
export default function UnitInput({ unit, unitSide = "right", className = "", ...props }: Props) {
  return (
    <div
      className={`flex items-center h-[38px] border border-border rounded-[10px] overflow-hidden bg-card focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition-colors ${className}`}
    >
      {unitSide === "left" && (
        <span className="h-full px-2.5 flex items-center bg-subtle border-r border-border text-[12.5px] text-muted shrink-0">
          {unit}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        className={`flex-1 min-w-0 h-full px-3 text-[13.5px] text-navy bg-transparent outline-none ${unitSide === "right" ? "text-right" : ""}`}
        {...props}
      />
      {unitSide === "right" && (
        <span className="h-full px-2.5 flex items-center bg-subtle border-l border-border text-[12.5px] text-muted shrink-0">
          {unit}
        </span>
      )}
    </div>
  );
}
