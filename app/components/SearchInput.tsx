"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

/** Barra de búsqueda compartida por todas las tablas (Clientes, Transacciones, Recurrentes,
 * Contactos): mismo icono, radio y estados de foco en todas partes. */
export default function SearchInput({ value, onChange, placeholder = "Buscar…", className = "" }: Props) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy/30 pointer-events-none"
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-9 py-2.5 text-sm border border-navy/[0.12] rounded-xl bg-card text-navy placeholder:text-navy/40 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/30 hover:text-navy/60 transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}
