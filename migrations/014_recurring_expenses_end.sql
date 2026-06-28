-- Permite marcar que un gasto/ingreso recurrente confirmado tiene fin: en una fecha
-- concreta, tras un número de repeticiones, o nunca (el default actual). Se usa para que
-- la previsión de cashflow (forecastConfirmedExpenses) deje de proyectar pagos futuros una
-- vez alcanzado el límite.
alter table recurring_expenses
  add column if not exists end_type text not null default 'never' check (end_type in ('never', 'date', 'count')),
  add column if not exists end_date date,
  add column if not exists end_count integer;
