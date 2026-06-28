interface IconProps {
  size?: number;
  className?: string;
}

/** Logotipo de Stripe (simple-icons), monocromo vía currentColor. */
export function StripeIcon({ size = 13, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Stripe">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
    </svg>
  );
}

/** Logotipo de Microsoft Excel (Material Design Icons), monocromo vía currentColor. */
export function ExcelIcon({ size = 13, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Excel">
      <path d="M21.17 3.25Q21.5 3.25 21.76 3.5 22 3.74 22 4.08V19.92Q22 20.26 21.76 20.5 21.5 20.75 21.17 20.75H7.83Q7.5 20.75 7.24 20.5 7 20.26 7 19.92V17H2.83Q2.5 17 2.24 16.76 2 16.5 2 16.17V7.83Q2 7.5 2.24 7.24 2.5 7 2.83 7H7V4.08Q7 3.74 7.24 3.5 7.5 3.25 7.83 3.25M7 13.06L8.18 15.28H9.97L8 12.06L9.93 8.89H8.22L7.13 10.9L7.09 10.96L7.06 11.03Q6.8 10.5 6.5 9.96 6.25 9.43 5.97 8.89H4.16L6.05 12.08L4 15.28H5.78M13.88 19.5V17H8.25V19.5M13.88 15.75V12.63H12V15.75M13.88 11.38V8.25H12V11.38M13.88 7V4.5H8.25V7M20.75 19.5V17H15.13V19.5M20.75 15.75V12.63H15.13V15.75M20.75 11.38V8.25H15.13V11.38M20.75 7V4.5H15.13V7Z" />
    </svg>
  );
}

/** Icono genérico de calendario/reservas para Momence (no existe logo de marca libre). */
export function MomenceIcon({ size = 13, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Momence">
      <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1ZM5 10v10h14V10H5Zm10.7 2.3a1 1 0 0 1 0 1.4l-4.5 4.5a1 1 0 0 1-1.4 0l-2-2a1 1 0 1 1 1.4-1.4l1.3 1.3 3.8-3.8a1 1 0 0 1 1.4 0Z" />
    </svg>
  );
}

export type SourceKey = "stripe" | "momence" | "excel" | "recurrentes";

const ICONS: Record<SourceKey, (props: IconProps) => React.ReactElement> = {
  stripe: StripeIcon,
  momence: MomenceIcon,
  excel: ExcelIcon,
  recurrentes: ExcelIcon,
};

export const SOURCE_LABELS: Record<SourceKey, string> = {
  stripe: "Stripe",
  momence: "Momence",
  excel: "Banco",
  recurrentes: "Transacciones > Recurrentes",
};

/** Fila de logos de fuente de datos (Stripe/Momence/Excel), monocromos. */
export function SourceIcons({ sources, size = 13, className = "" }: { sources: SourceKey[]; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {sources.map((key) => {
        const Icon = ICONS[key];
        return <Icon key={key} size={size} />;
      })}
    </span>
  );
}
