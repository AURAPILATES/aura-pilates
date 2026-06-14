"use client";
import { useState, useRef } from "react";
import { importTransactions, type ImportRow } from "./actions";

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === sep && !inQ) {
      result.push(cur.trim()); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex((h) => h === c || h.includes(c));
    if (i >= 0) return i;
  }
  return -1;
}

function parseSpanishNum(s: string): number | null {
  const c = s.replace(/[€\s]/g, "").trim();
  if (!c) return null;
  // "1.250,34" → 1250.34  |  "1,250.34" (US) → 1250.34
  const n = c.includes(",")
    ? parseFloat(c.replace(/\./g, "").replace(",", "."))
    : parseFloat(c);
  return isNaN(n) ? null : n;
}

function parseDate(s: string): string | null {
  const t = s.trim();
  const dmy = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("El archivo no contiene datos.");

  const sep = (lines[0].split(";").length > lines[0].split(",").length) ? ";" : ",";
  const headers = parseLine(lines[0], sep).map((h) =>
    h.toLowerCase().replace(/[áàä]/g, "a").replace(/[éèë]/g, "e")
      .replace(/[íìï]/g, "i").replace(/[óòö]/g, "o").replace(/[úùü]/g, "u")
      .replace(/[^a-z0-9\/\.\-]/g, " ").trim()
  );

  const dateIdx    = findCol(headers, ["fecha", "f.operacion", "f.valor", "fecha operacion", "fecha valor", "date"]);
  const amountIdx  = findCol(headers, ["importe", "amount", "movimiento", "cargo abono", "importe eur"]);
  const balanceIdx = findCol(headers, ["saldo", "balance", "saldo disponible", "saldo contable"]);
  const conceptIdx = findCol(headers, ["concepto", "concept", "descripcion", "description"]);
  const contactIdx = findCol(headers, ["beneficiario ordenante", "contact", "contacto", "ordenante", "beneficiario", "comercio"]);

  if (dateIdx === -1) throw new Error(`Columna de fecha no encontrada. Cabeceras: ${headers.join(" | ")}`);
  if (amountIdx === -1) throw new Error(`Columna de importe no encontrada. Cabeceras: ${headers.join(" | ")}`);

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i], sep);
    const date = parseDate(cols[dateIdx] ?? "");
    if (!date) continue;
    const amount = parseSpanishNum(cols[amountIdx] ?? "");
    if (amount === null) continue;
    rows.push({
      date,
      amount,
      balance: balanceIdx >= 0 ? parseSpanishNum(cols[balanceIdx] ?? "") : null,
      concept: conceptIdx >= 0 ? (cols[conceptIdx]?.trim() || null) : null,
      contact: contactIdx >= 0 ? (cols[contactIdx]?.trim() || null) : null,
    });
  }
  if (rows.length === 0) throw new Error("No se encontraron filas válidas. Revisa el formato del CSV.");
  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────────

type State =
  | { kind: "idle" }
  | { kind: "preview"; rows: ImportRow[]; filename: string }
  | { kind: "importing" }
  | { kind: "done"; imported: number; skipped: number }
  | { kind: "error"; message: string };

function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ImportModal({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setState({ kind: "error", message: "Solo se admiten archivos .csv — exporta tu extracto bancario como CSV desde CaixaBank." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseCSV(e.target?.result as string);
        setState({ kind: "preview", rows, filename: file.name });
      } catch (err) {
        setState({ kind: "error", message: err instanceof Error ? err.message : "Error al leer el archivo." });
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function doImport(rows: ImportRow[]) {
    setState({ kind: "importing" });
    try {
      const res = await importTransactions(rows);
      setState({ kind: "done", ...res });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Error al importar." });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy/[0.07]">
          <h2 className="text-base font-bold text-navy font-display">Importar movimientos</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-navy/40 hover:text-navy hover:bg-navy/5 transition-colors">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">

          {/* ── Idle: dropzone ── */}
          {state.kind === "idle" && (
            <div>
              <p className="text-sm text-navy/55 mb-4">
                Sube un extracto CSV de CaixaBank (Posición Global → Movimientos → Exportar).
              </p>
              <label
                className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-navy/15 rounded-xl cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02] transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy/30">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium text-navy/70">Arrastra un CSV aquí</p>
                  <p className="text-xs text-navy/40 mt-0.5">o haz clic para seleccionar</p>
                </div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
            </div>
          )}

          {/* ── Preview ── */}
          {state.kind === "preview" && (
            <div>
              <p className="text-sm text-navy/55 mb-3">
                <span className="font-medium text-navy">{state.filename}</span>
                {" · "}<strong className="text-navy">{state.rows.length}</strong> movimientos detectados
              </p>
              <div className="border border-navy/[0.07] rounded-xl overflow-hidden mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-navy/[0.02] border-b border-navy/[0.06]">
                      <th className="text-left px-3 py-2 text-navy/45 font-semibold uppercase tracking-wide">Fecha</th>
                      <th className="text-left px-3 py-2 text-navy/45 font-semibold uppercase tracking-wide">Concepto</th>
                      <th className="text-right px-3 py-2 text-navy/45 font-semibold uppercase tracking-wide">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-b border-navy/[0.04] last:border-0">
                        <td className="px-3 py-2 text-navy/60 whitespace-nowrap tabular-nums">{r.date.split("-").reverse().join("/")}</td>
                        <td className="px-3 py-2 text-navy truncate max-w-[200px]">{r.concept ?? r.contact ?? "—"}</td>
                        <td className={`px-3 py-2 text-right font-semibold tabular-nums ${r.amount >= 0 ? "text-success" : "text-navy/70"}`}>
                          {r.amount >= 0 ? "+" : "−"}{fmtAmt(r.amount)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {state.rows.length > 5 && (
                  <p className="text-center text-xs text-navy/35 py-2 border-t border-navy/[0.04]">
                    y {state.rows.length - 5} más…
                  </p>
                )}
              </div>
              <p className="text-xs text-navy/45 mb-4">
                Las categorías se asignarán automáticamente según las palabras clave configuradas. Puedes cambiarlas después.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setState({ kind: "idle" })}
                  className="flex-1 py-2.5 text-sm text-navy/60 border border-navy/15 rounded-lg hover:bg-navy/[0.03] transition-colors"
                >
                  Cambiar archivo
                </button>
                <button
                  onClick={() => doImport(state.rows)}
                  className="flex-1 py-2.5 text-sm font-semibold bg-navy text-white rounded-lg hover:bg-navy/85 transition-colors"
                >
                  Importar {state.rows.length} movimientos
                </button>
              </div>
            </div>
          )}

          {/* ── Importing ── */}
          {state.kind === "importing" && (
            <div className="py-10 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-navy/55">Importando movimientos…</p>
            </div>
          )}

          {/* ── Done ── */}
          {state.kind === "done" && (
            <div className="py-6 text-center">
              <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p className="text-base font-bold text-navy mb-1">{state.imported} movimientos importados</p>
              {state.skipped > 0 && (
                <p className="text-sm text-navy/45">{state.skipped} ya existían y se omitieron</p>
              )}
              <button
                onClick={onClose}
                className="mt-5 px-6 py-2 text-sm font-semibold bg-navy text-white rounded-lg hover:bg-navy/85 transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {state.kind === "error" && (
            <div>
              <div className="flex items-start gap-3 p-4 bg-danger/[0.06] border border-danger/20 rounded-xl mb-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-sm text-danger">{state.message}</p>
              </div>
              <button onClick={() => setState({ kind: "idle" })} className="text-sm text-navy/55 hover:text-navy underline transition-colors">
                Intentar de nuevo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
