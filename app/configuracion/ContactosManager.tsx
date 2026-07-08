"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/categories";
import { contactKeyFor } from "@/lib/contactRules";
import {
  type Contact, type ContactStats, updateContact, deleteContact, applyContactToExisting,
  addPatternToContact, removeContactPattern, recomputeContactsFromBankDetails, cleanupContactPatterns,
} from "@/app/transacciones/actions";
import Drawer from "@/app/components/Drawer";
import ChipsInput from "@/app/components/ChipsInput";
import Avatar from "@/app/components/Avatar";
import SearchInput from "@/app/components/SearchInput";
import Button from "@/app/components/Button";
import TablePagination from "@/app/components/TablePagination";
import TableBox from "@/app/components/TableBox";
import TableToolbar from "@/app/components/TableToolbar";
import { CategoryPill, CategoryBadge } from "@/app/transacciones/TransaccionesList";
import NewContactDrawer, { AutomationIcon } from "@/app/transacciones/NewContactDrawer";
import { useDesignVersion } from "@/app/components/DesignVersionContext";
import ContactosManagerV2 from "./ContactosManagerV2";

const PAGE_SIZE = 25;

/** Dominios de marcas reconocibles para mostrar su logo real (favicon de Google) en vez de
 * iniciales — solo para proveedores habituales de Aura Pilates. El resto cae a iniciales. */
const KNOWN_DOMAINS: Record<string, string> = {
  "stripe": "stripe.com",
  "squarespace": "squarespace.com",
  "momence": "momence.com",
  "iberdrola": "iberdrola.com",
  "urban": "urbansportsclub.com",
  "caixabank": "caixabank.es",
  "o2": "o2online.es",
  "vodafone": "vodafone.es",
  "movistar": "movistar.es",
  "google": "google.com",
  "amazon": "amazon.es",
  "meta": "facebook.com",
  "facebook": "facebook.com",
  "instagram": "instagram.com",
  "canva": "canva.com",
  "zoom": "zoom.us",
  "spotify": "spotify.com",
};
export function knownDomain(label: string): string | null {
  const key = label.trim().toLowerCase();
  for (const [needle, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (key.includes(needle)) return domain;
  }
  return null;
}

const MONTHS_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
export function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${parseInt(day)} ${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}
export function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
export function initials(label: string) {
  return label.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function RateInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = parseFloat(draft.replace(",", ".")) || 0;
        setDraft(String(v));
        if (v !== value) onSave(v);
      }}
      className="w-16 px-1.5 py-1 text-sm text-right border border-navy/15 rounded-md focus:outline-none focus:border-primary/40"
    />
  );
}

/** Conceptos bancarios que identifican a un contacto, con persistencia inmediata de cada
 * alta/baja — p. ej. cuando una empresa factura con un texto distinto al habitual
 * ("Spotify P4106A003" además de "SPOTIFY SPAIN SL"). */
function PatternsEditor({ contactId, patterns, onAdd, onRemove }: {
  contactId: number;
  patterns: string[];
  onAdd: (pattern: string) => void;
  onRemove: (pattern: string) => void;
}) {
  return (
    <ChipsInput
      values={patterns}
      clean={(raw) => contactKeyFor(raw, null)}
      placeholder="+ añadir concepto…"
      onChange={(next) => {
        if (next.length > patterns.length) {
          const added = next.find((p) => !patterns.includes(p))!;
          addPatternToContact(contactId, added);
          onAdd(added);
        } else {
          const removed = patterns.find((p) => !next.includes(p))!;
          removeContactPattern(removed);
          onRemove(removed);
        }
      }}
    />
  );
}

