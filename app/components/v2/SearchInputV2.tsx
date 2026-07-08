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
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] pointer-events-none"
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.8-3.8"/>
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-9 py-2.5 text-[13.5px] border border-[#e6e6ea] rounded-[10px] bg-white text-[#18181b] placeholder:text-[#a1a1aa] outline-none focus:ring-2 focus:ring-[#18181b]/10 focus:border-[#18181b]/30 transition"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#52525b] transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}
