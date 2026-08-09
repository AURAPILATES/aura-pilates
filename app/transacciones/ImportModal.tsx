"use client";
import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { UserPlus, ArrowDownLeft, ArrowUpRight } from "react-feather";
import {
  importTransactions, undoImport, getRecentImports, forceImportTransactions,
  getKnownContactPatterns, getCategoriesForImport, saveNewContacts, getContacts,
  type ImportRow, type ImportBatch, type NewContactDraft, type Contact,
} from "./actions";
import { contactKeyFor, cleanContactLabel, cleanBankText, matchesPattern, pickIdentifyingText } from "@/lib/contactRules";
import { CONTACT_GROUP_ORDER, CONTACT_GROUP_LABELS, type ContactGroup } from "@/lib/contactGroups";
import { type Category } from "@/lib/categories";
import type { PaymentMethod } from "@/lib/transactions";
import Drawer from "@/app/components/Drawer";
import Button, { SecondaryButton, DangerButtonSolid } from "@/app/components/Button";
import Select from "@/app/components/Select";
import ChipsInput from "@/app/components/ChipsInput";
import Checkbox from "@/app/components/Checkbox";
import UnitInput from "@/app/components/UnitInput";
import { ToggleGroup } from "@/components/charts";
import { CategoryPill } from "./TransaccionesList";
import { AutomationIcon } from "./NewContactDrawer";

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
  if (dmy) {
    // Se asume día/mes/año (formato de CaixaBank) - un día o mes fuera de rango (ej. una
    // columna equivocada, o un extracto en otro formato con mes>12) se descarta en vez de
    // colarse como una fecha ISO inválida que reviente más adelante en silencio.
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

type ParseResult = { rows: ImportRow[]; unparsedCount: number };

function parseCSV(text: string): ParseResult {
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
  // "movimiento" no debe ser candidato de amountIdx: en los extractos de CaixaBank es la cabecera
  // del CONCEPTO (ver conceptIdx debajo), nunca del importe - tenerlo aquí también podía hacer
  // que, si ninguna cabecera de importe reconocida coincidía, el importe se leyera por error de
  // la columna de concepto.
  const amountIdx    = findCol(headers, ["importe", "amount", "cargo abono", "importe eur"]);
  const balanceIdx   = findCol(headers, ["saldo", "balance", "saldo disponible", "saldo contable"]);
  const conceptIdx   = findCol(headers, ["movimiento", "concepto", "concept", "descripcion", "description"]);
  const bankDetailsIdx = findCol(headers, ["mas datos", "beneficiario ordenante", "ordenante", "beneficiario", "comercio"]);

  if (dateIdx === -1) throw new Error(`Columna de fecha no encontrada. Cabeceras: ${headers.join(" | ")}`);
  if (amountIdx === -1) throw new Error(`Columna de importe no encontrada. Cabeceras: ${headers.join(" | ")}`);

  const rows: ImportRow[] = [];
  let unparsedCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i], sep);
    const date = parseDate(cols[dateIdx] ?? "");
    if (!date) { unparsedCount++; continue; }
    const amount = parseSpanishNum(cols[amountIdx] ?? "");
    if (amount === null) { unparsedCount++; continue; }
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
  return { rows, unparsedCount };
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