function ContactDetailDrawer({ contact, categories, stats, onChange, onRemove, onClose }: {
  contact: Contact;
  categories: Category[];
  stats: ContactStats | undefined;
  onChange: (patch: Partial<{ label: string; category: string | null; ivaRate: number; retencionRate: number; patterns: string[] }>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(contact.label);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleApply() {
    setApplying(true);
    setApplied(null);
    try {
      const { updated } = await applyContactToExisting(contact.id);
      setApplied(updated);
    } finally {
      setApplying(false);
    }
  }

  const count = stats?.count ?? 0;
  const total = stats?.total ?? 0;
  const avg = count ? Math.round(total / count) : 0;

  return (
    <Drawer
      onClose={onClose}
      header={
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
            {initials(contact.label)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy truncate">{contact.label}</p>
            <div className="mt-1">
              <CategoryPill category={contact.category} categories={categories} onChange={(cat) => onChange({ category: cat })} />
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handleApply}
            disabled={applying}
            title="Aplicar este contacto a movimientos ya importados que coincidan con sus conceptos"
            className="text-xs text-primary hover:text-primary/75 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {applying ? "Aplicando…" : applied !== null ? `${applied} actualizados` : "Aplicar a existentes"}
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-navy/40 hover:text-navy transition-colors">Cancelar</button>
              <button onClick={onRemove} className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors">Confirmar</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-navy/35 hover:text-danger transition-colors">
              Eliminar contacto
            </button>
          )}
        </div>
      }
    >
      <div>
        <div className="grid grid-cols-2 gap-3 p-4 border-b border-navy/[0.06]">
          <div className="bg-navy/[0.02] rounded-xl px-3 py-2.5">
            <p className="text-[11px] text-navy/40">Total acumulado</p>
            <p className={`text-lg font-semibold ${total >= 0 ? "text-success" : "text-navy"}`}>
              {total >= 0 ? "+" : "−"}{fmtAmt(total)}
            </p>
            <p className="text-[11px] text-navy/40 mt-0.5">{count} {count === 1 ? "movimiento" : "movimientos"}</p>
          </div>
          <div className="bg-navy/[0.02] rounded-xl px-3 py-2.5">
            <p className="text-[11px] text-navy/40">Media por movimiento</p>
            <p className="text-lg font-semibold text-navy">{fmtAmt(avg)}</p>
            <p className="text-[11px] text-navy/40 mt-0.5">último: {stats?.latest[0] ? fmtDate(stats.latest[0].date) : "—"}</p>
          </div>
        </div>

        <div className="p-4 border-b border-navy/[0.06] space-y-3">
          <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider">Nombre</p>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => { if (label.trim() && label !== contact.label) onChange({ label: label.trim() }); }}
            className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-navy/45">
              IVA <RateInput value={contact.ivaRate} onSave={(v) => onChange({ ivaRate: v })} />%
            </label>
            <label className="flex items-center gap-2 text-xs text-navy/45">
              IRPF <RateInput value={contact.retencionRate} onSave={(v) => onChange({ retencionRate: v })} />%
            </label>
          </div>
        </div>

        <div className="p-4 border-b border-navy/[0.06]">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-2">
            <AutomationIcon />
            Conceptos bancarios
          </p>
          <PatternsEditor
            contactId={contact.id}
            patterns={contact.patterns}
            onAdd={(p) => onChange({ patterns: [...contact.patterns, p] })}
            onRemove={(p) => onChange({ patterns: contact.patterns.filter((x) => x !== p) })}
          />
        </div>

        <div className="p-4">
          <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-2">Últimas transacciones</p>
          {!stats || stats.latest.length === 0 ? (
            <p className="text-xs text-navy/40">Todavía no hay movimientos asociados.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.latest.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-navy truncate">{t.concept || "—"}</p>
                    <p className="text-[11px] text-navy/40">{fmtDate(t.date)}</p>
                  </div>
                  <span className={`text-xs font-semibold tabular-nums shrink-0 ${t.amount >= 0 ? "text-success" : "text-navy/70"}`}>
                    {t.amount >= 0 ? "+" : "−"}{fmtAmt(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

export default function ContactosManager({ contacts: initialContacts, categories, contactStats }: {
  contacts: Contact[];
  categories: Category[];
  contactStats: Record<number, ContactStats>;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [creating, setCreating] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputed, setRecomputed] = useState<number | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleaned, setCleaned] = useState<{ updated: number; merged: number } | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  async function handleRecompute() {
    setRecomputing(true);
    setRecomputed(null);
    try {
      const { updated } = await recomputeContactsFromBankDetails();
      setRecomputed(updated);
    } finally {
      setRecomputing(false);
    }
  }

  async function handleCleanup() {
    setCleaning(true);
    setCleaned(null);
    try {
      const result = await cleanupContactPatterns();
      setCleaned(result);
      router.refresh();
    } finally {
      setCleaning(false);
    }
  }

  function patchContact(id: number, patch: Partial<{ label: string; category: string | null; ivaRate: number; retencionRate: number; patterns: string[] }>) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const rest: { label?: string; category?: string | null; ivaRate?: number; retencionRate?: number } = {};
    if (patch.label !== undefined) rest.label = patch.label;
    if (patch.category !== undefined) rest.category = patch.category;
    if (patch.ivaRate !== undefined) rest.ivaRate = patch.ivaRate;
    if (patch.retencionRate !== undefined) rest.retencionRate = patch.retencionRate;
    if (Object.keys(rest).length) startTransition(() => { updateContact(id, rest); });
  }

  function removeContact(id: number) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setSelectedId(null);
    startTransition(() => { deleteContact(id); });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.label.toLowerCase().includes(q) || c.patterns.some((p) => p.toLowerCase().includes(q)));
  }, [contacts, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const selected = selectedId !== null ? contacts.find((c) => c.id === selectedId) ?? null : null;
  const { v2 } = useDesignVersion();

  return (
    <div>
      {v2 && (
        <div className="hidden sm:block">
          <ContactosManagerV2
            search={search}
            onSearchChange={(v) => { setSearch(v); setPage(0); }}
            rows={pageRows}
            totalCount={filtered.length}
            page={safePage}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            categories={categories}
            contactStats={contactStats}
            onRowClick={(id) => setSelectedId(id)}
            onNewContact={() => setCreating(true)}
            onRecompute={handleRecompute}
            recomputing={recomputing}
            recomputed={recomputed}
          />
        </div>
      )}
      {/* En móvil siempre se ve la tabla clásica, aunque el diseño nuevo esté activo */}
      <div className={v2 ? "sm:hidden" : ""}>
      <TableToolbar>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Buscar contacto…" className="flex-1 min-w-[200px]" />
        <button
          onClick={handleCleanup}
          disabled={cleaning}
          title="Vuelve a limpiar los conceptos ya guardados quitando códigos de operación variables, para que coincidan de forma estable"
          className="text-xs text-navy/45 hover:text-navy transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {cleaning ? "Limpiando…" : cleaned !== null ? `${cleaned.updated} limpiados, ${cleaned.merged} fusionados` : "Limpiar conceptos"}
        </button>
        <button
          onClick={handleRecompute}
          disabled={recomputing}
          title="Vuelve a calcular Contacto a partir de Concepto + Más datos, cruzando con los contactos guardados"
          className="text-xs text-navy/45 hover:text-navy transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {recomputing ? "Recalculando…" : recomputed !== null ? `${recomputed} movimientos actualizados` : "Recalcular contactos"}
        </button>
        <Button onClick={() => setCreating(true)} className="whitespace-nowrap">
          + Nuevo contacto
        </Button>
      </TableToolbar>

      <TableBox>
      {filtered.length === 0 ? (
        <p className="text-sm text-navy/40 px-4 py-6">
          {contacts.length === 0 ? "Todavía no hay contactos guardados." : "Ningún contacto coincide con la búsqueda."}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy/[0.02] border-b border-navy/[0.06]">
              <th className="text-left px-4 py-3 text-[11px] text-navy/45 font-semibold uppercase tracking-wide">Nombre</th>
              <th className="text-left px-4 py-3 text-[11px] text-navy/45 font-semibold uppercase tracking-wide">Categoría</th>
              <th className="text-left px-4 py-3 text-[11px] text-navy/45 font-semibold uppercase tracking-wide">Conceptos bancarios</th>
              <th className="text-right px-4 py-3 text-[11px] text-navy/45 font-semibold uppercase tracking-wide">IVA</th>
              <th className="text-right px-4 py-3 text-[11px] text-navy/45 font-semibold uppercase tracking-wide">IRPF</th>
              <th className="text-right px-4 py-3 text-[11px] text-navy/45 font-semibold uppercase tracking-wide">Movimientos</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c) => {
              const stats = contactStats[c.id];
              const visiblePatterns = c.patterns.slice(0, 2);
              const extra = c.patterns.length - visiblePatterns.length;
              return (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`border-b border-navy/[0.04] last:border-0 cursor-pointer hover:bg-navy/[0.02] transition-colors ${selectedId === c.id ? "bg-primary/[0.04]" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-navy whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <Avatar seed={c.label} initials={initials(c.label)} logoDomain={knownDomain(c.label)} size={32} />
                      {c.label}
                    </div>
                  </td>
                  <td className="px-4 py-3"><CategoryBadge category={c.category} categories={categories} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {visiblePatterns.map((p) => (
                        <span key={p} title={p} className="inline-block px-1.5 py-0.5 max-w-[140px] truncate rounded text-[11px] bg-navy/[0.04] text-navy/55">{p}</span>
                      ))}
                      {extra > 0 && <span className="text-[11px] text-navy/35">+{extra}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-navy/70 text-xs">{c.ivaRate > 0 ? `${c.ivaRate}%` : <span className="text-navy/30 text-[10px]">-</span>}</td>
                  <td className="px-4 py-3 text-right text-navy/70 text-xs">{c.retencionRate > 0 ? `${c.retencionRate}%` : <span className="text-navy/30 text-[10px]">-</span>}</td>
                  <td className="px-4 py-3 text-right">
                    {stats ? (
                      <div className="flex flex-col items-end">
                        <span className="font-medium text-navy">{stats.count}</span>
                        <span className={`text-[11px] ${stats.total >= 0 ? "text-success" : "text-navy/40"}`}>
                          {stats.total >= 0 ? "+" : "−"}{fmtAmt(stats.total)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-navy/30">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {filtered.length > 0 && (
        <TablePagination page={safePage} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      )}
      </TableBox>
      </div>

      {creating && (
        <NewContactDrawer
          categories={categories}
          onCancel={() => setCreating(false)}
          onCreated={(contact) => {
            setContacts((prev) => [contact, ...prev]);
            setCreating(false);
          }}
        />
      )}

      {selected && (
        <ContactDetailDrawer
          contact={selected}
          categories={categories}
          stats={contactStats[selected.id]}
          onChange={(patch) => patchContact(selected.id, patch)}
          onRemove={() => removeContact(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
