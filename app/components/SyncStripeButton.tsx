"use client";
import { useTransition } from "react";
import { syncStripe } from "@/app/actions/syncStripe";

export default function SyncStripeButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => syncStripe())}
      disabled={pending}
      className="flex items-center gap-1.5 text-xs text-navy/50 hover:text-navy transition-colors disabled:opacity-40"
      title="Forzar sincronización con Stripe"
    >
      <svg
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        className={pending ? "animate-spin" : ""}
      >
        <path d="M1 4v6h6M23 20v-6h-6"/>
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
      </svg>
      {pending ? "Sincronizando…" : "Sincronizar Stripe"}
    </button>
  );
}
