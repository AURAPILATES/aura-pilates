-- Impide a nivel de base de datos que dos tarifas de Urban Sports Club cubran la misma fecha.
-- La app ya lo bloquea en las server actions (createUrbanRate/updateUrbanRate, ver
-- app/configuracion/actions.ts), pero antes de eso un solape se resolvía en silencio con una
-- regla de precedencia invisible en la UI (rateForDate en lib/urbanRates.ts: "gana" la tarifa
-- de start_date más reciente). Esta restricción es la misma garantía a nivel de esquema, por si
-- algo llegase a escribir en la tabla sin pasar por esas acciones.
--
-- daterange(start_date, end_date + 1) traduce el end_date INCLUSIVE de la tabla al límite
-- superior EXCLUSIVE que espera daterange; end_date NULL (vigente indefinidamente) se traduce
-- solo con NULL, que daterange() interpreta como "sin límite superior".
--
-- Si esta migración falla al aplicarse, es que ya existen tarifas solapadas en la tabla: hay
-- que revisarlas y corregirlas a mano antes de poder añadir la restricción. Para encontrarlas:
--   select a.id, a.start_date, a.end_date, b.id, b.start_date, b.end_date
--   from urban_rates a join urban_rates b on a.id < b.id
--   where daterange(a.start_date, a.end_date + 1) && daterange(b.start_date, b.end_date + 1);
alter table urban_rates
  add constraint urban_rates_no_overlap
  exclude using gist (daterange(start_date, end_date + 1) with &&);
