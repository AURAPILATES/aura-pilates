"use client";

import { useEffect } from "react";
import { AlertTriangle } from "react-feather";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="max-w-lg w-full rounded-2xl border border-red-200 bg-red-50 p-6 space-y-3">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle size={18} />
          <p className="font-semibold">Error al cargar los datos</p>
        </div>
        <p className="text-sm text-navy/70 font-mono break-words">{error.message}</p>
        <button
          onClick={reset}
          className="px-3 py-1.5 rounded-lg bg-navy text-white text-sm hover:bg-navy/90 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
