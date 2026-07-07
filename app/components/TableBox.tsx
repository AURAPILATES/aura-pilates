type Props = {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Caja compartida por todas las tablas de la app: mismo fondo, borde, sombra y radio de
 * esquina (discreto, no el rounded-2xl de las KPI cards). Cabecera con título opcional para
 * los casos donde hace falta distinguir varias secciones en la misma pantalla (p. ej. Recurrentes). */
export default function TableBox({ title, subtitle, action, children, className = "" }: Props) {
  return (
    <div className={`bg-white border border-navy/[0.07] shadow-card rounded-[5px] overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-navy/[0.06]">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy">{title}</p>
            {subtitle && <p className="text-xs text-navy/45 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
