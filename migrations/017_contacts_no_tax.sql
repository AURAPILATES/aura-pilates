-- Algunos contactos (bancos, entidades de financiación...) no llevan IVA ni retención por
-- naturaleza, no porque falte informarlo. Sin esta marca, iva_rate=0 y retencion_rate=0 son
-- indistinguibles de "todavía no se ha rellenado", y la tabla de Contactos los marca con un
-- aviso de dato faltante (ver TaxBadgeV2). Este flag permite decir explícitamente "0% a
-- propósito" y que el aviso desaparezca.
alter table contacts add column if not exists no_tax boolean not null default false;
