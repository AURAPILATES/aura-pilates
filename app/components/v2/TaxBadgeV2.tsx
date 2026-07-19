/** Badge gris discreto para IVA/IRPF (Contactos, Recurrentes). Si `isError`, se marca en rojo
 * con un icono de exclamación — reservado para cuando NINGUNO de los dos datos fiscales de la
 * fila está informado (como el aviso de error de una celda en Excel). `zeroIsExplicit` cubre el
 * caso contrario: el contacto está marcado "Sin IVA ni retenciones", así que un valor en 0 se
 * muestra como "0%" en vez de "—" (es un dato real, no uno que falte). */
export default function TaxBadgeV2({ value, isError, zeroIsExplicit }: { value: number; isError: boolean; zeroIsExplicit?: boolean }) {
  if (isError) {
    return (
      <span className="inline-flex items-center gap-1 bg-[#fee2e2] text-[#dc2626] border border-[#fca5a5] rounded-[6px] px-[7px] py-[2px] text-[11px] font-semibold">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17v.5" />
        </svg>
        —
      </span>
    );
  }
  return (
    <span className="inline-flex items-center bg-[#f2f2f4] text-[#52525b] rounded-[6px] px-[7px] py-[2px] text-[11px] font-medium">
      {value > 0 || zeroIsExplicit ? `${value}%` : "—"}
    </span>
  );
}
