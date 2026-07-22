-- Psicoluz — nuevas tablas para que el seguimiento clínico
-- (notas rápidas, objetivos terapéuticos, ánimo del paciente) viva en
-- Supabase en vez de localStorage. Ejecutar en el SQL Editor de Supabase.
-- Sigue el mismo patrón de RLS abierta a la anon key que ya usan las
-- demás tablas de la app (pacientes, sesiones, etc).

create table if not exists notas_clinicas (
  id uuid primary key default gen_random_uuid(),
  sede text not null,
  psicologa_nombre text not null,
  paciente_nombre text not null,
  fecha date not null default (now() at time zone 'America/Lima')::date,
  hora text,
  texto text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_notas_clinicas_pac on notas_clinicas (sede, paciente_nombre);

create table if not exists objetivos_terapeuticos (
  id uuid primary key default gen_random_uuid(),
  sede text not null,
  psicologa_nombre text not null,
  paciente_nombre text not null,
  texto text not null,
  progreso int not null default 0 check (progreso between 0 and 100),
  fecha date not null default (now() at time zone 'America/Lima')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_objetivos_pac on objetivos_terapeuticos (sede, paciente_nombre);

create table if not exists registro_animo (
  id uuid primary key default gen_random_uuid(),
  sede text not null,
  psicologa_nombre text not null,
  paciente_nombre text not null,
  fecha date not null default (now() at time zone 'America/Lima')::date,
  valor int not null check (valor between 1 and 5),
  created_at timestamptz not null default now(),
  unique (sede, psicologa_nombre, paciente_nombre, fecha)
);
create index if not exists idx_animo_pac on registro_animo (sede, paciente_nombre);

-- RLS: misma política abierta que el resto de tablas de la app (acceso vía anon key)
alter table notas_clinicas enable row level security;
alter table objetivos_terapeuticos enable row level security;
alter table registro_animo enable row level security;

drop policy if exists "anon full access" on notas_clinicas;
create policy "anon full access" on notas_clinicas for all to anon using (true) with check (true);

drop policy if exists "anon full access" on objetivos_terapeuticos;
create policy "anon full access" on objetivos_terapeuticos for all to anon using (true) with check (true);

drop policy if exists "anon full access" on registro_animo;
create policy "anon full access" on registro_animo for all to anon using (true) with check (true);
