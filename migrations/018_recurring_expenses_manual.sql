-- Un gasto recurrente confirmado siempre nacía de una transacción real ya importada (su "key"
-- enlaza con una serie detectada por lib/recurring.ts). Para poder anticipar un gasto que
-- todavía no ha llegado al banco (ej. "en 2 meses empiezo a pagar X"), hace falta poder crearlo
-- sin esa transacción: `manual` lo marca como tal, y `anchor_date` guarda la fecha de
-- referencia (última cuota conocida o primera prevista) desde la que proyectar el próximo pago,
-- ya que sin movimientos reales no hay de dónde sacarla (ver forecastConfirmedExpenses).
alter table recurring_expenses add column if not exists manual boolean not null default false;
alter table recurring_expenses add column if not exists anchor_date date;
