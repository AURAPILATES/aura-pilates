-- Registro de errores de pago que ya se han gestionado a mano ("hablado con clienta"),
-- para que dejen de contar como pendientes en Analítica hasta que falle un cobro nuevo.
-- error_date guarda la fecha del fallo que se reconoció: si aparece un fallo más reciente,
-- vuelve a mostrarse como pendiente aunque ya se hubiera reconocido uno anterior.
create table if not exists payment_error_acks (
  customer_id text primary key,
  error_date text,
  acked_at timestamptz not null default now()
);
