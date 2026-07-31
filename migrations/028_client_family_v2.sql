-- Marca manual "Familiar" clavada al member_id de Momence (antes iba por el customer_id de
-- Stripe, con lo que un cliente solo-Momence -efectivo/Urban, sin perfil de Stripe- no podía
-- marcarse). Ahora la clave es la persona real de Momence.
--
-- Las 4 marcas antiguas de client_family (por customer_id de Stripe) se migran a member_id con
-- scripts/backfill-family-v2.mjs (mapea customer→email→member). La tabla vieja se conserva.
--
-- Aplicada manualmente en Supabase (el repo no tiene runner de migraciones).

create table if not exists client_family_v2 (
  member_id   bigint      primary key,
  is_family   boolean     not null default true,
  updated_at  timestamptz not null default now()
);
