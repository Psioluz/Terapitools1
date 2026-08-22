-- Psicoluz — soporte para la app "Sistema" (administrador general).
-- Ejecutar en el SQL Editor de Supabase, junto con 001_seguimiento_clinico.sql.

-- Catálogo de sedes (antes "sede" era solo texto libre repetido en cada tabla).
create table if not exists sedes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  direccion text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);
insert into sedes (nombre) values ('Comas'),('Ovalo Zapallal'),('Flecha'),('Pachacutec')
  on conflict (nombre) do nothing;

-- Log de accesos: cada app inserta una fila cuando alguien inicia sesión.
create table if not exists log_accesos (
  id uuid primary key default gen_random_uuid(),
  app text not null,           -- 'psicologa' | 'recepcion' | 'gerencia' | 'sistema'
  usuario text,
  sede text,
  created_at timestamptz not null default now()
);
create index if not exists idx_log_accesos_created on log_accesos (created_at desc);

-- Log de errores: cada app reporta sus errores de JS no capturados.
create table if not exists log_errores (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  usuario text,
  sede text,
  mensaje text,
  stack text,
  url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_log_errores_created on log_errores (created_at desc);

alter table sedes enable row level security;
alter table log_accesos enable row level security;
alter table log_errores enable row level security;

drop policy if exists "anon full access" on sedes;
create policy "anon full access" on sedes for all to anon using (true) with check (true);

drop policy if exists "anon full access" on log_accesos;
create policy "anon full access" on log_accesos for all to anon using (true) with check (true);

drop policy if exists "anon full access" on log_errores;
create policy "anon full access" on log_errores for all to anon using (true) with check (true);
