"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

/** Barra de búsqueda del rediseño en prueba — misma API que SearchInput.tsx, otro look. */
export default function SearchInputV2({ value, onChange, placeholder = "Buscar…", className = "" }: Props) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.8-3.8"/>
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-9 py-2.5 text-[13.5px] border border-border rounded-[10px] bg-card text-navy placeholder:text-faint outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy/30 transition"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}
