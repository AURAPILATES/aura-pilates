import type { InputHTMLAttributes } from "react";

const TONE_CLS = {
  navy: "bg-navy border-navy",
  primary: "bg-primary border-primary",
  danger: "bg-danger border-danger",
  rose: "bg-rose-500 border-rose-500",
} as const;

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  tone?: keyof typeof TONE_CLS;
};

/** Casilla custom (caja + check) que sustituye al checkbox nativo del navegador en los
 * controles de decisión de la app (Familiar, recurrente, devolución, sin IVA…). El
 * <input> real queda invisible mas cubre toda la caja, así que sigue siendo accesible
 * por teclado y funciona dentro o fuera de un <label>. */
export default function Checkbox({ checked, className = "", tone = "navy", ...props }: Props) {
  return (
    <span className={`relative inline-flex shrink-0 w-[16px] h-[16px] ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        {...props}
      />
      <span
        className={`pointer-events-none w-full h-full rounded-[5px] border flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 ${
          checked ? TONE_CLS[tone] : "border-navy/25 bg-card"
        }`}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
    </span>
  );
}
