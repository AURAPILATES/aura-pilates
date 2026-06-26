-- Separa lo que viene tal cual del extracto bancario (Movimiento/concepto, Más datos, Fecha,
-- Fecha valor, Importe, Saldo) de lo que nutrimos nosotros (Contacto, Categoría). Antes
-- "contact" mezclaba ambos: a veces era texto crudo del banco (p. ej. "Recibos varios",
-- "SXPYDKKK -Stripe Technology Eu"), a veces un contacto ya resuelto contra contact_rules.
-- Ahora "bank_details" guarda siempre el texto crudo ("Más datos"), y "contact" solo se
-- rellena por coincidencia con un contacto guardado (ver contact_concepts) — null si no hay
-- coincidencia, a la espera de asignarlo a mano desde el drawer de un movimiento.
alter table transactions add column if not exists value_date date;
alter table transactions add column if not exists bank_details text;

-- Conserva en "bank_details" el texto crudo que ya había en "contact" antes de recalcularlo.
-- El recálculo de "contact" (cruzando concepto + bank_details contra los contactos guardados)
-- se hace desde la app: ver recomputeContactsFromBankDetails() en
-- app/transacciones/actions.ts — ejecutar una vez tras correr esta migración (por ejemplo
-- desde un botón temporal en Configuración > Contactos).
update transactions set bank_details = contact where bank_details is null and contact is not null;
