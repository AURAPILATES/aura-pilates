-- Tarifa pactada con Urban Sports Club: lo que Urban paga a Aura por cada clase asistida
-- (check-in). Momence NO expone este importe, así que lo guardamos aquí de forma explícita.
-- Con la tarifa vigente podemos estimar en vivo el € de Urban del mes en curso (check-ins ×
-- tarifa) antes de que llegue la transferencia del banco, que sigue siendo el dato real.
--
-- Vigencia por rango de fechas para soportar cambios de precio en el tiempo:
--   start_date  = primer día en que aplica esta tarifa (inclusive)
--   end_date    = último día en que aplica (inclusive); NULL = vigente indefinidamente
--   price_per_class = € por clase asistida
--
-- El rango [start_date, end_date] se interpreta contra la FECHA DE LA CLASE, no la del pago.
create table if not exists urban_rates (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date,
  price_per_class numeric(10,2) not null check (price_per_class >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists urban_rates_start_idx on urban_rates (start_date);

-- Semilla: tarifa actual conocida (11 €/clase) desde el primer mes con clases de Urban en
-- Momence (marzo 2026). Editable desde Configuración → Tarifa Urban. Solo si la tabla está
-- vacía, para no duplicar al reaplicar la migración.
insert into urban_rates (start_date, end_date, price_per_class)
select date '2026-03-01', null, 11.00
where not exists (select 1 from urban_rates);
