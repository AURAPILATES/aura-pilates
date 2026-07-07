"use client";

import { useEffect } from "react";
import Button from "@/app/components/Button";

export default function GlobalError({
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
    <html lang="es">
      <body className="bg-app-bg text-navy antialiased">
        <div className="flex items-center justify-center min-h-screen px-6">
          <div className="max-w-lg w-full rounded-2xl border border-red-200 bg-red-50 p-6 space-y-3">
            <p className="font-semibold text-red-600">Error inesperado</p>
            <p className="text-sm text-navy/70 font-mono break-words">{error.message}</p>
            <Button onClick={reset}>Reintentar</Button>
          </div>
        </div>
      </body>
    </html>
  );
}
