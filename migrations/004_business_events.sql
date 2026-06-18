create table if not exists business_events (
  id uuid default gen_random_uuid() primary key,
  fecha date not null,
  categoria text not null check (categoria in ('precios', 'horarios', 'promociones', 'operativo', 'otro')),
  titulo text not null,
  descripcion text,
  created_at timestamptz default now()
);

create index if not exists business_events_fecha_idx on business_events(fecha desc);
