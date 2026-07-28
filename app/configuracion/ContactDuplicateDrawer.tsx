"use client";
import { useState } from "react";
import type { Category } from "@/lib/categories";
import type { Contact, ContactStats } from "@/app/transacciones/actions";
import { CONTACT_GROUP_LABELS, contactGroupOf } from "@/lib/contactGroups";
import Drawer from "@/app/components/Drawer";
import Button from "@/app/components/Button";
import Avatar from "@/app/components/Avatar";
import { CategoryBadge } from "@/app/transacciones/TransaccionesList";
import { knownDomain, initials, fmtAmt } from "./ContactosManager";

/** Compara dos contactos que la detección automática marcó como posible duplicado (mismo
 * nombre parecido o mismos conceptos bancarios, ver lib/duplicateContacts.ts). Se elige cuál
 * ficha conservar (por defecto la que tiene más movimientos) y se fusiona la otra en ella, o se
 * descarta el aviso si en realidad no son la misma entidad. */
export default function ContactDuplicateDrawer({
  contactA,
  contactB,
  statsA,
  statsB,
  categories,
  onMerge,
  onDismiss,
  onClose,
}: {
  contactA: Contact;
  contactB: Contact;
  statsA: ContactStats | undefined;
  statsB: ContactStats | undefined;
  categories: Category[];
  onMerge: (keepId: number, mergeId: number) => Promise<void>;
  onDismiss: () => void;
  onClose: () => void;
}) {
  const countA = statsA?.count ?? 0;
  const countB = statsB?.count ?? 0;
  const [keepId, setKeepId] = useState(countB > countA ? contactB.id : contactA.id);
  const [saving, setSaving] = useState(false);

  async function handleMerge() {
    setSaving(true);
    const mergeId = keepId === contactA.id ? contactB.id : contactA.id;
    try {
      await onMerge(keepId, mergeId);
    } finally {
      setSaving(false);
    }
  }

  const pairs: { contact: Contact; stats: ContactStats | undefined }[] = [
    { contact: contactA, stats: statsA },
    { contact: contactB, stats: statsB },
  ];

  return (
    <Drawer
      maxWidth="max-w-[600px]"
      title="Posible contacto duplicado"
      subtitle="Elige cuál ficha conservar - la fusión mueve sus conceptos bancarios y movimientos a la elegida"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold text-navy/60 border border-navy/15 rounded-lg hover:bg-navy/[0.03] transition-colors disabled:opacity-40"
          >
            No está duplicado
          </button>
          <Button onClick={handleMerge} disabled={saving} className="flex-1">
            {saving ? "Fusionando…" : "Fusionar"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-navy/[0.06]">
        {pairs.map(({ contact: c, stats }) => (
          <div key={c.id} className="p-4 space-y-3.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="keep-contact"
                checked={keepId === c.id}
                onChange={() => setKeepId(c.id)}
                className="w-[15px] h-[15px] accent-primary cursor-pointer"
              />
              <span className="text-xs font-semibold text-navy/45 uppercase tracking-wider">Mantener esta ficha</span>
            </label>

            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar seed={c.label} initials={initials(c.label)} logoDomain={knownDomain(c.label)} size={34} />
              <p className="text-sm font-semibold text-navy truncate">{c.label}</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center bg-navy/[0.05] text-navy/60 rounded-full px-2.5 py-1 text-[11px] font-medium">
                {CONTACT_GROUP_LABELS[contactGroupOf(c.label, c.group)]}
              </span>
              <CategoryBadge category={c.category} categories={categories} />
            </div>

            <p className="text-xs text-navy/55">
              IVA {c.ivaRate}% · IRPF {c.retencionRate}%{c.noTax ? " · Sin IVA ni retenciones" : ""}
            </p>

            <div>
              <p className="text-[10px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Conceptos bancarios</p>
              {c.patterns.length === 0 ? (
                <p className="text-xs text-navy/35">Ninguno</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {c.patterns.map((p) => (
                    <span key={p} className="inline-block bg-navy/[0.04] text-navy/60 rounded-md px-1.5 py-0.5 text-[10.5px]">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-navy/55">
              <span className="font-semibold text-navy">{stats?.count ?? 0}</span> movimientos · {fmtAmt(stats?.total ?? 0)}
            </p>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
