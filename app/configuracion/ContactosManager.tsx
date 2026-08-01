"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/lib/categories";
import { contactKeyFor } from "@/lib/contactRules";
import { normalizeText } from "@/lib/normalizeText";
import { drawerNav } from "@/lib/drawerNav";
import { CONTACT_GROUP_ORDER, CONTACT_GROUP_LABELS, contactGroupOf, type ContactGroup } from "@/lib/contactGroups";
import { findDuplicatePairs, duplicateKey } from "@/lib/duplicateContacts";
import {
  type Contact, type ContactStats, updateContact, deleteContact, applyContactToExisting,
  addPatternToContact, removeContactPattern, recomputeContactsFromBankDetails, cleanupContactPatterns,
  dismissContactDuplicate, mergeContacts,
} from "@/app/transacciones/actions";
import Drawer from "@/app/components/Drawer";
import Button from "@/app/components/Button";
import ChipsInput from "@/app/components/ChipsInput";
import { CategoryPill } from "@/app/transacciones/TransaccionesList";
import NewContactDrawer, { AutomationIcon } from "@/app/transacciones/NewContactDrawer";
import ContactosManagerV2 from "./ContactosManagerV2";
import ContactDuplicateDrawer from "./ContactDuplicateDrawer";

const PAGE_SIZE = 25;

/** Dominios de marcas reconocibles para mostrar su logo real (favicon de Google) en vez de
 * iniciales - solo para proveedores habituales de Aura Pilates. El resto cae a iniciales. */
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
 * alta/baja - p. ej. cuando una empresa factura con un texto distinto al habitual
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

function ContactDetailDrawer({ contact, categories, stats, onChange, onRemove, onClose, onPrev, onNext, hasPrev, hasNext }: {
  contact: Contact;
  categories: Category[];
  stats: ContactStats | undefined;
  onChange: (patch: Partial<{ label: string; category: string | null; ivaRate: number; retencionRate: number; noTax: boolean; group: string | null; patterns: string[] }>) => void;
  onRemove: () => void;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
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
      onPrev={onPrev}
      onNext={onNext}
      hasPrev={hasPrev}
      hasNext={hasNext}
      header={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
            {initials(contact.label)}
          </div>
          <p className="text-sm font-semibold text-navy truncate">{contact.label}</p>
        </div>
      }
      footer={
        confirmDelete ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-navy/60">¿Eliminar este contacto?</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2.5 text-sm text-navy/60 border border-navy/15 rounded-lg hover:bg-navy/[0.03] transition-colors">
                Cancelar
              </button>
              <button onClick={onRemove} className="px-4 py-2.5 text-sm font-semibold text-white bg-danger rounded-lg hover:bg-danger/85 transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-danger border border-danger/20 rounded-lg hover:bg-danger/5 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Eliminar
            </button>
            <Button
              onClick={handleApply}
              disabled={applying}
              className="flex-1"
              title="Aplica este contacto a movimientos ya importados que coincidan con sus conceptos"
            >
              {applying ? "Guardando…" : applied !== null ? `${applied} actualizados` : "Guardar"}
            </Button>
          </div>
        )
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
            <p className="text-[11px] text-navy/40 mt-0.5">último: {stats?.latest[0] ? fmtDate(stats.latest[0].date) : "-"}</p>
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
          <label className="flex items-center gap-2 text-xs text-navy/55 cursor-pointer">
            <input
              type="checkbox"
              checked={contact.noTax}
              onChange={(e) => onChange({ noTax: e.target.checked })}
              className="w-[15px] h-[15px] rounded-[4px] border-navy/25 text-primary focus:ring-primary/20 cursor-pointer"
            />
            Sin IVA ni retenciones
          </label>
        </div>

        <div className="p-4 border-b border-navy/[0.06]">
          <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-2">Grupo</p>
          <div className="grid grid-cols-3 gap-2">
            {CONTACT_GROUP_ORDER.map((g) => {
              const active = contactGroupOf(contact.label, contact.group) === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => onChange({ group: g })}
                  className={`text-[13px] px-2 py-2 rounded-xl border transition-colors ${
                    active
                      ? "border-navy bg-navy/[0.06] text-navy font-semibold"
                      : "border-navy/[0.10] text-navy/50 hover:border-navy/20"
                  }`}
                >
                  {CONTACT_GROUP_LABELS[g]}
                </button>
              );
            })}
          </div>
          {contact.group == null && (
            <p className="text-[11px] text-navy/35 mt-1.5">Deducido del nombre. Fíjalo a mano si necesitas otro grupo.</p>
          )}
        </div>

        <div className="p-4 border-b border-navy/[0.06]">
          <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-2">Categoría</p>
          <CategoryPill category={contact.category} categories={categories} onChange={(cat) => onChange({ category: cat })} />
        </div>

        <div className="p-4 border-b border-navy/[0.06]">
          <div className="p-3.5 bg-primary/[0.06] border border-primary/15 rounded-xl">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary/80 uppercase tracking-wider mb-2">
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
                    <p className="text-xs text-navy truncate">{t.concept || "-"}</p>
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

