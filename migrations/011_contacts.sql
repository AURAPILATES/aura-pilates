-- Contactos: identidad única (proveedor, empleado, organismo...) con categoría/IVA/retención
-- por defecto. Sustituye a contact_rules, que ataba una sola "clave" de coincidencia a cada
-- fila; ahora un contacto puede reconocerse por varios conceptos bancarios distintos (ver
-- contact_concepts) sin duplicar la ficha — p. ej. "Spotify" factura unas veces como
-- "SPOTIFY P4106A003" y otras como "SPOTIFY SPAIN SL".
create table if not exists contacts (
  id bigint generated always as identity primary key,
  label text not null,
  category text references categories(value) on delete set null,
  iva_rate numeric not null default 0,
  retencion_rate numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Patrones de concepto/contacto bancario (mismo cálculo que contactKeyFor en
-- lib/contactRules.ts) que identifican a un contacto. Varios patrones pueden apuntar al mismo
-- contacto.
create table if not exists contact_concepts (
  id bigint generated always as identity primary key,
  contact_id bigint not null references contacts(id) on delete cascade,
  pattern text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists contact_concepts_contact_id_idx on contact_concepts(contact_id);

-- Patrones descartados al revisar una importación ("esto no es un contacto a registrar"),
-- para no volver a sugerirlos en futuras importaciones.
create table if not exists ignored_contact_patterns (
  pattern text primary key,
  created_at timestamptz not null default now()
);

-- Migra contact_rules: varias filas con la misma etiqueta se fusionan en un solo contacto con
-- varios patrones (contact_rules se deja intacta como copia de seguridad; puede borrarse a
-- mano una vez verificada la migración).
insert into contacts (label, category, iva_rate, retencion_rate, created_at, updated_at)
select distinct on (label) label, category, iva_rate, retencion_rate, created_at, updated_at
from contact_rules
order by label, created_at asc;

insert into contact_concepts (contact_id, pattern)
select c.id, cr.contact_key
from contact_rules cr
join contacts c on c.label = cr.label
on conflict (pattern) do nothing;

-- Una vez verificado en la app que todos los contactos y patrones migraron bien:
-- drop table contact_rules;
