-- Palabras clave obvias para auto-categorizar movimientos de CaixaBank que hoy caen en
-- "Otros" porque su concepto no coincide con ninguna keyword existente. Solo se añaden a
-- categorías que ya existen (no se crea ninguna categoría nueva).
update categories set auto_keywords = trim(',' from coalesce(auto_keywords, '') || ', modelo 115')
where value = 'IRPF' and coalesce(auto_keywords, '') not ilike '%modelo 115%';

update categories set auto_keywords = trim(',' from coalesce(auto_keywords, '') || ', tgss.cotizacion, tgss cotizacion')
where value = 'Seguridad social' and coalesce(auto_keywords, '') not ilike '%tgss%';

update categories set auto_keywords = trim(',' from coalesce(auto_keywords, '') || ', iberdrola')
where value = 'Luz' and coalesce(auto_keywords, '') not ilike '%iberdrola%';

update categories set auto_keywords = trim(',' from coalesce(auto_keywords, '') || ', aigues')
where value = 'Agua' and coalesce(auto_keywords, '') not ilike '%aigues%';

update categories set auto_keywords = trim(',' from coalesce(auto_keywords, '') || ', o2 movil')
where value = 'Teléfono' and coalesce(auto_keywords, '') not ilike '%o2 movil%';

update categories set auto_keywords = trim(',' from coalesce(auto_keywords, '') || ', gest.i solucions, boldu pla')
where value = 'Gestoría y legal' and coalesce(auto_keywords, '') not ilike '%boldu%';

update categories set auto_keywords = trim(',' from coalesce(auto_keywords, '') || ', sqsp, spotify')
where value = 'Software' and coalesce(auto_keywords, '') not ilike '%sqsp%';

update categories set auto_keywords = trim(',' from coalesce(auto_keywords, '') || ', occident')
where value = 'Seguros' and coalesce(auto_keywords, '') not ilike '%occident%';

update categories set auto_keywords = trim(',' from coalesce(auto_keywords, '') || ', amazon, ikea, makro')
where value = 'Material y maquinaria' and coalesce(auto_keywords, '') not ilike '%amazon%';
