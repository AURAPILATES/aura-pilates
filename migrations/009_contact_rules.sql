-- Reglas reutilizables por contacto: categoría, IVA y retención que el usuario confirma una
-- sola vez cuando el importador detecta un contacto nuevo (ver app/transacciones/ImportModal.tsx
-- y app/transacciones/actions.ts). Las importaciones siguientes del mismo contacto se aplican
-- automáticamente sin volver a preguntar.
create table if not exists contact_rules (
  id bigint generated always as identity primary key,
  contact_key text not null unique,
  label text not null,
  category text references categories(value) on delete set null,
  iva_rate numeric not null default 0,
  retencion_rate numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- IVA soportado / retención practicada de cada movimiento, copiados de la regla del contacto
-- en el momento de importar (no se recalculan si la regla cambia después, para no alterar
-- declaraciones de periodos ya cerrados).
alter table transactions add column if not exists iva_rate numeric;
alter table transactions add column if not exists retencion_rate numeric;