function parseExcel(buffer: ArrayBuffer): ParseResult {
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
  let unparsedCount = 0;
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const cols = rawRows[i] ?? [];
    if (cols.length === 0) continue; // fila realmente vacía (relleno de la hoja), no cuenta como fallo

    const rawDate = cols[dateIdx];
    const date = typeof rawDate === "number" ? excelSerialToISO(rawDate) : parseDate(String(rawDate ?? ""));
    if (!date) { unparsedCount++; continue; }

    const rawValueDate = valueDateIdx >= 0 ? cols[valueDateIdx] : null;
    const valueDate =
      typeof rawValueDate === "number" ? excelSerialToISO(rawValueDate)
      : rawValueDate != null ? parseDate(String(rawValueDate)) : null;

    const rawAmount = cols[amountIdx];
    const amount = typeof rawAmount === "number" ? rawAmount : parseSpanishNum(String(rawAmount ?? ""));
    if (amount === null) { unparsedCount++; continue; }

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
  return { rows, unparsedCount };
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
  count: number;
  lastDate: string;
  totalAmount: number;
  action: "create" | "attach" | "ignore";
  label: string;
  category: string | null;
  ivaRate: number;
  retencionRate: number;
  noTax: boolean;
  group: ContactGroup;
  attachToContactId: number | null;
  /** Fusionar con OTRO contacto nuevo detectado en este mismo archivo (en vez de uno ya
   * guardado) - guarda su patrón. Mutuamente excluyente con attachToContactId. */
  attachToDraftPattern: string | null;
  /** Contacto ya guardado cuyo nombre coincide del todo o en parte - se preselecciona "Añadir
   * a existente" con este contacto y se muestra primero en el desplegable. */
  suggestedContactId: number | null;
};

type State =
  | { kind: "idle" }
  | { kind: "preview"; rows: ImportRow[]; filename: string; drafts: ContactDraft[]; appliedCount?: number; unparsedCount: number }
  | { kind: "review-contacts"; drafts: ContactDraft[]; rows: ImportRow[]; filename: string; unparsedCount: number }
  | { kind: "importing" }
  | { kind: "done"; imported: number; skipped: number; skippedRows: ImportRow[]; batchId: string; appliedCount?: number; unparsedCount: number }
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

/** Iniciales para el avatar del contacto: 2 letras de la primera palabra, o 1ª letra de las
 * dos primeras palabras si hay más de una (igual criterio que un avatar de persona/empresa). */
