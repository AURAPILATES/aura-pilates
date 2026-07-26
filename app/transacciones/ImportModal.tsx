"use client";
import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  importTransactions, undoImport, getRecentImports, forceImportTransactions,
  getKnownContactPatterns, getCategoriesForImport, saveNewContacts, getContacts,
  type ImportRow, type ImportBatch, type NewContactDraft, type Contact,
} from "./actions";
import { contactKeyFor, cleanContactLabel, cleanBankText, matchesPattern, pickIdentifyingText } from "@/lib/contactRules";
import { type Category } from "@/lib/categories";
import type { PaymentMethod } from "@/lib/transactions";
import Drawer from "@/app/components/Drawer";
import Button from "@/app/components/Button";
import Select from "@/app/components/Select";
import { CategoryPill } from "./TransaccionesList";

const ORIGIN_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "banco", label: "CaixaBank" },
  { value: "efectivo", label: "Efectivo Aura" },
  { value: "victor", label: "Víctor" },
  { value: "celia", label: "Celia" },
  { value: "olga", label: "Olga" },
  { value: "carles", label: "Carles" },
];

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

  const dateIdx      = findCol(headers, ["fecha operacion", "f.operacion", "fecha", "date"]);
  const valueDateIdx = findCol(headers, ["fecha valor", "f.valor"]);
  const amountIdx    = findCol(headers, ["importe", "amount", "movimiento", "cargo abono", "importe eur"]);
  const balanceIdx   = findCol(headers, ["saldo", "balance", "saldo disponible", "saldo contable"]);
  const conceptIdx   = findCol(headers, ["movimiento", "concepto", "concept", "descripcion", "description"]);
  const bankDetailsIdx = findCol(headers, ["mas datos", "beneficiario ordenante", "ordenante", "beneficiario", "comercio"]);

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
      valueDate: valueDateIdx >= 0 ? parseDate(cols[valueDateIdx] ?? "") : null,
      amount,
      balance: balanceIdx >= 0 ? parseSpanishNum(cols[balanceIdx] ?? "") : null,
      concept: conceptIdx >= 0 ? (cols[conceptIdx]?.trim() || null) : null,
      bankDetails: bankDetailsIdx >= 0 ? (cols[bankDetailsIdx]?.trim() || null) : null,
    });
  }
  if (rows.length === 0) throw new Error("No se encontraron filas válidas. Revisa el formato del CSV.");
  return rows;
}

// ── Excel parser (.xls / .xlsx) ──────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[áàä]/g, "a").replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i").replace(/[óòö]/g, "o").replace(/[úùü]/g, "u")
    .replace(/[^a-z0-9\/\.\-]/g, " ").trim();
}

function excelSerialToISO(serial: number): string {
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000).toISOString().slice(0, 10);
}

function parseExcel(buffer: ArrayBuffer): ImportRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const candidate = (rawRows[i] ?? []).map((c) => normalizeHeader(String(c ?? "")));
    if (candidate.some((c) => c.includes("fecha")) && candidate.some((c) => c.includes("importe"))) {
      headerIdx = i;
      headers = candidate;
      break;
    }
  }
  if (headerIdx === -1) throw new Error("No se encontró la fila de cabeceras (Fecha / Importe) en el Excel.");

  const dateIdx      = findCol(headers, ["fecha operacion", "fecha"]);
  const valueDateIdx = findCol(headers, ["fecha valor"]);
  const amountIdx    = findCol(headers, ["importe"]);
  const balanceIdx   = findCol(headers, ["saldo"]);
  const conceptIdx   = findCol(headers, ["movimiento", "concepto"]);
  const bankDetailsIdx = findCol(headers, ["mas datos", "beneficiario", "ordenante", "comercio"]);

  if (dateIdx === -1) throw new Error("Columna de fecha no encontrada en el Excel.");
  if (amountIdx === -1) throw new Error("Columna de importe no encontrada en el Excel.");

  const rows: ImportRow[] = [];
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const cols = rawRows[i] ?? [];
    if (cols.length === 0) continue;

    const rawDate = cols[dateIdx];
    const date = typeof rawDate === "number" ? excelSerialToISO(rawDate) : parseDate(String(rawDate ?? ""));
    if (!date) continue;

    const rawValueDate = valueDateIdx >= 0 ? cols[valueDateIdx] : null;
    const valueDate =
      typeof rawValueDate === "number" ? excelSerialToISO(rawValueDate)
      : rawValueDate != null ? parseDate(String(rawValueDate)) : null;

    const rawAmount = cols[amountIdx];
    const amount = typeof rawAmount === "number" ? rawAmount : parseSpanishNum(String(rawAmount ?? ""));
    if (amount === null) continue;

    const rawBalance = balanceIdx >= 0 ? cols[balanceIdx] : null;
    const balance =
      typeof rawBalance === "number" ? rawBalance
      : rawBalance != null && rawBalance !== "" ? parseSpanishNum(String(rawBalance))
      : null;

    rows.push({
      date,
      valueDate,
      amount,
      balance,
      concept: conceptIdx >= 0 && cols[conceptIdx] != null ? String(cols[conceptIdx]).trim() || null : null,
      bankDetails: bankDetailsIdx >= 0 && cols[bankDetailsIdx] != null ? String(cols[bankDetailsIdx]).trim() || null : null,
    });
  }
  if (rows.length === 0) throw new Error("No se encontraron filas válidas. Revisa el formato del Excel.");
  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────────

