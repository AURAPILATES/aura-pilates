-- Marca manual "Es una devolución": para movimientos que revierten otro (p.ej. una comisión
-- de tarjeta y su condonación en un movimiento aparte). Se excluye de ingresos/gastos en
-- Analítica y de los totales de Transacciones, para que la pareja no infle ambos lados -
-- el movimiento sigue viéndose en la lista, solo deja de sumar.
alter table transactions add column if not exists is_refund boolean not null default false;
