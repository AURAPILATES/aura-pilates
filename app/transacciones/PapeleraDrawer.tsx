"use client";
import { useState, useEffect, useRef } from "react";
import Drawer from "@/app/components/Drawer";
import { loadDeletedTransactions, restoreTransactions, type DeletedTransaction } from "./actions";

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function SourceAvatar({ method }: { method: string }) {
  if (method === "efectivo") {
    return (
      <div className="shrink-0 w-[22px] h-[22px] rounded-full bg-amber-100 dark:bg-[#3d2f13] flex items-center justify-center" title="Efectivo">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#92400E] dark:text-[#fcd34d]">
          <rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="13" r="3"/><path d="M6 10h.01M18 10h.01"/>
        </svg>
      </div>
    );
  }
  return (
    <img src="/Caixabank logo.png" alt="CaixaBank" width={16} height={16} className="shrink-0 object-contain" />
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-navy/[0.05] text-navy/50 whitespace-nowrap">
      {category ?? "Sin categoría"}
    </span>
  );
}

function RestoreButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick() {
    if (!confirm) {
      setConfirm(true);
      timerRef.current = setTimeout(() => setConfirm(false), 3000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      onClick();
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`shrink-0 text-xs font-medium transition-colors disabled:opacity-40 whitespace-nowrap ${
        confirm ? "text-success font-semibold" : "text-navy/35 hover:text-primary"
      }`}
    >
      {confirm ? "¿Restaurar?" : "Restaurar"}
    </button>
  );
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
    <Drawer title="Papelera" subtitle={subtitle} onClose={onClose} maxWidth="max-w-[560px]">
      <div className="py-2">
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
            <div className="flex justify-end px-5 py-2 border-b border-navy/[0.06]">
              <button
                onClick={() => handleRestore(items.map((t) => t.id))}
                disabled={restoring.size > 0}
                className="text-xs font-medium text-primary hover:text-primary/75 transition-colors disabled:opacity-40"
              >
                Restaurar todas ({items.length})
              </button>
            </div>

            <div className="divide-y divide-navy/[0.04]">
              {items.map((t) => {
                const isRestoring = restoring.has(t.id);
                const primary = t.contact || t.concept || "—";
                const secondary = t.contact && t.concept && t.concept !== t.contact ? t.concept : null;

                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 px-5 py-3 transition-opacity ${isRestoring ? "opacity-40 pointer-events-none" : "hover:bg-navy/[0.01]"}`}
                  >
                    <SourceAvatar method={t.payment_method} />

                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-navy truncate block">{primary}</span>
                      {secondary && <p className="text-[11px] text-navy/40 truncate mt-0.5">{secondary}</p>}
                    </div>

                    <CategoryBadge category={t.category} />

                    <span className="text-xs text-navy/40 tabular-nums whitespace-nowrap shrink-0">
                      {fmtDate(t.date)}
                    </span>

                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${t.amount > 0 ? "text-success" : "text-navy/75"}`}>
                      {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                    </span>

                    <RestoreButton onClick={() => handleRestore([t.id])} disabled={restoring.size > 0} />
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
