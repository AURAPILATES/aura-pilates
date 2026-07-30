-- Snapshot diario de suscripciones/packs desde la API PÚBLICA v2 de Momence
-- (api.momence.com, OAuth2), que a diferencia de la API interna sí devuelve la
-- base completa: el snapshot interno (subscriber_snapshots) infra-contaba ~3,7×
-- (22 vs 84 suscripciones reales, verificado 2026-07-29). Esta tabla la alimenta
-- el cron snapshot-subscribers-v2 (una fila por bought-membership activa).
--
-- Aplicada manualmente en Supabase (el repo no tiene runner de migraciones).

create table if not exists subscriber_snapshots_v2 (
  date                  date        not null,
  member_id             bigint      not null,
  email                 text        not null,
  bought_membership_id  bigint      not null,
  membership_id         bigint,
  membership_name       text,
  type                  text        not null,   -- subscription | on-demand-subscription | package-events | package-money | patron
  start_date            timestamptz,
  end_date              timestamptz,
  is_frozen             boolean     not null,
  event_credits_left    numeric,
  event_credits_total   numeric,
  money_credits_left    numeric,
  money_credits_total   numeric,
  primary key (date, bought_membership_id)
);
