-- Registro de recordatorios de WhatsApp enviados desde Recepción.
-- El envío en sí sigue siendo manual (WhatsApp no permite automatizarlo sin
-- su API de pago), pero ahora queda registrado quién, cuándo y a qué sesión
-- se le mandó el recordatorio, para que no se pierda el rastro si algo falla.
create table if not exists recordatorios_enviados (
  id bigint generated always as identity primary key,
  sesion_id bigint not null,
  sede text not null,
  paciente_nombre text not null,
  fecha date not null,
  hora text,
  terapia text,
  enviado_por text,
  enviado_el timestamptz not null default now()
);

create index if not exists idx_recordatorios_sesion on recordatorios_enviados(sesion_id);
create index if not exists idx_recordatorios_sede_fecha on recordatorios_enviados(sede, fecha);

alter table recordatorios_enviados enable row level security;

drop policy if exists "anon full access" on recordatorios_enviados;
create policy "anon full access" on recordatorios_enviados for all to anon using (true) with check (true);
