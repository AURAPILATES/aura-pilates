-- Registro de cada ejecución de los cron de sincronización (Momence).
-- Permite distinguir "no hubo eventos/clientes ese día" (ok=true, ítems=0)
-- de "la sincronización falló" (ok=false, error con el mensaje exacto),
-- algo que antes se perdía silenciosamente.
create table if not exists sync_runs (
  id bigint generated always as identity primary key,
  source text not null check (source in ('momence_events', 'momence_subscribers')),
  ran_at timestamptz not null default now(),
  ok boolean not null,
  items integer,
  error text
);

create index if not exists sync_runs_source_ran_at_idx on sync_runs(source, ran_at desc);
