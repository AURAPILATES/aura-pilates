-- Añade el flag "variable" a recurring_expenses: marca los recurrentes cuyo importe
-- cambia cada vez (p.ej. gestoría) en vez de ser siempre el mismo. Por defecto false
-- para no afectar a los recurrentes existentes.
--
-- Aplicada manualmente en Supabase (el repo no tiene runner de migraciones).

alter table recurring_expenses add column if not exists variable boolean not null default false;
