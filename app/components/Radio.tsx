import type { InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Radio custom (círculo + punto) a juego con Checkbox, para decisiones de una sola
 * opción (p. ej. "Mantener esta ficha" al fusionar contactos duplicados). */
export default function Radio({ checked, className = "", ...props }: Props) {
  return (
    <span className={`relative inline-flex shrink-0 w-[16px] h-[16px] ${className}`}>
      <input
        type="radio"
        checked={checked}
        className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        {...props}
      />
      <span
        className={`pointer-events-none w-full h-full rounded-full border flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 ${
          checked ? "border-primary" : "border-navy/25 bg-card"
        }`}
      >
        {checked && <span className="w-[8px] h-[8px] rounded-full bg-primary" />}
      </span>
    </span>
  );
}
