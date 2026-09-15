-- Soporte para el sitio público (WhatsApp por sede, solicitudes de contacto/cita
-- desde la web, contenido editable del sitio) y la intranet administrativa.

-- WhatsApp propio de cada sede (con código de país, sin +, ej. 51987654321).
-- Se deja vacío/NULL hasta que se complete desde Sistema → Tablas → sedes.
alter table sedes add column if not exists whatsapp text;

-- Solicitudes de contacto/cita que llegan desde el sitio público. Cada sede
-- ve solo las suyas desde Recepción; la intranet las ve todas.
create table if not exists solicitudes_web (
  id uuid primary key default gen_random_uuid(),
  sede text not null,
  tipo text not null default 'contacto',        -- 'contacto' o 'cita'
  nombre text not null,
  telefono text not null,
  motivo text,
  estado text not null default 'pendiente',      -- 'pendiente' o 'atendida'
  atendido_por text,
  created_at timestamptz not null default now()
);
create index if not exists idx_solicitudes_web_sede_estado on solicitudes_web(sede, estado);

-- Contenido editable del sitio público (textos e imágenes), por clave única.
-- El sitio público lee esta tabla y usa el texto por defecto del HTML si una
-- clave todavía no tiene fila (para que el sitio nunca se vea roto/vacío).
create table if not exists sitio_contenido (
  clave text primary key,
  valor text,
  tipo text not null default 'texto',            -- 'texto' o 'imagen_url'
  actualizado_por text,
  updated_at timestamptz not null default now()
);

-- Publicaciones destacadas elegidas a mano para mostrar en el sitio público
-- (independiente del timeline automático de Facebook).
create table if not exists publicaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  texto text,
  imagen_url text,
  link_facebook text,
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_publicaciones_activo_orden on publicaciones(activo, orden);
