-- Grupo del contacto: proveedor / instructor / socio. NULL = se deduce del nombre
-- (ver contactGroupOf en lib/contactGroups.ts: instructores y socios conocidos van a su
-- grupo, el resto a proveedores). Editable a mano por contacto desde su ficha.
alter table contacts add column if not exists contact_group text;
