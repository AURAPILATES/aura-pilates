-- Recolorea las subcategorías existentes a partir del color de su categoría padre
-- (mismo tono base, distinta luminosidad), replicando lib/colorVariants.ts en SQL.

create or replace function _blend_hex(hex text, factor real) returns text as $$
declare
  r int := ('x' || lpad(substring(hex from 2 for 2), 2, '0'))::bit(8)::int;
  g int := ('x' || lpad(substring(hex from 4 for 2), 2, '0'))::bit(8)::int;
  b int := ('x' || lpad(substring(hex from 6 for 2), 2, '0'))::bit(8)::int;
  target int := case when factor >= 0 then 255 else 0 end;
  f real := abs(factor);
begin
  r := round(r + (target - r) * f);
  g := round(g + (target - g) * f);
  b := round(b + (target - b) * f);
  return '#' || lpad(to_hex(r), 2, '0') || lpad(to_hex(g), 2, '0') || lpad(to_hex(b), 2, '0');
end;
$$ language plpgsql immutable;

create or replace function _rgba12(hex text) returns text as $$
declare
  r int := ('x' || lpad(substring(hex from 2 for 2), 2, '0'))::bit(8)::int;
  g int := ('x' || lpad(substring(hex from 4 for 2), 2, '0'))::bit(8)::int;
  b int := ('x' || lpad(substring(hex from 6 for 2), 2, '0'))::bit(8)::int;
begin
  return 'rgba(' || r || ', ' || g || ', ' || b || ', 0.12)';
end;
$$ language plpgsql immutable;

-- Suministros: Luz más oscura, Agua = color del padre, Teléfono más clara.
update categories c set
  text_color = _blend_hex(p.text_color, -0.22),
  bg_color   = _rgba12(_blend_hex(p.text_color, -0.22))
from categories p
where p.value = 'Suministros' and c.parent_id = p.id and c.label = 'Luz';

update categories c set
  text_color = _blend_hex(p.text_color, 0),
  bg_color   = _rgba12(_blend_hex(p.text_color, 0))
from categories p
where p.value = 'Suministros' and c.parent_id = p.id and c.label = 'Agua';

update categories c set
  text_color = _blend_hex(p.text_color, 0.22),
  bg_color   = _rgba12(_blend_hex(p.text_color, 0.22))
from categories p
where p.value = 'Suministros' and c.parent_id = p.id and c.label = 'Teléfono';

-- Impuestos y tasas: IVA más oscuro, IRPF = color del padre, IS más claro.
update categories c set
  text_color = _blend_hex(p.text_color, -0.22),
  bg_color   = _rgba12(_blend_hex(p.text_color, -0.22))
from categories p
where p.label = 'Impuestos y tasas' and c.parent_id = p.id and c.label = 'IVA';

update categories c set
  text_color = _blend_hex(p.text_color, 0),
  bg_color   = _rgba12(_blend_hex(p.text_color, 0))
from categories p
where p.label = 'Impuestos y tasas' and c.parent_id = p.id and c.label = 'IRPF';

update categories c set
  text_color = _blend_hex(p.text_color, 0.22),
  bg_color   = _rgba12(_blend_hex(p.text_color, 0.22))
from categories p
where p.label = 'Impuestos y tasas' and c.parent_id = p.id and c.label = 'IS';

drop function _blend_hex(text, real);
drop function _rgba12(text);
