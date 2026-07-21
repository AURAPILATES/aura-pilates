"use client";

import { useState } from "react";

const AVATAR_COLORS = ["#7C3AED", "#D97706", "#059669", "#2563EB", "#DB2777", "#0D9488", "#DC2626", "#4F46E5"];

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Avatar circular reutilizado en listas de clientes/contactos: logo de marca (vía favicon de
 * Google) para dominios conocidos, con fallback automático a iniciales de color si la imagen
 * falla o no hay dominio. */
export default function Avatar({ seed, initials, logoDomain, size = 32 }: {
  seed: string; initials: string; logoDomain?: string | null; size?: number;
}) {
  const [imgError, setImgError] = useState(false);

  if (logoDomain && !imgError) {
    return (
      <div
        className="shrink-0 rounded-full bg-card border border-navy/[0.08] flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        <img
          src={`https://www.google.com/s2/favicons?sz=64&domain=${logoDomain}`}
          width={Math.round(size * 0.55)}
          height={Math.round(size * 0.55)}
          alt=""
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: hashColor(seed) }}
    >
      {initials}
    </div>
  );
}
