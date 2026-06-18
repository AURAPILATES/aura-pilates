"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BusinessEvent, EventCategoria } from "@/lib/businessEvents";
import { createBusinessEvent, updateBusinessEvent, deleteBusinessEvent } from "./actions";

// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORIAS: { value: EventCategoria; label: string; color: string; bg: string }[] = [
  { value: "precios",     label: "Precios",     color: "text-amber-700",  bg: "bg-amber-50 border-amber-200"  },
  { value: "horarios",    label: "Horarios",    color: "text-blue-700",   bg: "bg-blue-50 border-blue-200"    },
  { value: "promociones", label: "Promociones", color: "text-emerald-700",bg: "bg-emerald-50 border-emerald-200"},
  { value: "operativo",   label: "Operativo",   color: "text-purple-700", bg: "bg-purple-50 border-purple-200"},
  { value: "otro",        label: "Otro",        color: "text-slate-600",  bg: "bg-slate-50 border-slate-200"  },
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

// ── Empty form state ───────────────────────────────────────────────────────────

function emptyForm() {
  const today = new Date().toISOString().slice(0, 10);
  return { fecha: today, categoria: "precios" as EventCategoria, titulo: "", descripcion: "" };
}

// ── Event form (add / edit) ────────────────────────────────────────────────────

function EventForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: ReturnType<typeof emptyForm>;
  onSave: (v: ReturnType<typeof emptyForm>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="bg-white border border-navy/10 rounded-xl p-5 space-y-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-navy/50 uppercase tracking-wide">Fecha</label>
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => set("fecha", e.target.value)}
            className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-navy/50 uppercase tracking-wide">Categoría</label>
          <select
            value={form.categoria}
            onChange={(e) => set("categoria", e.target.value as EventCategoria)}
            className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          >
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-navy/50 uppercase tracking-wide">Título</label>
        <input
          type="text"
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          placeholder="Ej. Subida de precio mensual a 85€"
          className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
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
          rows={2}
          className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-navy/55 hover:text-navy transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={!form.titulo.trim() || !form.fecha || isPending}
          className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          {isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function HistorialTimeline({ events: initial }: { events: BusinessEvent[] }) {
  const router = useRouter();
  const [events, setEvents] = useState<BusinessEvent[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<EventCategoria | "todas">("todas");
  const [isPending, startTransition] = useTransition();

  const filtered = filterCat === "todas" ? events : events.filter((e) => e.categoria === filterCat);

  // Group by year
  const byYear = filtered.reduce<Record<string, BusinessEvent[]>>((acc, ev) => {
    const year = ev.fecha.slice(0, 4);
    (acc[year] ??= []).push(ev);
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  function handleCreate(form: ReturnType<typeof emptyForm>) {
    startTransition(async () => {
      await createBusinessEvent({ ...form, descripcion: form.descripcion || null });
      setShowForm(false);
      router.refresh();
    });
  }

  function handleUpdate(id: string, form: ReturnType<typeof emptyForm>) {
    startTransition(async () => {
      await updateBusinessEvent(id, { ...form, descripcion: form.descripcion || null });
      setEditing(null);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este evento?")) return;
    startTransition(async () => {
      await deleteBusinessEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    });
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCat("todas")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filterCat === "todas"
                ? "bg-navy text-white border-navy"
                : "bg-white text-navy/55 border-navy/15 hover:border-navy/30"
            }`}
          >
            Todas
          </button>
          {CATEGORIAS.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilterCat(c.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterCat === c.value
                  ? `${c.bg} ${c.color} border-current`
                  : "bg-white text-navy/55 border-navy/15 hover:border-navy/30"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => { setShowForm(true); setEditing(null); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Registrar evento
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <EventForm
          initial={emptyForm()}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          isPending={isPending}
        />
      )}

      {/* Empty state */}
      {filtered.length === 0 && !showForm && (
        <div className="text-center py-20 text-navy/35 text-sm">
          No hay eventos registrados todavía.
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
            {/* vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-navy/[0.08]" />

            <div className="space-y-4">
              {byYear[year].map((ev) => {
                const cat = getCat(ev.categoria);
                const isEditing = editing === ev.id;

                return (
                  <div key={ev.id} className="relative">
                    {/* dot */}
                    <div className={`absolute -left-6 top-3 w-3 h-3 rounded-full border-2 border-white ${DOT_COLOR[ev.categoria]}`} />

                    {isEditing ? (
                      <EventForm
                        initial={{
                          fecha: ev.fecha,
                          categoria: ev.categoria,
                          titulo: ev.titulo,
                          descripcion: ev.descripcion ?? "",
                        }}
                        onSave={(form) => handleUpdate(ev.id, form)}
                        onCancel={() => setEditing(null)}
                        isPending={isPending}
                      />
                    ) : (
                      <div className="group bg-white border border-navy/[0.08] rounded-xl px-4 py-3 hover:border-navy/20 transition-colors">
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

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => setEditing(ev.id)}
                              className="p-1.5 rounded-md text-navy/40 hover:text-navy hover:bg-navy/[0.05] transition-colors"
                              title="Editar"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(ev.id)}
                              className="p-1.5 rounded-md text-navy/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Eliminar"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                          </div>
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
