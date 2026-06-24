-- Gastos recurrentes confirmados manualmente: enlaza con las series detectadas
-- automáticamente por contacto/concepto + importe (ver lib/recurring.ts) mediante
-- "key", y guarda decisiones humanas que el heurístico no puede tomar por sí solo
-- (IVA deducible, retención, y si una serie sigue activa o se ha dado de baja).
create table if not exists recurring_expenses (
  id bigint generated always as identity primary key,
  key text not null unique,
  label text not null,
  category text,
  period text not null,
  period_days integer not null,
  amount numeric not null,
  iva_rate numeric not null default 0,
  retencion_rate numeric not null default 0,
  status text not null default 'confirmed' check (status in ('confirmed', 'ignored', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_expenses_status_idx on recurring_expenses(status);
