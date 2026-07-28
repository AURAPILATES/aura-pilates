-- Enlace opcional entre un movimiento marcado "Es una devolución" y el movimiento contrario
-- que revierte (mismo importe en signo opuesto, fecha cercana) - permite mostrar con qué
-- movimiento está vinculado y mantener ambos lados en sincronía al marcar/desmarcar.
alter table transactions add column if not exists refund_link_id uuid references transactions(id) on delete set null;
