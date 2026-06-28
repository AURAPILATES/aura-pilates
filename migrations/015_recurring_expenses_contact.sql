-- Vincula cada gasto recurrente a un Contacto: el IVA/Retención se hereda de su ficha (ver
-- contacts en 011_contacts.sql) en vez de teclearse a mano por fila en Transacciones › Recurrentes.
alter table recurring_expenses add column if not exists contact_id bigint references contacts(id) on delete set null;

-- Backfill best-effort para gastos ya confirmados antes de este cambio: si el label del gasto
-- coincide (sin distinguir mayúsculas) con un contacto existente, lo vincula.
update recurring_expenses
set contact_id = contacts.id
from contacts
where lower(contacts.label) = lower(recurring_expenses.label)
  and recurring_expenses.contact_id is null;
