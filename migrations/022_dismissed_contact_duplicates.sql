-- Pares de contactos marcados a mano como "no está duplicado", para que la detección
-- automática (por nombre parecido o mismos conceptos bancarios, ver lib/duplicateContacts.ts)
-- deje de sugerirlos en Configuración > Contactos. Se guarda siempre con el id menor primero
-- (contact_id_a < contact_id_b) para no duplicar el mismo par en ambos sentidos.
create table if not exists dismissed_contact_duplicates (
  contact_id_a bigint not null references contacts(id) on delete cascade,
  contact_id_b bigint not null references contacts(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (contact_id_a, contact_id_b)
);
