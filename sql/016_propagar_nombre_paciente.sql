-- Al cambiar el nombre de un paciente, propaga el nuevo nombre a todas
-- las tablas que lo referencian por texto (paciente_nombre). Antes, las
-- pantallas de edición (Recepción y Registro temporal) solo actualizaban
-- pacientes.nombre y el paquete, sesiones y pagos quedaban "huérfanos"
-- con el nombre viejo (caso Enzo Mendoza Laboriano, 30/09/2026).
--
-- Alcance: la sede del paciente + sus sedes_compartidas (lista separada
-- por comas), igual que _filtroSedeSb() en recepción.
--
-- Protecciones:
--  * Si el nombre nuevo ya lo usa OTRO paciente en esas sedes, se bloquea
--    el cambio: si no, sus datos quedarían mezclados bajo un mismo nombre.
--  * Si el nombre viejo lo comparte otro paciente en esas sedes, no se
--    propaga nada (no hay forma de saber qué filas son de quién).

create or replace function propagar_nombre_paciente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sedes text[];
  t text;
  tablas text[] := array[
    'programas_paciente','sesiones','pagos','precio_paciente',
    'reprogramaciones','recordatorios_enviados','documentos',
    'notas_clinicas','objetivos_terapeuticos','registro_animo',
    'fichas_seguimiento','fichas_recepcion_log','alertas_log'
  ];
begin
  if new.nombre is not distinct from old.nombre then
    return new;
  end if;

  select array_agg(distinct s) into sedes
  from (
    select old.sede as s
    union select new.sede
    union select trim(x) from unnest(string_to_array(coalesce(old.sedes_compartidas,''), ',')) x
    union select trim(x) from unnest(string_to_array(coalesce(new.sedes_compartidas,''), ',')) x
  ) q
  where s is not null and s <> '';

  if exists (select 1 from pacientes p
             where p.id <> new.id and p.nombre = new.nombre and p.sede = any(sedes)) then
    raise exception 'Ya existe otro paciente llamado "%" en esta sede. Usa un nombre distinto (ej. agrega el segundo apellido).', new.nombre;
  end if;

  if exists (select 1 from pacientes p
             where p.id <> new.id and p.nombre = old.nombre and p.sede = any(sedes)) then
    raise notice 'Otro paciente también se llama "%": no se propaga el cambio de nombre.', old.nombre;
    return new;
  end if;

  foreach t in array tablas loop
    if to_regclass('public.' || t) is not null then
      execute format('update public.%I set paciente_nombre = $1 where paciente_nombre = $2 and sede = any($3)', t)
        using new.nombre, old.nombre, sedes;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function propagar_nombre_paciente() from public, anon, authenticated;

drop trigger if exists trg_propagar_nombre_paciente on pacientes;
create trigger trg_propagar_nombre_paciente
  after update of nombre on pacientes
  for each row
  execute function propagar_nombre_paciente();