export default function ContactosManager({ contacts: initialContacts, categories, contactStats, pendingRecomputeCount, pendingCleanupCount, dismissedDuplicates: initialDismissed }: {
  contacts: Contact[];
  categories: Category[];
  contactStats: Record<number, ContactStats>;
  pendingRecomputeCount: number;
  pendingCleanupCount: number;
  dismissedDuplicates: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contacts, setContacts] = useState(initialContacts);
  const [creating, setCreating] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputed, setRecomputed] = useState<number | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleaned, setCleaned] = useState<{ updated: number; merged: number } | null>(null);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | ContactGroup>("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const raw = searchParams.get("contacto");
    return raw ? parseInt(raw, 10) : null;
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(initialDismissed));
  const [duplicatePair, setDuplicatePair] = useState<{ aId: number; bId: number } | null>(null);
  const [, startTransition] = useTransition();

  function toggleSelectContact(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkDeleteContacts() {
    const ids = Array.from(selectedIds);
    setContacts((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    await Promise.all(ids.map((id) => deleteContact(id)));
    router.refresh();
  }

  async function bulkSetIvaContacts(rate: number) {
    const ids = Array.from(selectedIds);
    setContacts((prev) => prev.map((c) => (selectedIds.has(c.id) ? { ...c, ivaRate: rate } : c)));
    setSelectedIds(new Set());
    await Promise.all(ids.map((id) => updateContact(id, { ivaRate: rate })));
    router.refresh();
  }

  async function bulkSetRetencionContacts(rate: number) {
    const ids = Array.from(selectedIds);
    setContacts((prev) => prev.map((c) => (selectedIds.has(c.id) ? { ...c, retencionRate: rate } : c)));
    setSelectedIds(new Set());
    await Promise.all(ids.map((id) => updateContact(id, { retencionRate: rate })));
    router.refresh();
  }

  async function bulkSetCategoryContacts(category: string | null) {
    const ids = Array.from(selectedIds);
    setContacts((prev) => prev.map((c) => (selectedIds.has(c.id) ? { ...c, category } : c)));
    setSelectedIds(new Set());
    await Promise.all(ids.map((id) => updateContact(id, { category })));
    router.refresh();
  }

  async function handleRecompute() {
    setRecomputing(true);
    setRecomputed(null);
    try {
      const { updated } = await recomputeContactsFromBankDetails();
      setRecomputed(updated);
      router.refresh();
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

  function patchContact(id: number, patch: Partial<{ label: string; category: string | null; ivaRate: number; retencionRate: number; noTax: boolean; group: string | null; patterns: string[] }>) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const rest: { label?: string; category?: string | null; ivaRate?: number; retencionRate?: number; noTax?: boolean; group?: string | null } = {};
    if (patch.label !== undefined) rest.label = patch.label;
    if (patch.category !== undefined) rest.category = patch.category;
    if (patch.ivaRate !== undefined) rest.ivaRate = patch.ivaRate;
    if (patch.retencionRate !== undefined) rest.retencionRate = patch.retencionRate;
    if (patch.noTax !== undefined) rest.noTax = patch.noTax;
    if (patch.group !== undefined) rest.group = patch.group;
    if (Object.keys(rest).length) startTransition(() => { updateContact(id, rest); });
  }

  function removeContact(id: number) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setSelectedId(null);
    startTransition(() => { deleteContact(id); });
  }

  async function handleDismissDuplicate(aId: number, bId: number) {
    setDismissed((prev) => new Set(prev).add(duplicateKey(aId, bId)));
    setDuplicatePair(null);
    await dismissContactDuplicate(aId, bId);
  }

  async function handleMergeDuplicate(keepId: number, mergeId: number) {
    const merged = contacts.find((c) => c.id === mergeId);
    if (!merged) return;
    setContacts((prev) =>
      prev
        .filter((c) => c.id !== mergeId)
        .map((c) => (c.id === keepId ? { ...c, patterns: [...new Set([...c.patterns, ...merged.patterns])] } : c)),
    );
    setDuplicatePair(null);
    if (selectedId === mergeId) setSelectedId(null);
    await mergeContacts(keepId, mergeId);
    router.refresh();
  }

  const groupCounts = useMemo(() => {
    const counts: Record<ContactGroup, number> = { proveedor: 0, instructor: 0, socio: 0 };
    for (const c of contacts) counts[contactGroupOf(c.label, c.group)] += 1;
    return counts;
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = normalizeText(search).trim();
    return contacts.filter((c) => {
      if (groupFilter !== "all" && contactGroupOf(c.label, c.group) !== groupFilter) return false;
      if (!q) return true;
      return normalizeText(c.label).includes(q) || c.patterns.some((p) => normalizeText(p).includes(q));
    });
  }, [contacts, search, groupFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const selected = selectedId !== null ? contacts.find((c) => c.id === selectedId) ?? null : null;

  // Detección de posibles duplicados (por nombre parecido o mismos conceptos bancarios),
  // descontando los pares ya marcados a mano como "no está duplicado".
  const duplicateMatchOf = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of findDuplicatePairs(contacts)) {
      if (dismissed.has(duplicateKey(p.aId, p.bId))) continue;
      if (!map.has(p.aId)) map.set(p.aId, p.bId);
      if (!map.has(p.bId)) map.set(p.bId, p.aId);
    }
    return map;
  }, [contacts, dismissed]);

  const duplicateContacts = duplicatePair
    ? { a: contacts.find((c) => c.id === duplicatePair.aId), b: contacts.find((c) => c.id === duplicatePair.bId) }
    : null;

  return (
    <div>
      <ContactosManagerV2
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(0); }}
        groupFilter={groupFilter}
        onGroupFilterChange={(g) => { setGroupFilter(g); setPage(0); }}
        groupCounts={groupCounts}
        rows={pageRows}
        totalCount={filtered.length}
        page={safePage}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        categories={categories}
        contactStats={contactStats}
        onRowClick={(id) => setSelectedId(id)}
        duplicateMatchOf={duplicateMatchOf}
        onOpenDuplicate={(aId, bId) => setDuplicatePair({ aId, bId })}
        onViewTransactions={(c) => router.push(`/transacciones?buscar=${encodeURIComponent(c.label)}`)}
        onNewContact={() => setCreating(true)}
        onCleanup={handleCleanup}
        cleaning={cleaning}
        cleaned={cleaned}
        onRecompute={handleRecompute}
        recomputing={recomputing}
        recomputed={recomputed}
        pendingRecomputeCount={pendingRecomputeCount}
        pendingCleanupCount={pendingCleanupCount}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelectContact}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkDelete={bulkDeleteContacts}
        onBulkSetIva={bulkSetIvaContacts}
        onBulkSetRetencion={bulkSetRetencionContacts}
        onBulkSetCategory={bulkSetCategoryContacts}
      />

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

      {selected && (() => {
        const { prev, next } = drawerNav(filtered, selected.id, (c) => c.id);
        return (
          <ContactDetailDrawer
            key={selected.id}
            contact={selected}
            categories={categories}
            stats={contactStats[selected.id]}
            onChange={(patch) => patchContact(selected.id, patch)}
            onRemove={() => removeContact(selected.id)}
            onClose={() => setSelectedId(null)}
            onPrev={prev ? () => setSelectedId(prev.id) : undefined}
            onNext={next ? () => setSelectedId(next.id) : undefined}
            hasPrev={!!prev}
            hasNext={!!next}
          />
        );
      })()}

      {duplicateContacts?.a && duplicateContacts?.b && (
        <ContactDuplicateDrawer
          contactA={duplicateContacts.a}
          contactB={duplicateContacts.b}
          statsA={contactStats[duplicateContacts.a.id]}
          statsB={contactStats[duplicateContacts.b.id]}
          categories={categories}
          onMerge={handleMergeDuplicate}
          onDismiss={() => handleDismissDuplicate(duplicateContacts.a!.id, duplicateContacts.b!.id)}
          onClose={() => setDuplicatePair(null)}
        />
      )}
    </div>
  );
}
