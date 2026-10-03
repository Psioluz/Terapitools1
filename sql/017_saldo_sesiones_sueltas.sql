-- Saldo de pacientes y sesiones SUELTAS (fuera de paquete) siempre
-- calculado desde los datos reales, sin depender de lo que escriba la app.
--
-- Problemas que se repetían (José Ángel Gonzales, 03/10/2026, y otros):
--  1. Al agendar una sesión suelta, Recepción guardaba en sesiones.saldo la
--     deuda ACUMULADA del paciente (pacientes.saldo + costo), no lo que
--     falta pagar de ESA sesión (ej. 2 sesiones de S/38 -> la 2.ª con
--     saldo S/76). Al pagarla bajaba a S/38, la sesión pasada parecía
--     "cuota vencida" y la app bloqueaba "Asistió" aunque estuviera pagada.
--     Un pago general que cubría varias sesiones además solo descontaba una.
--  2. recalc_saldo_suelto (creado el 03/10) contaba como pago "suelto"
--     cualquier pago con programa_id vacío, incluidos pagos de paquete ->
--     saldos a favor falsos.
--
-- Solución (todo en la base, funciona aunque la app no se actualice):
--  * saldo_suelto_real(): costo de sesiones sueltas - pagos sueltos (sin
--    paquete y no ligados a una sesión de paquete). Regla de la clínica:
--    "No asistió" SÍ se cobra (cuenta como sesión); solo Reprogramado y
--    Permiso no cuentan, y Cancelado anula lo pendiente.
--  * recalc_saldo_suelto(): guarda ese valor en pacientes.saldo y reparte
--    la deuda entre las sesiones sueltas de la más NUEVA a la más antigua
--    (los pagos cubren primero lo más antiguo), sin pasar el costo propio
--    de cada sesión. Se dispara con cualquier cambio en sesiones o pagos.
--  * Si la app escribe pacientes.saldo directamente, se reemplaza por el
--    valor real.
-- Datos: 16 pagos de paquete sin programa_id se ligaron a su paquete.

create or replace function public.saldo_suelto_real(p_nombre text, p_sede text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round((
    coalesce((select sum(coalesce(s.costo_total,0))
              from sesiones s
              where s.paciente_nombre = p_nombre and s.sede = p_sede
                and s.programa_id is null and coalesce(s.tipo,'') <> 'paquete'
                and s.estado not in ('cancelado','permiso','reprogramado')), 0)
  - coalesce((select sum(g.monto)
              from pagos g
              where g.paciente_nombre = p_nombre and g.sede = p_sede
                and g.programa_id is null
                and (g.sesion_id is null or exists (
                      select 1 from sesiones s2 where s2.id = g.sesion_id and s2.programa_id is null))), 0)
  )::numeric, 2);
$$;

create or replace function public.recalc_saldo_suelto(p_nombre text, p_sede text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo numeric;
  v_deuda numeric;
begin
  if p_nombre is null or p_sede is null then
    return;
  end if;

  v_saldo := saldo_suelto_real(p_nombre, p_sede);
  v_deuda := greatest(v_saldo, 0);

  update pacientes set saldo = v_saldo
  where nombre = p_nombre and sede = p_sede and saldo is distinct from v_saldo;

  with sueltas as (
    select s.id,
           s.estado not in ('cancelado','permiso','reprogramado') as cuenta,
           greatest(coalesce(s.costo_total,0) - coalesce(s.adelanto,0), 0) as propio,
           s.fecha, s.hora
    from sesiones s
    where s.paciente_nombre = p_nombre and s.sede = p_sede
      and s.programa_id is null and coalesce(s.tipo,'') <> 'paquete'
  ),
  orden as (
    select id, cuenta, propio,
           coalesce(sum(case when cuenta then propio else 0 end)
             over (order by cuenta desc, fecha desc, hora desc nulls last, id
                   rows between unbounded preceding and 1 preceding), 0) as previo
    from sueltas
  )
  update sesiones s
     set saldo = case when o.cuenta then greatest(0, least(o.propio, v_deuda - o.previo)) else 0 end
  from orden o
  where s.id = o.id
    and s.saldo is distinct from (case when o.cuenta then greatest(0, least(o.propio, v_deuda - o.previo)) else 0 end);
end;
$$;

create or replace function public.trg_recalc_saldo_desde_sesiones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 2 then
    return coalesce(NEW, OLD);
  end if;
  if TG_OP = 'DELETE' then
    perform recalc_saldo_suelto(OLD.paciente_nombre, OLD.sede);
    return OLD;
  end if;
  perform recalc_saldo_suelto(NEW.paciente_nombre, NEW.sede);
  if TG_OP = 'UPDATE' and (OLD.paciente_nombre is distinct from NEW.paciente_nombre or OLD.sede is distinct from NEW.sede) then
    perform recalc_saldo_suelto(OLD.paciente_nombre, OLD.sede);
  end if;
  return NEW;
end;
$$;

create or replace function public.trg_recalc_saldo_desde_pagos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 2 then
    return coalesce(NEW, OLD);
  end if;
  if TG_OP = 'DELETE' then
    perform recalc_saldo_suelto(OLD.paciente_nombre, OLD.sede);
    return OLD;
  end if;
  perform recalc_saldo_suelto(NEW.paciente_nombre, NEW.sede);
  if TG_OP = 'UPDATE' and (OLD.paciente_nombre is distinct from NEW.paciente_nombre or OLD.sede is distinct from NEW.sede) then
    perform recalc_saldo_suelto(OLD.paciente_nombre, OLD.sede);
  end if;
  return NEW;
end;
$$;

-- La app (Recepción, Sistema) escribe pacientes.saldo con su propio
-- cálculo en el navegador; se reemplaza siempre por el valor real.
create or replace function public.trg_saldo_paciente_real()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() = 1 then
    NEW.saldo := saldo_suelto_real(NEW.nombre, NEW.sede);
  end if;
  return NEW;
end;
$$;

revoke all on function public.saldo_suelto_real(text, text) from public, anon, authenticated;
revoke all on function public.recalc_saldo_suelto(text, text) from public, anon, authenticated;
revoke all on function public.trg_recalc_saldo_desde_sesiones() from public, anon, authenticated;
revoke all on function public.trg_recalc_saldo_desde_pagos() from public, anon, authenticated;
revoke all on function public.trg_saldo_paciente_real() from public, anon, authenticated;

-- (trg_sesiones_recalc_saldo y trg_pagos_recalc_saldo ya existían.)
create trigger trg_saldo_paciente_real
  before update of saldo on pacientes
  for each row
  execute function public.trg_saldo_paciente_real();
