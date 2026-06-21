-- Subcategorías: "Suministros" (Luz / Agua / Teléfono) e "Impuestos y tasas" (IVA / IRPF / IS)

alter table categories add column if not exists parent_id uuid references categories(id) on delete set null;
create index if not exists categories_parent_id_idx on categories(parent_id);

-- Categoría padre "Suministros" (Electricidad pasa a llamarse "Luz")
-- Nota: el `value` de las categorías existentes coincide con su `label` (no son slugs),
-- así que las nuevas categorías siguen la misma convención para no romper los Sets de
-- lib/transactions.ts y app/finanzas/instances/VolumenBruto.tsx que comparan por ese valor.
insert into categories (value, label, emoji, bg_color, text_color, group_type, sort_order)
select 'Suministros', 'Suministros', 'zap', bg_color, text_color, group_type, sort_order - 1
from categories where label = 'Electricidad'
on conflict (value) do nothing;

update categories set
  label = 'Luz',
  parent_id = (select id from categories where value = 'suministros')
where label = 'Electricidad';

update categories set parent_id = (select id from categories where value = 'suministros')
where label in ('Agua', 'Teléfono');

-- Subcategorías de "Impuestos y tasas": IVA, IRPF, IS
insert into categories (value, label, emoji, bg_color, text_color, group_type, parent_id, auto_keywords, sort_order)
select 'IVA', 'IVA', emoji, bg_color, text_color, group_type, id, 'iva, modelo 303, modelo 390', sort_order + 1
from categories where label = 'Impuestos y tasas'
on conflict (value) do nothing;

insert into categories (value, label, emoji, bg_color, text_color, group_type, parent_id, auto_keywords, sort_order)
select 'IRPF', 'IRPF', emoji, bg_color, text_color, group_type, id, 'irpf, retencion, retención, modelo 111, modelo 130', sort_order + 2
from categories where label = 'Impuestos y tasas'
on conflict (value) do nothing;

insert into categories (value, label, emoji, bg_color, text_color, group_type, parent_id, auto_keywords, sort_order)
select 'IS', 'IS', emoji, bg_color, text_color, group_type, id, 'impuesto sociedades, modelo 200, modelo 202', sort_order + 3
from categories where label = 'Impuestos y tasas'
on conflict (value) do nothing;

-- Reasignar transacciones históricas de "Impuestos y tasas" a la subcategoría correcta cuando
-- el concepto/contacto lo identifica con certeza. Las que no encajan se quedan en la categoría
-- padre para revisión manual.
update transactions set category = 'IVA'
where category = (select value from categories where label = 'Impuestos y tasas')
  and lower(coalesce(concept, '') || ' ' || coalesce(contact, '')) ~ 'iva|modelo 303|modelo 390';

update transactions set category = 'IRPF'
where category = (select value from categories where label = 'Impuestos y tasas')
  and lower(coalesce(concept, '') || ' ' || coalesce(contact, '')) ~ 'irpf|retenci|modelo 111|modelo 130';

update transactions set category = 'IS'
where category = (select value from categories where label = 'Impuestos y tasas')
  and lower(coalesce(concept, '') || ' ' || coalesce(contact, '')) ~ 'impuesto sociedades|modelo 200|modelo 202';
