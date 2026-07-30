-- Asistencia real por clase desde la API PÚBLICA v2 de Momence (checkedIn), que la
-- API interna nunca expuso. Alimenta el bloque "Rendimiento por profesora" (Nivel 2):
-- ocupación real, tasa de no-show y conversión por profesora (1ª clase → suscripción/pack).
--
-- La alimenta el cron capture-attendance-v2 (ventana rolling diaria) + un backfill
-- one-shot del histórico completo (scripts/backfill-attendance-v2.mjs).
-- Ver [[project-profesoras-v2]].
--
-- Aplicada manualmente en Supabase (el repo no tiene runner de migraciones).

-- Una fila por sesión (clase). Guarda capacidad + conteos de reservas/asistencia ya
-- agregados, para no rescanear las reservas en cada lectura de ocupación/no-show.
create table if not exists class_sessions_v2 (
  session_id        bigint      primary key,
  starts_at         timestamptz not null,
  ends_at           timestamptz,
  teacher_id        bigint,
  teacher_name      text        not null,
  type              text        not null,      -- "fitness" = clase regular
  capacity          integer     not null default 0,
  booking_count     integer     not null default 0,  -- reservas activas (no canceladas)
  checked_in_count  integer     not null default 0,  -- asistencia real (checkedIn)
  is_cancelled      boolean     not null default false,
  captured_at       timestamptz not null default now()
);

create index if not exists class_sessions_v2_starts_at_idx on class_sessions_v2(starts_at);
create index if not exists class_sessions_v2_teacher_idx on class_sessions_v2(teacher_name);

-- Una fila por reserva activa (booking). Denormaliza fecha+profesora de la sesión para
-- que "la 1ª clase de cada miembro" (atribución de conversión) sea un escaneo de una sola
-- tabla. Solo reservas NO canceladas: un no-show = reserva sin checkedIn.
create table if not exists class_bookings_v2 (
  booking_id        bigint      primary key,
  session_id        bigint      not null,
  session_starts_at timestamptz not null,
  teacher_id        bigint,
  teacher_name      text        not null,
  member_id         bigint      not null,
  email             text,
  checked_in        boolean     not null default false,
  captured_at       timestamptz not null default now()
);

create index if not exists class_bookings_v2_member_idx on class_bookings_v2(member_id);
create index if not exists class_bookings_v2_checked_starts_idx on class_bookings_v2(checked_in, session_starts_at);

-- El cron v2 (subscribers y ahora attendance) usa sources que el CHECK original de
-- sync_runs (007) no contemplaba. Lo relajamos para que logSyncRun no falle en silencio.
alter table sync_runs drop constraint if exists sync_runs_source_check;
alter table sync_runs add constraint sync_runs_source_check
  check (source in ('momence_events', 'momence_subscribers', 'momence_subscribers_v2', 'momence_attendance_v2'));
