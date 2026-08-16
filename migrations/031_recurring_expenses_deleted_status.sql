-- Añade el estado 'deleted' a recurring_expenses. El botón "Eliminar" de un recurrente
-- archivado (ignorado o dado de baja) hacía un DELETE real de la fila; como el patrón de
-- pagos histórico seguía existiendo en las transacciones, el heurístico volvía a detectarlo
-- como "por confirmar" en cuanto desaparecía la fila que lo mantenía descartado. Ahora
-- "Eliminar" pasa la fila a status='deleted' en vez de borrarla: sigue existiendo (así el
-- heurístico no vuelve a proponerla) pero queda oculta de la pestaña Recurrentes.
--
-- Aplicada manualmente en Supabase (el repo no tiene runner de migraciones).

alter table recurring_expenses drop constraint if exists recurring_expenses_status_check;
alter table recurring_expenses add constraint recurring_expenses_status_check
  check (status in ('confirmed', 'ignored', 'cancelled', 'deleted'));
