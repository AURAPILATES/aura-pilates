"use client";

import { useState } from "react";
import Link from "next/link";
import Drawer from "@/app/components/Drawer";

/** Botón "guía" (icono de libro) + drawer que explica de dónde salen los datos de Clientes,
 * cómo se calcula cada tipo/estado y qué incluye cada filtro. Solo texto, no lee datos. */
export default function ClientesGuiaDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Cómo se calculan estos datos"
        className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-navy/45 hover:text-navy hover:bg-navy/[0.05] transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>

      {open && (
        <Drawer
          title="Cómo se calculan estos datos"
          subtitle="De dónde salen las cifras de Clientes y qué significa cada estado"
          maxWidth="max-w-[460px]"
          onClose={() => setOpen(false)}
        >
          <div className="px-6 py-5 space-y-6 text-[13px] text-navy/70 leading-relaxed">

            <Section title="De dónde salen los datos">
              <p>
                Todo se calcula desde <B>Stripe</B> (los cobros reales), no desde Momence. Cada
                cliente se identifica por su <B>email</B>: si una persona tiene varios perfiles de
                Stripe con el mismo correo, se cuentan como <B>un solo cliente</B> y se suman sus pagos.
              </p>
              <p>
                El <B>producto</B> de cada cobro (suscripción, pack, clase suelta…) se deduce por el
                <B> importe</B>, comparándolo con el catálogo de precios de Momence (ver{" "}
                <Link href="/configuracion?tab=precios" className="text-primary hover:underline font-medium">
                  Configuración → Precios
                </Link>
                ).
              </p>
            </Section>

            <Section title="Tipos de cliente">
              <Item label="Recurrentes">
                Suscriptoras con <B>patrón de suscripción</B>: han pagado suscripción en al menos
                <B> 2 de los últimos 3 meses</B>.
              </Item>
              <Item label="Ocasionales">
                Todas las que <B>no</B> son recurrentes: compran packs o clases sueltas sin un patrón
                de suscripción. Una ocasional <B>deja de aparecer aquí</B> en cuanto acumula ese patrón
                (2 de 3 meses con suscripción) y pasa a Recurrente.
              </Item>
              <Item label="Con descuento">
                Tienen un cupón o descuento aplicado en Stripe (puntual o permanente).
              </Item>
              <Item label="Error de pago">
                Stripe intentó cobrar en los últimos 30 días y el cargo fue <B>rechazado</B>. La clienta
                sigue de alta pero no está pagando: requiere revisar el método de pago.
              </Item>
            </Section>

            <Section title="Estado de cada clienta">
              <p className="mb-2">
                Se calcula con los <B>días desde su último pago</B>, comparados con la vigencia de su
                plan. Cambia según sea suscripción o pack:
              </p>

              <p className="text-[12px] font-semibold text-navy/55 uppercase tracking-wide mt-3 mb-1.5">Suscripción</p>
              <Legend color="#16a34a" label="Al día" desc="Renovó hace ≤ 30 días." />
              <Legend color="#b45309" label="Sin pagar" desc="31–45 días desde el último pago (muestra los días de retraso)." />
              <Legend color="#dc2626" label="Baja" desc="Más de 45 días sin renovar: se considera baja." />

              <p className="text-[12px] font-semibold text-navy/55 uppercase tracking-wide mt-4 mb-1.5">Packs</p>
              <Legend color="#16a34a" label="Al día" desc="Dentro de la vigencia del pack (Benvinguda 15 días · Pack 4/8 clases 90 días)." />
              <Legend color="#d4a017" label="Vence pronto" desc="A punto de caducar (últimos ~3 días de Benvinguda · últimas ~2 semanas de Pack 4/8)." />
              <Legend color="#b45309" label="Pack vencido" desc="Superó la vigencia hace poco: buen momento para ofrecer renovación." />
              <Legend color="#dc2626" label="Baja" desc="Pack 4/8 caducado hace más de 15 días (>105 días desde la compra)." />
            </Section>

            <Section title="Retraso en renovar">
              <p>
                Es un filtro que reúne a quienes hay que <B>contactar ya</B>: las suscripciones
                <B> Sin pagar</B> (31–45 días) y los <B>packs vencidos</B>. Usa el mismo dato que el
                estado: días desde el último pago frente a la vigencia del plan.
              </p>
              <p>
                Ojo: las <B>Bajas</B> (suscripción &gt;45 días, o pack caducado hace mucho) <B>no</B>
                aparecen aquí - ya se dan por perdidas, no como retraso.
              </p>
            </Section>

            <Section title="Cuándo alguien desaparece de una lista">
              <Item label="De un estado de riesgo">
                En cuanto vuelve a pagar (nuevo cobro en Stripe), su contador se reinicia y pasa a
                <B> Al día</B>.
              </Item>
              <Item label="De Ocasionales">
                Cuando alcanza el patrón de recurrente (2 de los últimos 3 meses con suscripción).
              </Item>
              <Item label="De Retraso en renovar">
                Al renovar, o al cruzar el umbral de Baja (entonces pasa a esa otra categoría).
              </Item>
            </Section>

            <p className="text-[12px] text-navy/40 pt-1 border-t border-navy/[0.06]">
              Fuente: Stripe · pagos en tiempo real. Los productos se identifican por importe contra el
              catálogo de Momence (ver{" "}
              <Link href="/configuracion?tab=precios" className="text-primary hover:underline font-medium">
                Configuración → Precios
              </Link>
              ).
            </p>
          </div>
        </Drawer>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[13px] font-bold text-navy mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="font-semibold text-navy">{label}:</span> {children}
    </p>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-navy">{children}</span>;
}

function Legend({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: color }} />
      <p>
        <span className="font-semibold text-navy">{label}</span> - {desc}
      </p>
    </div>
  );
}
