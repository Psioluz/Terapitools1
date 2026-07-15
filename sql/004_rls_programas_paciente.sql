-- Psicoluz — habilita acceso (anon) a las tablas del modelo de
-- programas/terapias múltiples usado por registrosesiones_4.html
-- (el "6to app" temporal de carga de datos).
--
-- El error "new row violates row-level security policy for table
-- programas_paciente" significa que la tabla existe con las columnas
-- correctas, pero tiene RLS activado sin ninguna política que permita
-- escribir con la anon key — por eso el INSERT se rechaza en seco.
--
-- Ejecuta esto en el SQL Editor de Supabase.

alter table programas_paciente enable row level security;
drop policy if exists "anon full access" on programas_paciente;
create policy "anon full access" on programas_paciente for all to anon using (true) with check (true);

alter table programa_terapias enable row level security;
drop policy if exists "anon full access" on programa_terapias;
create policy "anon full access" on programa_terapias for all to anon using (true) with check (true);

-- registrosesiones_4.html también LEE de "paquetes" para autocompletar
-- el costo/n° de sesiones de cada paquete — si esa tabla también tiene
-- RLS restrictivo, sus consultas fallarían en silencio (el dropdown de
-- paquetes saldría vacío, sin mensaje de error visible). La incluyo por
-- si acaso; si la tabla no existe, este bloque no hace nada (el
-- catch de Postgres para "relation does not exist" no aplica a
-- alter/create policy sobre una tabla inexistente, así que si te da
-- error aquí es porque "paquetes" no existe — avísame y reviso qué
-- tabla usa la app en su lugar).
alter table paquetes enable row level security;
drop policy if exists "anon full access" on paquetes;
create policy "anon full access" on paquetes for all to anon using (true) with check (true);
