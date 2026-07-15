-- Psicoluz — habilita acceso (anon) a la tabla pagos_recurrentes,
-- usada por la app Administración (Alquiler y Pagos Fijos, y el
-- Calendario de pagos). Mismo patrón que sql/004: la tabla existe
-- con RLS activado pero sin política para anon, así que sin esto
-- el INSERT/SELECT se rechaza en seco con el mismo tipo de error
-- que tuvimos en programas_paciente.
--
-- Ejecuta esto en el SQL Editor de Supabase.

alter table pagos_recurrentes enable row level security;
drop policy if exists "anon full access" on pagos_recurrentes;
create policy "anon full access" on pagos_recurrentes for all to anon using (true) with check (true);
