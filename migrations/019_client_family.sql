-- Marca manual de clientes "Familiar" (amigos/familia con condiciones especiales),
-- para poder distinguirlos y filtrarlos en Clientes. No se puede derivar de Stripe,
-- así que se guarda a mano. La clave es el customer_id fusionado (el mismo id primario
-- por email que usa el resto de la app, ver payment_error_acks).
create table if not exists client_family (
  customer_id text primary key,
  is_family boolean not null default true,
  updated_at timestamptz not null default now()
);
