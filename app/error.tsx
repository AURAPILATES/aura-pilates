"use client";

import { useEffect } from "react";
import { AlertTriangle } from "react-feather";
import Button from "@/app/components/Button";
import { sanitizeErrorMessage } from "@/lib/sanitizeErrorMessage";

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
      <div className="max-w-lg w-full rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-6 space-y-3">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle size={18} />
          <p className="font-semibold">Error al cargar los datos</p>
        </div>
        <p className="text-sm text-navy/70 font-mono break-words">{sanitizeErrorMessage(error.message)}</p>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </div>
  );
}