function fmtDateShort(d: string) {
  const [, m, day] = d.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${months[parseInt(m) - 1]}`;
}

function fmtDateLong(d: string) {
  return d.split("-").reverse().join("/");
}

function dateRange(rows: ImportRow[]): { min: string; max: string } {
  let min = rows[0].date;
  let max = rows[0].date;
  for (const r of rows) {
    if (r.date < min) min = r.date;
    if (r.date > max) max = r.date;
  }
  return { min, max };
}

type ContactDraft = {
  pattern: string;
  bankPatterns: string[];
  sample: string;
  concept: string | null;
  bankDetailsRaw: string | null;
  count: number;
  exampleDate: string;
  exampleAmount: number;
  action: "create" | "attach" | "ignore";
  label: string;
  category: string | null;
  ivaRate: number;
  retencionRate: number;
  attachToContactId: number | null;
};

type State =
  | { kind: "idle" }
  | { kind: "review-contacts"; drafts: ContactDraft[]; rows: ImportRow[]; filename: string }
  | { kind: "preview"; rows: ImportRow[]; filename: string; appliedCount?: number }
  | { kind: "importing" }
  | { kind: "done"; imported: number; skipped: number; skippedRows: ImportRow[]; batchId: string }
  | { kind: "error"; message: string };

/** Sugerencia de categoría por palabra clave para prerellenar el formulario de revisión -
 * mismo criterio que el auto-categorizador del servidor (app/transacciones/actions.ts),
 * pero solo entre categorías ya existentes: nunca propone crear una nueva. */
function suggestCategory(row: ImportRow, categories: Category[]): string | null {
  const hay = `${row.concept ?? ""} ${row.bankDetails ?? ""}`.toLowerCase();
  for (const cat of categories) {
    if (!cat.auto_keywords) continue;
    const kws = cat.auto_keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (kws.some((kw) => hay.includes(kw))) return cat.value;
  }
  return null;
}

function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Lista de conceptos bancarios para un contacto aún no guardado, con la misma UI de chips
 * removibles + input para añadir uno más que usa Configuración > Contactos - pero sin tocar el
 * servidor todavía: se guardan todos juntos al confirmar la revisión. */
function DraftPatternsEditor({ patterns, onChange }: { patterns: string[]; onChange: (patterns: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value || patterns.includes(value)) { setDraft(""); return; }
    onChange([...patterns, value]);
    setDraft("");
  }

  function remove(p: string) {
    onChange(patterns.filter((x) => x !== p));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {patterns.map((p) => (
        <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy/[0.04] rounded-full text-[11px] text-navy/55">
          {p}
          <button onClick={() => remove(p)} className="text-navy/30 hover:text-danger transition-colors">✕</button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder="+ añadir concepto…"
        className="w-36 px-1.5 py-0.5 text-[11px] border border-navy/15 rounded-full focus:outline-none focus:border-primary/40"
      />
    </div>
  );
}

export default function ImportModal({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [origin, setOrigin] = useState<PaymentMethod>("banco");
  const fileRef = useRef<HTMLInputElement>(null);
  const [historial, setHistorial] = useState<ImportBatch[]>([]);
  const [confirmUndo, setConfirmUndo] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [forcingDuplicates, setForcingDuplicates] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [knownPatterns, setKnownPatterns] = useState<Set<string>>(new Set());
  const [savingContacts, setSavingContacts] = useState(false);

  useEffect(() => {
    getRecentImports().then(setHistorial).catch(() => {});
    Promise.all([getCategoriesForImport(), getKnownContactPatterns(), getContacts()])
      .then(([cats, patterns, cs]) => { setCategories(cats); setKnownPatterns(new Set(patterns)); setContacts(cs); })
      .catch(() => {});
  }, []);

  async function handleUndo(batchId: string) {
    setUndoingId(batchId);
    try {
      await undoImport(batchId);
      setHistorial((prev) => prev.filter((b) => b.batchId !== batchId));
      setState((prev) => (prev.kind === "done" && prev.batchId === batchId ? { kind: "idle" } : prev));
    } finally {
      setUndoingId(null);
      setConfirmUndo(null);
    }
  }

  function handleFile(file: File) {
    const name = file.name.toLowerCase();
    const isExcel = name.endsWith(".xls") || name.endsWith(".xlsx");
    const isCSV = name.endsWith(".csv");
    if (!isExcel && !isCSV) {
      setState({ kind: "error", message: "Solo se admiten archivos .csv, .xls o .xlsx exportados desde CaixaBank." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = isExcel
          ? parseExcel(e.target?.result as ArrayBuffer)
          : parseCSV(e.target?.result as string);

        const newContacts = new Map<string, ImportRow>();
        const countByPattern = new Map<string, number>();
        for (const row of rows) {
          const pattern = contactKeyFor(row.concept, row.bankDetails);
          if ([...knownPatterns].some((kp) => matchesPattern(pattern, kp))) continue;
          countByPattern.set(pattern, (countByPattern.get(pattern) ?? 0) + 1);
          if (!newContacts.has(pattern)) newContacts.set(pattern, row);
        }

        if (newContacts.size === 0) {
          setState({ kind: "preview", rows, filename: file.name });
        } else {
          const drafts: ContactDraft[] = [...newContacts.entries()].map(([pattern, row]) => {
            const sample = pickIdentifyingText(row.concept, row.bankDetails) || "(sin concepto)";
            const cleaned = cleanContactLabel(sample);
            const bankPatterns = [cleanBankText(sample) || sample];
            const existing = contacts.find((c) => c.label.toLowerCase() === cleaned.toLowerCase());
            return {
              pattern, bankPatterns, sample,
              concept: row.concept, bankDetailsRaw: row.bankDetails,
              count: countByPattern.get(pattern) ?? 1,
              exampleDate: row.date, exampleAmount: row.amount,
              action: existing ? "attach" : "create",
              label: cleaned,
              category: existing?.category ?? suggestCategory(row, categories),
              ivaRate: existing?.ivaRate ?? 0,
              retencionRate: existing?.retencionRate ?? 0,
              attachToContactId: existing?.id ?? null,
            };
          });
          setState({ kind: "review-contacts", drafts, rows, filename: file.name });
        }
      } catch (err) {
        setState({ kind: "error", message: err instanceof Error ? err.message : "Error al leer el archivo." });
      }
    };
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file, "utf-8");
  }

  function updateDraft(pattern: string, patch: Partial<ContactDraft>) {
    setState((prev) => {
      if (prev.kind !== "review-contacts") return prev;
      return { ...prev, drafts: prev.drafts.map((d) => (d.pattern === pattern ? { ...d, ...patch } : d)) };
    });
  }

  async function handleConfirmContacts(drafts: ContactDraft[], rows: ImportRow[], filename: string) {
    setSavingContacts(true);
    try {
      const payload: NewContactDraft[] = drafts.map((d) => ({
        pattern: d.pattern,
        bankPatterns: d.bankPatterns.length ? d.bankPatterns : [d.pattern],
        action: d.action,
        label: d.label.trim() || d.sample,
        category: d.category,
        ivaRate: d.ivaRate,
        retencionRate: d.retencionRate,
        attachToContactId: d.attachToContactId,
      }));
      const { updated } = await saveNewContacts(payload);
      setKnownPatterns((prev) => {
        const next = new Set(prev);
        for (const d of drafts) {
          next.add(d.pattern);
          for (const p of d.bankPatterns) next.add(p);
        }
        return next;
      });
      setState({ kind: "preview", rows, filename, appliedCount: updated });
    } finally {
      setSavingContacts(false);
    }
  }

  async function handleForceImport(rows: ImportRow[], batchId: string) {
    setForcingDuplicates(true);
    try {
      await forceImportTransactions(rows, origin, batchId);
      const keys = new Set(rows.map((r) => `${r.date}|${r.amount}|${r.concept}`));
      setState((prev) => {
        if (prev.kind !== "done") return prev;
        return { ...prev, skippedRows: prev.skippedRows.filter((r) => !keys.has(`${r.date}|${r.amount}|${r.concept}`)) };
      });
    } finally {
      setForcingDuplicates(false);
    }
  }

  async function doImport(rows: ImportRow[]) {
    setState({ kind: "importing" });
    try {
      const res = await importTransactions(rows, origin);
      setState({ kind: "done", imported: res.imported, skipped: res.skipped, skippedRows: res.skippedRows, batchId: res.batchId });
      if (res.batchId) {
        getRecentImports().then(setHistorial).catch(() => {});
      }
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Error al importar." });
    }
  }

  return (
    <Drawer title="Importar movimientos" onClose={onClose}>
        <div className="px-6 py-5 h-full flex flex-col">

          {/* ── Idle: dropzone ── */}
          {state.kind === "idle" && (
            <div>
              <p className="text-sm text-navy/55 mb-4">
                Sube un extracto de CaixaBank en CSV, XLS o XLSX (Posición Global → Movimientos → Exportar).
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
                  <p className="text-sm font-medium text-navy/70">Arrastra un archivo aquí</p>
                  <p className="text-xs text-navy/40 mt-0.5">CSV, XLS o XLSX - o haz clic para seleccionar</p>
                </div>
                <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>

              {historial.length > 0 && (
                <div className="mt-6">
                  <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-2">Importaciones recientes</p>
                  <div className="space-y-1">
                    {historial.map((b) => (
                      <div key={b.batchId} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-navy/[0.02] transition-colors">
                        <div className="min-w-0">
                          <span className="text-xs text-navy/70 font-medium">
                            {fmtDateShort(b.minDate)} – {fmtDateShort(b.maxDate)}
                          </span>
                          <span className="text-xs text-navy/35 ml-2">
                            {b.count} movs · {b.paymentMethod}
                          </span>
                        </div>
                        {confirmUndo === b.batchId ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setConfirmUndo(null)}
                              className="text-xs text-navy/40 hover:text-navy transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleUndo(b.batchId)}
                              disabled={undoingId === b.batchId}
                              className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors disabled:opacity-50"
                            >
                              {undoingId === b.batchId ? "Deshaciendo…" : "Confirmar"}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmUndo(b.batchId)}
                            className="text-xs text-navy/35 hover:text-danger transition-colors shrink-0"
                          >
                            Deshacer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Review contacts: contactos nuevos detectados en el archivo ── */}
          {state.kind === "review-contacts" && (
            <div className="flex flex-col flex-1 min-h-0">
              <p className="text-sm text-navy/55 mb-1 shrink-0">
                <strong className="text-navy">{state.drafts.length}</strong> {state.drafts.length === 1 ? "contacto nuevo detectado" : "contactos nuevos detectados"}
              </p>
              <p className="text-xs text-navy/45 mb-4 shrink-0">
                Acepta o descarta cada sugerencia. Lo aceptado se aplicará automáticamente la próxima vez que aparezca; lo descartado no se volverá a preguntar.
              </p>
              <div className="space-y-4 mb-4 flex-1 min-h-0 overflow-y-auto pr-1">
                {state.drafts.map((d) => (
                  <div key={d.pattern} className="border border-navy/[0.08] rounded-xl p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="text-xs text-navy truncate">
                          <span className="text-navy/40">Concepto:</span> {d.concept || "-"}
                        </p>
                        <p className="text-xs text-navy truncate mt-1">
                          <span className="text-navy/40">Más datos:</span> {d.bankDetailsRaw || "-"}
                        </p>
                        <p className="text-[11px] text-navy/40 mt-1.5">
                          {d.count} {d.count === 1 ? "movimiento" : "movimientos"} · ej. {fmtDateShort(d.exampleDate)} · {d.exampleAmount >= 0 ? "+" : "−"}{fmtAmt(d.exampleAmount)} €
                        </p>
                      </div>
                      {d.action === "ignore" ? (
                        <button
                          onClick={() => updateDraft(d.pattern, { action: contacts.some((c) => c.id === d.attachToContactId) ? "attach" : "create" })}
                          className="text-xs text-primary hover:text-primary/75 transition-colors shrink-0 whitespace-nowrap"
                        >
                          Deshacer
                        </button>
                      ) : (
                        <button
                          onClick={() => updateDraft(d.pattern, { action: "ignore" })}
                          className="text-xs text-navy/35 hover:text-danger transition-colors shrink-0 whitespace-nowrap"
                        >
                          Descartar
                        </button>
                      )}
                    </div>

                    {d.action === "ignore" ? (
                      <p className="text-xs text-navy/40 italic">Descartado - no se creará un contacto para esto.</p>
                    ) : (
                      <>
                        {contacts.length > 0 && (
                          <div className="flex gap-3 mb-3 text-xs">
                            <label className="flex items-center gap-1.5 text-navy/60 cursor-pointer">
                              <input type="radio" className="accent-navy" checked={d.action === "create"} onChange={() => updateDraft(d.pattern, { action: "create" })} />
                              Contacto nuevo
                            </label>
                            <label className="flex items-center gap-1.5 text-navy/60 cursor-pointer">
                              <input type="radio" className="accent-navy" checked={d.action === "attach"} onChange={() => updateDraft(d.pattern, { action: "attach", attachToContactId: d.attachToContactId ?? contacts[0].id })} />
                              Añadir a contacto existente
                            </label>
                          </div>
                        )}

                        {d.action === "attach" ? (
                          <>
                            <Select
                              value={d.attachToContactId ?? ""}
                              onChange={(e) => updateDraft(d.pattern, { attachToContactId: parseInt(e.target.value, 10) })}
                              className="mb-3"
                            >
                              {contacts.map((c) => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                              ))}
                            </Select>
                            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1.5">Concepto bancario</p>
                            <DraftPatternsEditor
                              patterns={d.bankPatterns}
                              onChange={(bankPatterns) => updateDraft(d.pattern, { bankPatterns })}
                            />
                            <p className="text-[11px] text-navy/35 mt-1.5">Se usará para reconocer este contacto en futuros movimientos.</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1.5">Nombre contacto</p>
                            <input
                              type="text"
                              value={d.label}
                              onChange={(e) => updateDraft(d.pattern, { label: e.target.value })}
                              placeholder="Nombre contacto"
                              className="w-full mb-3 px-2.5 py-1.5 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
                            />
                            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1.5">Concepto bancario</p>
                            <DraftPatternsEditor
                              patterns={d.bankPatterns}
                              onChange={(bankPatterns) => updateDraft(d.pattern, { bankPatterns })}
                            />
                            <p className="text-[11px] text-navy/35 mt-1.5 mb-3">Se usará para reconocer este contacto en futuros movimientos.</p>
                            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1.5">Etiqueta</p>
                            <div className="mb-3">
                              <CategoryPill
                                category={d.category}
                                categories={categories}
                                onChange={(cat) => updateDraft(d.pattern, { category: cat })}
                              />
                            </div>
                            <div className="flex gap-2">
                              <label className="flex-1 flex items-center gap-1.5 text-xs text-navy/50">
                                IVA
                                <input
                                  type="number" min={0} max={100} step={0.5}
                                  value={d.ivaRate}
                                  onChange={(e) => updateDraft(d.pattern, { ivaRate: parseFloat(e.target.value) || 0 })}
                                  className="w-full px-2 py-1.5 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
                                />
                                %
                              </label>
                              <label className="flex-1 flex items-center gap-1.5 text-xs text-navy/50">
                                IRPF
                                <input
                                  type="number" min={0} max={100} step={0.5}
                                  value={d.retencionRate}
                                  onChange={(e) => updateDraft(d.pattern, { retencionRate: parseFloat(e.target.value) || 0 })}
                                  className="w-full px-2 py-1.5 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
                                />
                                %
                              </label>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setState({ kind: "idle" })}
                  className="flex-1 py-2.5 text-sm text-navy/60 border border-navy/15 rounded-lg hover:bg-navy/[0.03] transition-colors"
                >
                  Cambiar archivo
                </button>
                <Button
                  onClick={() => handleConfirmContacts(state.drafts, state.rows, state.filename)}
                  disabled={savingContacts}
                  className="flex-1"
                >
                  {savingContacts ? "Guardando…" : "Continuar"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Preview ── */}
          {state.kind === "preview" && (() => {
            const { min, max } = dateRange(state.rows);
            return (
            <div>
              <div className="flex items-center gap-3 p-4 bg-primary/[0.06] border border-primary/15 rounded-xl mb-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy truncate">{state.filename}</p>
                  <p className="text-xs text-navy/55 mt-0.5">
                    {fmtDateLong(min)} a {fmtDateLong(max)} · <strong className="text-navy/70 font-semibold">{state.rows.length}</strong> movimientos
                  </p>
                </div>
              </div>
              {!!state.appliedCount && (
                <p className="text-xs text-primary/70 mb-3">
                  {state.appliedCount} {state.appliedCount === 1 ? "movimiento anterior actualizado" : "movimientos anteriores actualizados"} con el contacto que acabas de confirmar.
                </p>
              )}
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-navy/40 uppercase tracking-wider mb-1.5">Origen o banco</p>
                <Select value={origin} onChange={(e) => setOrigin(e.target.value as PaymentMethod)}>
                  {ORIGIN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
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
                        <td className="px-3 py-2 text-navy/60 whitespace-nowrap tabular-nums">{fmtDateLong(r.date)}</td>
                        <td className="px-3 py-2 text-navy truncate max-w-[200px]">{r.concept ?? r.bankDetails ?? "-"}</td>
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
                <Button onClick={() => doImport(state.rows)} className="flex-1">
                  Importar {state.rows.length} movimientos
                </Button>
              </div>
            </div>
            );
          })()}

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
              {state.skippedRows.length > 0 && (
                <p className="text-sm text-navy/45">{state.skippedRows.length} posibles duplicados</p>
              )}
              <Button onClick={onClose} className="mt-5">
                Cerrar
              </Button>

              {state.skippedRows.length > 0 && (
                <div className="mt-5 border border-navy/[0.08] rounded-xl overflow-hidden text-left">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-navy/[0.02] border-b border-navy/[0.06]">
                    <span className="text-xs font-semibold text-navy/50">Posibles duplicados</span>
                    <button
                      onClick={() => handleForceImport(state.skippedRows, state.batchId)}
                      disabled={forcingDuplicates}
                      className="text-xs font-medium text-primary hover:text-primary/75 transition-colors disabled:opacity-40"
                    >
                      Importar todos
                    </button>
                  </div>
                  <div className="divide-y divide-navy/[0.04]">
                    {state.skippedRows.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-xs text-navy/45 whitespace-nowrap tabular-nums shrink-0">
                          {fmtDateLong(r.date)}
                        </span>
                        <span className="text-xs text-navy truncate flex-1">
                          {r.concept ?? r.bankDetails ?? "-"}
                        </span>
                        <span className={`text-xs font-semibold tabular-nums shrink-0 ${r.amount >= 0 ? "text-success" : "text-navy/70"}`}>
                          {r.amount >= 0 ? "+" : "−"}{fmtAmt(r.amount)} €
                        </span>
                        <button
                          onClick={() => handleForceImport([r], state.batchId)}
                          disabled={forcingDuplicates}
                          className="text-xs text-navy/35 hover:text-primary transition-colors shrink-0 disabled:opacity-40"
                        >
                          Importar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {state.batchId && (
                <div className="mt-4">
                  {confirmUndo === state.batchId ? (
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => setConfirmUndo(null)} className="text-xs text-navy/40 hover:text-navy transition-colors">
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleUndo(state.batchId)}
                        disabled={!!undoingId}
                        className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors disabled:opacity-50"
                      >
                        {undoingId ? "Deshaciendo…" : "Sí, deshacer importación"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmUndo(state.batchId)}
                      className="text-xs text-navy/35 hover:text-danger transition-colors"
                    >
                      Deshacer esta importación
                    </button>
                  )}
                </div>
              )}
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
    </Drawer>
  );
}
