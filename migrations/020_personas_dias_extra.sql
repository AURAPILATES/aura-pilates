-- Días extra de vacaciones concedidos a un instructor, aparte del cálculo por
-- convenio (dias_totales, proporcional a jornada y fecha de inicio). El total
-- efectivo de vacaciones pasa a ser dias_totales + dias_extra. Se mantiene
-- separado para que el número "según convenio" siga siendo fiel y siempre se vea
-- por qué alguien tiene más días de los que le corresponden por convenio.
alter table personas
  add column if not exists dias_extra integer not null default 0;
