-- Asignar iconos correctos a categorías existentes (campo emoji = clave de icono)
update categories set emoji = 'trending-up' where label in ('Ingresos Stripe', 'Ingresos USC');
update categories set emoji = 'home'         where label in ('Alquiler', 'Local');
update categories set emoji = 'users'        where label = 'Salarios';
update categories set emoji = 'shield'       where label = 'Seguridad social';
update categories set emoji = 'file-text'    where label = 'Gestoría y legal';
update categories set emoji = 'percent'      where label = 'Impuestos y tasas';
update categories set emoji = 'monitor'      where label = 'Software';
update categories set emoji = 'zap'          where label = 'Electricidad';
update categories set emoji = 'droplet'      where label = 'Agua';
update categories set emoji = 'phone'        where label = 'Teléfono';
update categories set emoji = 'briefcase'    where label = 'Seguros';
update categories set emoji = 'credit-card'  where label = 'Comisiones bancarias';
update categories set emoji = 'shopping-bag' where label = 'Merchandising';
update categories set emoji = 'settings'     where label = 'Material y maquinaria';
update categories set emoji = 'bar-chart'    where label = 'Inversión';
update categories set emoji = 'package'      where label = 'Otros';
update categories set emoji = 'repeat'       where label = 'Traspasos internos';

-- Añadir categoría "Traspasos internos" si no existe
insert into categories (value, label, emoji, bg_color, text_color, group_type, sort_order)
values ('traspasos-internos', 'Traspasos internos', 'repeat', '#64748b', '#64748b', 'internal', 90)
on conflict (value) do update set
  emoji      = excluded.emoji,
  group_type = excluded.group_type,
  text_color = excluded.text_color,
  bg_color   = excluded.bg_color;
