"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/app/components/Drawer";
import Button, { SecondaryButton } from "@/app/components/Button";
import { PrimaryButtonV2 } from "@/app/components/v2/ButtonsV2";
import HeaderPortal from "@/app/components/HeaderPortal";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import Select from "@/app/components/Select";
import type { BusinessEvent, EventCategoria } from "@/lib/businessEvents";
import { createBusinessEvent, updateBusinessEvent, deleteBusinessEvent } from "./actions";

// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORIAS: { value: EventCategoria; label: string; color: string; bg: string }[] = [
  { value: "precios",     label: "Precios",     color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30"   },
  { value: "horarios",    label: "Horarios",    color: "text-blue-700 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30"     },
  { value: "promociones", label: "Promociones", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30" },
  { value: "operativo",   label: "Operativo",   color: "text-purple-700 dark:text-purple-400",  bg: "bg-purple-50 dark:bg-purple-500/15 border-purple-200 dark:border-purple-500/30" },
  { value: "otro",        label: "Otro",        color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-50 dark:bg-slate-500/15 border-slate-200 dark:border-slate-500/30"   },
];

const DOT_COLOR: Record<EventCategoria, string> = {
  precios:     "bg-amber-400",
  horarios:    "bg-blue-400",
  promociones: "bg-emerald-400",
  operativo:   "bg-purple-400",
  otro:        "bg-slate-400",
};

function getCat(value: EventCategoria) {
  return CATEGORIAS.find((c) => c.value === value)!;
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

// ── Form state ────────────────────────────────────────────────────────────────

type FormValues = { fecha: string; categoria: EventCategoria; titulo: string; descripcion: string };

function emptyForm(): FormValues {
  return { fecha: new Date().toISOString().slice(0, 10), categoria: "precios", titulo: "", descripcion: "" };
}

// ── Event form ────────────────────────────────────────────────────────────────

function EventForm({
  initial,
  onSave,
  onCancel,
  isPending,
  error,
  title,
}: {
  initial: FormValues;
  onSave: (v: FormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
  title: string;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof FormValues, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Drawer
      title={title}
      onClose={onCancel}
      footer={
        <div className="flex gap-3">
          <SecondaryButton onClick={onCancel} disabled={isPending} className="flex-1">
            Cancelar
          </SecondaryButton>
          <Button onClick={() => onSave(form)} disabled={!form.titulo.trim() || !form.fecha || isPending} className="flex-1">
            {isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-navy/50 uppercase tracking-wide">Fecha</label>
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => set("fecha", e.target.value)}
              className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-navy/50 uppercase tracking-wide">Categoría</label>
            <Select value={form.categoria} onChange={(e) => set("categoria", e.target.value as EventCategoria)}>
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-navy/50 uppercase tracking-wide">Título</label>
          <input
            type="text"
            value={form.titulo}
            onChange={(e) => set("titulo", e.target.value)}
            placeholder="Ej. Subida de precio mensual a 85€"
            className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-navy/30"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-navy/50 uppercase tracking-wide">
            Descripción <span className="font-normal normal-case">(opcional)</span>
          </label>
          <textarea
            value={form.descripcion}
            onChange={(e) => set("descripcion", e.target.value)}
            placeholder="Detalles adicionales..."
            rows={3}
            className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Drawer>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HistorialTimeline({ events: initial }: { events: BusinessEvent[] }) {
  const router = useRouter();

  // Optimistic delete: track removed IDs so the list updates instantly,
  // then router.refresh() syncs the server state. For create/update we
  // rely on router.refresh() alone (initial prop is updated by Next.js).
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<EventCategoria | "todas">("todas");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const events = initial.filter((e) => !deletedIds.has(e.id));
  const filtered = filterCat === "todas" ? events : events.filter((e) => e.categoria === filterCat);

  const byYear = filtered.reduce<Record<string, BusinessEvent[]>>((acc, ev) => {
    const year = ev.fecha.slice(0, 4);
    (acc[year] ??= []).push(ev);
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  function handleCreate(form: FormValues) {
    setFormError(null);
    startTransition(async () => {
      try {
        await createBusinessEvent({ ...form, descripcion: form.descripcion || null });
        setShowForm(false);
        router.refresh();
      } catch {
        setFormError("No se pudo guardar. Inténtalo de nuevo.");
      }
    });
  }

  function handleUpdate(id: string, form: FormValues) {
    setFormError(null);
    startTransition(async () => {
      try {
        await updateBusinessEvent(id, { ...form, descripcion: form.descripcion || null });
        setEditing(null);
        router.refresh();
      } catch {
        setFormError("No se pudo guardar. Inténtalo de nuevo.");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteBusinessEvent(id);
        setDeletedIds((prev) => new Set([...prev, id]));
        setConfirmDeleteId(null);
      } catch {
        setConfirmDeleteId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <FilterPillGroupV2
          className="flex-1 min-w-0"
          active={filterCat}
          onChange={setFilterCat}
          options={[
            { key: "todas" as const, label: "Todas" },
            ...CATEGORIAS.map((c) => ({ key: c.value, label: c.label })),
          ]}
        />
      </div>

      <HeaderPortal target="header-actions">
        <PrimaryButtonV2
          onClick={() => { setShowForm(true); setEditing(null); setFormError(null); }}
          label="Registrar evento"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
        />
      </HeaderPortal>

      {/* Add form */}
      {showForm && (
        <EventForm
          title="Registrar evento"
          initial={emptyForm()}
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); setFormError(null); }}
          isPending={isPending}
          error={formError}
        />
      )}

      {/* Empty state */}
      {filtered.length === 0 && !showForm && (
        <div className="text-center py-20 text-navy/35 text-sm">
          {filterCat === "todas"
            ? "No hay eventos registrados todavía."
            : `No hay eventos de tipo "${getCat(filterCat).label}".`}
        </div>
      )}

      {/* Timeline by year */}
      {years.map((year) => (
        <div key={year}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold text-navy/40 uppercase tracking-widest">{year}</span>
            <div className="flex-1 h-px bg-navy/[0.07]" />
          </div>

          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-navy/[0.08]" />

            <div className="space-y-4">
              {byYear[year].map((ev) => {
                const cat = getCat(ev.categoria);
                const isEditing = editing === ev.id;
                const isConfirming = confirmDeleteId === ev.id;

                return (
                  <div key={ev.id} className="relative">
                    <div className={`absolute -left-6 top-3 w-3 h-3 rounded-full border-2 border-white ${DOT_COLOR[ev.categoria]}`} />

                    {isEditing ? (
                      <EventForm
                        title="Editar evento"
                        initial={{
                          fecha: ev.fecha,
                          categoria: ev.categoria,
                          titulo: ev.titulo,
                          descripcion: ev.descripcion ?? "",
                        }}
                        onSave={(form) => handleUpdate(ev.id, form)}
                        onCancel={() => { setEditing(null); setFormError(null); }}
                        isPending={isPending}
                        error={formError}
                      />
                    ) : (
                      <div className="group bg-card border border-navy/[0.08] rounded-xl px-4 py-3 hover:border-navy/20 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${cat.bg} ${cat.color}`}>
                                {cat.label}
                              </span>
                              <span className="text-xs text-navy/40">{formatFecha(ev.fecha)}</span>
                            </div>
                            <p className="text-sm font-medium text-navy">{ev.titulo}</p>
                            {ev.descripcion && (
                              <p className="text-sm text-navy/55 leading-relaxed">{ev.descripcion}</p>
                            )}
                          </div>

                          {/* Actions */}
                          {isConfirming ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-navy/55">¿Eliminar?</span>
                              <button
                                onClick={() => handleDelete(ev.id)}
                                disabled={isPending}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-40"
                              >
                                Sí
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={isPending}
                                className="px-2.5 py-1 text-xs font-medium text-navy/55 hover:text-navy rounded-md transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => { setEditing(ev.id); setConfirmDeleteId(null); setFormError(null); }}
                                className="p-1.5 rounded-md text-navy/40 hover:text-navy hover:bg-navy/[0.05] transition-colors"
                                title="Editar"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(ev.id)}
                                className="p-1.5 rounded-md text-navy/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors"
                                title="Eliminar"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
