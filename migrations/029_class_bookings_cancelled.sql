-- Añade el flag de reserva cancelada a class_bookings_v2. Antes solo capturábamos reservas
-- activas (includeCancelled=false), así que las cancelaciones no se veían. Son ~30% de las
-- reservas (medido jul 2026), distintas de los no-shows (reservó y no vino), y útiles para el
-- seguimiento por cliente. El cron capture-attendance-v2 y el backfill pasan a incluirlas.
--
-- Aplicada manualmente en Supabase (el repo no tiene runner de migraciones).

alter table class_bookings_v2 add column if not exists cancelled boolean not null default false;

create index if not exists class_bookings_v2_cancelled_idx on class_bookings_v2(cancelled);
