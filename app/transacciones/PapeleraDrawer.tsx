"use client";
import { useState, useEffect } from "react";
import Drawer from "@/app/components/Drawer";
import { loadDeletedTransactions, restoreTransactions, type DeletedTransaction } from "./actions";

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function PapeleraDrawer({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<DeletedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDeletedTransactions().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleRestore(ids: string[]) {
    setRestoring(new Set(ids));
    try {
      await restoreTransactions(ids);
      setItems((prev) => prev.filter((t) => !ids.includes(t.id)));
    } finally {
      setRestoring(new Set());
    }
  }

  const subtitle = loading ? "" : items.length === 0 ? "Vacía" : `${items.length} transacción${items.length !== 1 ? "es" : ""}`;

  return (
    <Drawer title="Papelera" subtitle={subtitle} onClose={onClose} maxWidth="max-w-[500px]">
      <div className="px-6 py-4">
        {loading && (
          <div className="py-10 text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-navy/[0.04] flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy/30">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </div>
            <p className="text-sm text-navy/45">La papelera está vacía</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            <div className="flex justify-end mb-3">
              <button
                onClick={() => handleRestore(items.map((t) => t.id))}
                disabled={restoring.size > 0}
                className="text-xs font-medium text-primary hover:text-primary/75 transition-colors disabled:opacity-40"
              >
                Restaurar todas ({items.length})
              </button>
            </div>
            <div className="divide-y divide-navy/[0.05]">
              {items.map((t) => {
                const isRestoring = restoring.has(t.id);
                const primary = t.contact || t.concept || "—";
                const secondary = t.contact && t.concept && t.concept !== t.contact ? t.concept : null;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 py-3 transition-opacity ${isRestoring ? "opacity-40 pointer-events-none" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-sm font-medium text-navy truncate">{primary}</span>
                        <span className={`text-sm font-semibold tabular-nums shrink-0 ${t.amount > 0 ? "text-success" : "text-navy/75"}`}>
                          {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-navy/40 tabular-nums">{fmtDate(t.date)}</span>
                        {secondary && <span className="text-[11px] text-navy/35 truncate max-w-[180px]">{secondary}</span>}
                        <span className="text-[11px] text-navy/30">{t.category}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestore([t.id])}
                      disabled={restoring.size > 0}
                      className="shrink-0 text-xs font-medium text-primary hover:text-primary/75 transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                      Restaurar
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