function initialsOf(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** ¿Podrían ser el mismo contacto? Coincidencia por nombre completo o parcial (uno contiene al
 * otro), no exige igualdad exacta - así "Aura Pilates Stud" (ya guardado, recortado por el
 * banco) reconoce "Aura Pilates Studio" (sugerido ahora). */
function looksLikeSameContact(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

/** Contacto ya guardado que probablemente sea este mismo, por nombre o por alguno de sus
 * conceptos bancarios ya reconocidos. */
function findPossibleContact(cleaned: string, sample: string, contacts: Contact[]): Contact | undefined {
  return contacts.find((c) => looksLikeSameContact(c.label, cleaned))
    ?? contacts.find((c) => c.patterns.some((p) => looksLikeSameContact(p, sample)));
}

/** Explica lo que va a pasar antes de deshacer una importación - undoImport (ver actions.ts)
 * borra en firme, no pasa por la papelera, y borra TODOS los movimientos con ese batch_id tal
 * como estén ahora mismo (incluidos los que se hayan forzado a importar desde "posibles
 * duplicados" después). Tampoco deshace los contactos nuevos creados durante esa importación. */
function UndoImportDrawer({
  count, dateRange, busy, onClose, onConfirm,
}: {
  count: number | null;
  dateRange: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (close: () => void) => void;
}) {
  return (
    <Drawer
      title="Deshacer importación"
      onClose={onClose}
      footer={(close) => (
        <div className="flex gap-3">
          <SecondaryButton onClick={close} disabled={busy} className="flex-1">
            Cancelar
          </SecondaryButton>
          <DangerButtonSolid onClick={() => onConfirm(close)} disabled={busy} className="flex-1">
            {busy ? "Deshaciendo…" : "Sí, deshacer"}
          </DangerButtonSolid>
        </div>
      )}
    >
      <div className="px-6 py-5 space-y-3 text-sm text-navy/70 leading-relaxed">
        <p>
          Se borrarán {count != null ? <>los <strong className="text-navy font-semibold">{count}</strong> movimientos</> : "todos los movimientos"} de esa importación
          {dateRange ? ` (${dateRange})` : ""} y no podrás recuperarlos después.
        </p>
        <p>
          Si marcaste algún ingreso o gasto como recurrente, lo perderás también y deberás crearlo de nuevo.
        </p>
        <p>
          Los contactos nuevos que hayas confirmado durante esta importación no se deshacen - seguirán existiendo.
        </p>
      </div>
    </Drawer>
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

  async function handleUndo(batchId: string, close?: () => void) {
    setUndoingId(batchId);
    try {
      await undoImport(batchId);
      setHistorial((prev) => prev.filter((b) => b.batchId !== batchId));
      setState((prev) => (prev.kind === "done" && prev.batchId === batchId ? { kind: "idle" } : prev));
      close?.();
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
        const { rows, unparsedCount } = isExcel
          ? parseExcel(e.target?.result as ArrayBuffer)
          : parseCSV(e.target?.result as string);

        const newContacts = new Map<string, ImportRow>();
        const countByPattern = new Map<string, number>();
        const sumByPattern = new Map<string, number>();
        const lastDateByPattern = new Map<string, string>();
        for (const row of rows) {
          const pattern = contactKeyFor(row.concept, row.bankDetails);
          if ([...knownPatterns].some((kp) => matchesPattern(pattern, kp))) continue;
          countByPattern.set(pattern, (countByPattern.get(pattern) ?? 0) + 1);
          sumByPattern.set(pattern, (sumByPattern.get(pattern) ?? 0) + row.amount);
          if (!lastDateByPattern.has(pattern) || row.date > lastDateByPattern.get(pattern)!) {
            lastDateByPattern.set(pattern, row.date);
          }
          if (!newContacts.has(pattern)) newContacts.set(pattern, row);
        }

        const drafts: ContactDraft[] = [...newContacts.entries()].map(([pattern, row]) => {
          const sample = pickIdentifyingText(row.concept, row.bankDetails) || "(sin concepto)";
          const cleaned = cleanContactLabel(sample);
          const bankPatterns = [cleanBankText(sample) || sample];
          const existing = findPossibleContact(cleaned, sample, contacts);
          return {
            pattern, bankPatterns, sample,
            count: countByPattern.get(pattern) ?? 1,
            lastDate: lastDateByPattern.get(pattern) ?? row.date,
            totalAmount: sumByPattern.get(pattern) ?? row.amount,
            action: existing ? "attach" : "create",
            label: cleaned,
            category: existing?.category ?? suggestCategory(row, categories),
            ivaRate: existing?.ivaRate ?? 0,
            retencionRate: existing?.retencionRate ?? 0,
            noTax: existing?.noTax ?? false,
            group: "proveedor",
            attachToContactId: existing?.id ?? null,
            attachToDraftPattern: null,
            suggestedContactId: existing?.id ?? null,
          };
        });
        setState({ kind: "preview", rows, filename: file.name, drafts, unparsedCount });
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
      let drafts = prev.drafts.map((d) => (d.pattern === pattern ? { ...d, ...patch } : d));
      // Si este borrador deja de ser "contacto nuevo" (pasa a "attach" o "ignore"), cualquier
      // otro borrador que lo tuviera como destino de "añadir a otro contacto de este archivo" se
      // queda apuntando a un target que ya no es tal - se revierte a "contacto nuevo" en vez de
      // dejarlo encadenado, porque handleConfirmContacts solo resuelve un nivel de fusión y sus
      // patrones se perderían en silencio al confirmar (nunca llegarían al destino final).
      if (patch.action && patch.action !== "create") {
        drafts = drafts.map((d) =>
          d.pattern !== pattern && d.attachToDraftPattern === pattern
            ? { ...d, action: "create", attachToDraftPattern: null }
            : d,
        );
      }
      return { ...prev, drafts };
    });
  }

  async function handleConfirmContacts(drafts: ContactDraft[], rows: ImportRow[], unparsedCount: number) {
    setSavingContacts(true);
    try {
      // Resuelve fusiones: un draft con attachToDraftPattern apunta a OTRO contacto detectado
      // en este mismo archivo (no uno ya guardado) - se absorbe en el destino (sus "conceptos
      // para reconocerlo" pasan a él) y no genera su propio contacto.
      const byPattern = new Map(drafts.map((d) => [d.pattern, { ...d, bankPatterns: [...d.bankPatterns] }]));
      for (const d of drafts) {
        if (d.action !== "attach" || !d.attachToDraftPattern) continue;
        const target = byPattern.get(d.attachToDraftPattern);
        if (target) target.bankPatterns = [...new Set([...target.bankPatterns, ...d.bankPatterns])];
      }
      const effectiveDrafts = drafts
        .filter((d) => !(d.action === "attach" && d.attachToDraftPattern))
        .map((d) => byPattern.get(d.pattern)!);

      const payload: NewContactDraft[] = effectiveDrafts.map((d) => ({
        pattern: d.pattern,
        bankPatterns: d.bankPatterns.length ? d.bankPatterns : [d.pattern],
        action: d.action,
        label: d.label.trim() || d.sample,
        category: d.category,
        ivaRate: d.ivaRate,
        retencionRate: d.retencionRate,
        noTax: d.noTax,
        group: d.group,
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
      await doImport(rows, updated, unparsedCount);
    } finally {
      setSavingContacts(false);
    }
  }

  // Reconcilia por posición dentro de `skippedRows`, no por contenido: dos "posibles
  // duplicados" distintos pueden tener fecha+importe+concepto idénticos de casualidad (ej. dos
  // alumnas pagando lo mismo el mismo día con un concepto bancario genérico) - forzar uno solo
  // no debe hacer desaparecer también al otro sin haberlo importado.
  async function handleForceImport(indices: number[], batchId: string) {
    if (state.kind !== "done" || indices.length === 0) return;
    const rows = indices.map((i) => state.skippedRows[i]).filter((r): r is ImportRow => !!r);
    if (rows.length === 0) return;
    setForcingDuplicates(true);
    try {
      await forceImportTransactions(rows, origin, batchId);
      const toRemove = new Set(indices);
      setState((prev) => {
        if (prev.kind !== "done") return prev;
        return { ...prev, skippedRows: prev.skippedRows.filter((_, i) => !toRemove.has(i)) };
      });
    } finally {
      setForcingDuplicates(false);
    }
  }

  async function doImport(rows: ImportRow[], appliedCount: number | undefined, unparsedCount: number) {
    setState({ kind: "importing" });
    try {
      const res = await importTransactions(rows, origin);
      setState({ kind: "done", imported: res.imported, skipped: res.skipped, skippedRows: res.skippedRows, batchId: res.batchId, appliedCount, unparsedCount });
      if (res.batchId) {
        getRecentImports().then(setHistorial).catch(() => {});
      }
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Error al importar." });
    }
  }

  return (
    <>
    <Drawer title="Importar movimientos" onClose={onClose}>
        <div className="px-6 py-5 h-full flex flex-col">

          {/* ── Idle: dropzone ── */}
          {state.kind === "idle" && (
            <div>
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
                        <button
                          onClick={() => setConfirmUndo(b.batchId)}
                          className="text-xs text-navy/35 hover:text-danger transition-colors shrink-0"
                        >
                          Deshacer
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Preview: resumen de lo que se va a importar (primero) ── */}
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
              {state.unparsedCount > 0 && (
                <div className="flex items-start gap-3 p-3.5 bg-warning/[0.08] border border-warning/20 rounded-xl mb-4">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning shrink-0 mt-0.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <p className="text-xs text-navy/70 leading-snug">
                    <strong className="font-semibold">
                      {state.unparsedCount} {state.unparsedCount === 1 ? "fila no se ha podido leer" : "filas no se han podido leer"}
                    </strong>{" "}
                    (fecha o importe no reconocidos) y no {state.unparsedCount === 1 ? "se importará" : "se importarán"}. Revisa el archivo si esperabas más movimientos.
                  </p>
                </div>
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
              {state.drafts.length > 0 ? (
                <div className="flex items-center gap-3 mb-4 px-3.5 py-3 bg-primary/[0.06] border border-primary/15 rounded-xl">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserPlus size={15} className="text-primary" />
                  </span>
                  <p className="text-xs text-navy/70 leading-snug">
                    Se {state.drafts.length === 1 ? "ha detectado" : "han detectado"}{" "}
                    <strong className="text-navy font-semibold">
                      {state.drafts.length} {state.drafts.length === 1 ? "contacto nuevo" : "contactos nuevos"}
                    </strong>
                    . Los revisarás en el siguiente paso.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-navy/45 mb-4">
                  Las categorías se asignarán automáticamente según las palabras clave configuradas. Puedes cambiarlas después.
                </p>
              )}
              <div className="flex gap-2">
                <SecondaryButton onClick={() => setState({ kind: "idle" })} className="flex-1">
                  Cambiar archivo
                </SecondaryButton>
                {state.drafts.length > 0 ? (
                  <Button
                    onClick={() => setState({ kind: "review-contacts", drafts: state.drafts, rows: state.rows, filename: state.filename, unparsedCount: state.unparsedCount })}
                    className="flex-1"
                  >
                    Continuar
                  </Button>
                ) : (
                  <Button onClick={() => doImport(state.rows, undefined, state.unparsedCount)} className="flex-1">
                    Importar {state.rows.length} movimientos
                  </Button>
                )}
              </div>
            </div>
            );
          })()}

          {/* ── Review contacts: contactos nuevos detectados (segundo paso) ── */}
          {state.kind === "review-contacts" && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="shrink-0 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/[0.08] text-primary rounded-full text-xs font-semibold">
                  <UserPlus size={13} />
                  {state.drafts.length} {state.drafts.length === 1 ? "contacto nuevo" : "contactos nuevos"}
                </span>
              </div>
              <p className="text-xs text-navy/45 mb-4 shrink-0">
                Confirma o descarta la sugerencia. Lo que guardes se aplicará solo la próxima vez; lo descartado no se vuelve a preguntar.
              </p>
              <div className="space-y-4 mb-4 flex-1 min-h-0 overflow-y-auto pr-1">
                {state.drafts.map((d) => {
                  const isIncome = d.totalAmount >= 0;
                  const siblingCreateDrafts = state.drafts.filter((sd) => sd.pattern !== d.pattern && sd.action === "create");
                  const hasAttachTargets = contacts.length > 0 || siblingCreateDrafts.length > 0;
                  const sortedContacts = [...contacts].sort((a, b) => {
                    if (a.id === d.suggestedContactId) return -1;
                    if (b.id === d.suggestedContactId) return 1;
                    return 0;
                  });
                  return (
                  <div key={d.pattern} className="border border-navy/[0.08] rounded-xl p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-[13px] font-bold text-primary shrink-0">
                          {initialsOf(d.label || d.sample)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-navy truncate">{d.label || d.sample}</p>
                          <p className="text-xs text-navy/40 mt-0.5">
                            {d.count} {d.count === 1 ? "movimiento" : "movimientos"} · últ. {fmtDateShort(d.lastDate)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${isIncome ? "text-success" : "text-navy"}`}>
                          {isIncome ? "+" : "−"}{fmtAmt(d.totalAmount)} €
                        </p>
                        <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isIncome ? "bg-success/10 text-success" : "bg-navy/[0.06] text-navy/55"
                        }`}>
                          {isIncome ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                          {isIncome ? "Ingreso" : "Gasto"}
                        </span>
                      </div>
                    </div>

                    {d.action === "ignore" ? (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-navy/40 italic">Descartado - no se creará un contacto para esto.</p>
                        <button
                          onClick={() => updateDraft(d.pattern, { action: (d.attachToDraftPattern || contacts.some((c) => c.id === d.attachToContactId)) ? "attach" : "create" })}
                          className="text-xs text-primary hover:text-primary/75 transition-colors shrink-0 whitespace-nowrap"
                        >
                          Deshacer
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2 mb-3.5">
                          {hasAttachTargets ? (
                            <ToggleGroup
                              value={d.action}
                              onChange={(v) => updateDraft(d.pattern, v === "attach"
                                ? { action: "attach", attachToContactId: d.attachToContactId ?? d.suggestedContactId ?? contacts[0]?.id ?? null }
                                : { action: "create" })}
                              options={[
                                { value: "create", label: "Contacto nuevo" },
                                { value: "attach", label: "Añadir a existente" },
                              ]}
                            />
                          ) : <span />}
                          <button
                            onClick={() => updateDraft(d.pattern, { action: "ignore" })}
                            className="text-xs text-navy/35 hover:text-danger transition-colors shrink-0 whitespace-nowrap"
                          >
                            Descartar
                          </button>
                        </div>

                        {d.action === "attach" ? (
                          <>
                            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1.5">Contacto</p>
                            <Select
                              value={d.attachToDraftPattern ? `draft:${d.attachToDraftPattern}` : d.attachToContactId != null ? `contact:${d.attachToContactId}` : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v.startsWith("draft:")) updateDraft(d.pattern, { attachToDraftPattern: v.slice(6), attachToContactId: null });
                                else if (v.startsWith("contact:")) updateDraft(d.pattern, { attachToContactId: parseInt(v.slice(8), 10), attachToDraftPattern: null });
                              }}
                              className="mb-3.5"
                            >
                              {sortedContacts.map((c) => (
                                <option key={`c-${c.id}`} value={`contact:${c.id}`}>
                                  {c.label}{c.id === d.suggestedContactId ? " (posible coincidencia)" : ""}
                                </option>
                              ))}
                              {siblingCreateDrafts.length > 0 && (
                                <optgroup label="Otros contactos de este archivo">
                                  {siblingCreateDrafts.map((sd) => (
                                    <option key={`d-${sd.pattern}`} value={`draft:${sd.pattern}`}>{sd.label || sd.sample}</option>
                                  ))}
                                </optgroup>
                              )}
                            </Select>
                            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-navy/40 uppercase tracking-wider mb-1.5">
                              <AutomationIcon />
                              Conceptos para reconocerlo
                            </label>
                            <ChipsInput
                              values={d.bankPatterns}
                              onChange={(bankPatterns) => updateDraft(d.pattern, { bankPatterns })}
                              clean={(raw) => cleanBankText(raw) || raw}
                              placeholder="+ Añadir"
                            />
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1.5">Nombre del contacto</p>
                            <input
                              type="text"
                              value={d.label}
                              onChange={(e) => updateDraft(d.pattern, { label: e.target.value })}
                              placeholder="Nombre del contacto"
                              className="w-full mb-3.5 px-2.5 py-1.5 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
                            />
                            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-navy/40 uppercase tracking-wider mb-1.5">
                              <AutomationIcon />
                              Conceptos para reconocerlo
                            </label>
                            <ChipsInput
                              values={d.bankPatterns}
                              onChange={(bankPatterns) => updateDraft(d.pattern, { bankPatterns })}
                              clean={(raw) => cleanBankText(raw) || raw}
                              placeholder="+ Añadir"
                            />

                            <div className="h-px bg-navy/[0.06] my-3.5" />

                            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1.5">Etiqueta</p>
                            <div className="mb-3.5">
                              <CategoryPill
                                category={d.category}
                                categories={categories}
                                onChange={(cat) => updateDraft(d.pattern, { category: cat })}
                              />
                            </div>
                            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1.5">Grupo</p>
                            <div className="grid grid-cols-3 gap-2 mb-3.5">
                              {CONTACT_GROUP_ORDER.map((g) => (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => updateDraft(d.pattern, { group: g })}
                                  className={`text-[12px] px-2 py-1.5 rounded-lg border transition-colors ${
                                    d.group === g
                                      ? "border-navy bg-navy/[0.06] text-navy font-semibold"
                                      : "border-navy/[0.10] text-navy/50 hover:border-navy/20"
                                  }`}
                                >
                                  {CONTACT_GROUP_LABELS[g]}
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1.5">Impuestos</p>
                            <div className="grid grid-cols-2 gap-2 mb-2.5">
                              <div>
                                <p className="text-[10px] font-semibold text-navy/35 uppercase tracking-wider mb-1">IVA</p>
                                <UnitInput
                                  unit="%"
                                  value={d.ivaRate}
                                  onChange={(e) => updateDraft(d.pattern, { ivaRate: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-navy/35 uppercase tracking-wider mb-1">IRPF</p>
                                <UnitInput
                                  unit="%"
                                  value={d.retencionRate}
                                  onChange={(e) => updateDraft(d.pattern, { retencionRate: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-navy/55 cursor-pointer">
                              <Checkbox checked={d.noTax} onChange={(e) => updateDraft(d.pattern, { noTax: e.target.checked })} tone="primary" />
                              Sin IVA ni retenciones
                            </label>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  );
                })}
              </div>
              <div className="flex gap-2 shrink-0">
                <SecondaryButton
                  onClick={() => handleConfirmContacts(state.drafts.map((d) => ({ ...d, action: "ignore" as const })), state.rows, state.unparsedCount)}
                  disabled={savingContacts}
                  className="flex-1"
                >
                  Descartar todo
                </SecondaryButton>
                <Button
                  onClick={() => handleConfirmContacts(state.drafts, state.rows, state.unparsedCount)}
                  disabled={savingContacts}
                  className="flex-1"
                >
                  {savingContacts ? "Guardando…" : state.drafts.length === 1 ? "Guardar contacto" : `Guardar ${state.drafts.length} contactos`}
                </Button>
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
              <p className="text-xs text-navy/45">
                Como {ORIGIN_OPTIONS.find((o) => o.value === origin)?.label ?? origin} - si no era el origen correcto, deshaz la importación abajo y vuelve a intentarlo.
              </p>
              {state.skippedRows.length > 0 && (
                <p className="text-sm text-navy/45">{state.skippedRows.length} posibles duplicados</p>
              )}
              {!!state.appliedCount && (
                <p className="text-xs text-primary/70 mt-1">
                  {state.appliedCount} {state.appliedCount === 1 ? "movimiento anterior actualizado" : "movimientos anteriores actualizados"} con los contactos que acabas de confirmar.
                </p>
              )}
              {state.unparsedCount > 0 && (
                <p className="text-xs text-warning mt-1">
                  {state.unparsedCount} {state.unparsedCount === 1 ? "fila del archivo no se pudo leer" : "filas del archivo no se pudieron leer"} (fecha o importe no reconocidos) y no {state.unparsedCount === 1 ? "se ha importado" : "se han importado"}.
                </p>
              )}
              <Button onClick={onClose} className="mt-5">
                Cerrar
              </Button>

              {state.skippedRows.length > 0 && (
                <div className="mt-5 border border-navy/[0.08] rounded-xl overflow-hidden text-left">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-navy/[0.02] border-b border-navy/[0.06]">
                    <span className="text-xs font-semibold text-navy/50">Posibles duplicados</span>
                    <button
                      onClick={() => handleForceImport(state.skippedRows.map((_, i) => i), state.batchId)}
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
                          onClick={() => handleForceImport([i], state.batchId)}
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
                  <button
                    onClick={() => setConfirmUndo(state.batchId)}
                    className="text-xs text-navy/35 hover:text-danger transition-colors"
                  >
                    Deshacer esta importación
                  </button>
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

    {confirmUndo && (() => {
      const b = historial.find((h) => h.batchId === confirmUndo);
      const count = b?.count ?? (state.kind === "done" && state.batchId === confirmUndo ? state.imported : null);
      const dateRange = b ? `${fmtDateShort(b.minDate)} – ${fmtDateShort(b.maxDate)}` : null;
      return (
        <UndoImportDrawer
          count={count}
          dateRange={dateRange}
          busy={undoingId === confirmUndo}
          onClose={() => setConfirmUndo(null)}
          onConfirm={(close) => handleUndo(confirmUndo, close)}
        />
      );
    })()}
    </>
  );
}
