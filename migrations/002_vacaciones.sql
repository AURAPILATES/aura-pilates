-- Tabla de instructores/empleados
create table if not exists personas (
  id uuid default gen_random_uuid() primary key,
  nombre text not null unique,
  inicio_contrato date not null,
  jornada_dias integer not null default 5,
  dias_totales integer not null default 23,
  archived boolean not null default false,
  created_at timestamptz default now()
);

-- Tabla de ausencias individuales (un registro por día)
create table if not exists ausencias (
  id uuid default gen_random_uuid() primary key,
  persona_id uuid not null references personas(id) on delete cascade,
  tipo text not null check (tipo in ('vacaciones', 'enfermedad', 'familiar', 'otros')),
  fecha date not null,
  created_at timestamptz default now(),
  constraint ausencias_unique unique(persona_id, tipo, fecha)
);

-- Índice para consultas rápidas por persona
create index if not exists ausencias_persona_id_idx on ausencias(persona_id);

-- Datos iniciales desde vacaciones.json
insert into personas (nombre, inicio_contrato, jornada_dias, dias_totales) values
  ('Yuruaní', '2026-04-02', 4, 14),
  ('Úrsula',  '2026-03-03', 2,  8),
  ('Zuzi',    '2026-03-03', 2,  8)
on conflict (nombre) do nothing;

-- Vacaciones de Úrsula
insert into ausencias (persona_id, tipo, fecha)
select p.id, 'vacaciones', unnest(array[
  '2026-03-13', '2026-05-22',
  '2026-08-05', '2026-08-07', '2026-08-12', '2026-08-14'
]::date[])
from personas p where p.nombre = 'Úrsula'
on conflict on constraint ausencias_unique do nothing;

-- Vacaciones de Zuzi
insert into ausencias (persona_id, tipo, fecha)
select p.id, 'vacaciones', unnest(array[
  '2026-04-23', '2026-05-26', '2026-05-28',
  '2026-08-18', '2026-08-20', '2026-08-25', '2026-08-27'
]::date[])
from personas p where p.nombre = 'Zuzi'
on conflict on constraint ausencias_unique do nothing;
