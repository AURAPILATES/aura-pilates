"use client";

import { useDesignVersion } from "./DesignVersionContext";

/** Switch para comparar el diseño clásico con el rediseño en prueba. Vive en ambos
 * sidebars (clásico y v2) para poder ir y volver desde cualquiera de los dos. */
export default function DesignVersionToggle() {
  const { v2, setV2 } = useDesignVersion();

  return (
    <button
      type="button"
      onClick={() => setV2(!v2)}
      className="flex items-center justify-between gap-2 w-full px-3 py-2 rounded-lg text-[12px] font-medium text-navy/55 hover:bg-navy/[0.04] hover:text-navy transition-colors"
    >
      <span>Diseño nuevo</span>
      <span
        className={`relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full transition-colors ${
          v2 ? "bg-navy" : "bg-navy/15"
        }`}
      >
        <span
          className={`inline-block h-[14px] w-[14px] transform rounded-full bg-white shadow-sm transition-transform ${
            v2 ? "translate-x-[16px]" : "translate-x-[2px]"
          }`}
        />
      </span>
    </button>
  );
}
