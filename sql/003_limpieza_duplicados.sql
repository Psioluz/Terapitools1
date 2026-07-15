-- Psicoluz — limpieza de columnas y tablas duplicadas/sin uso.
-- Generado a partir de una auditoría real de Supabase (esquema + datos)
-- cruzada contra el código fuente de las 4 apps (psicologa, recepcion,
-- gerencia, sistema) el 2026-07-15.
--
-- CADA elemento de este script cumple las dos condiciones:
--   1) Ningún app.html lo lee ni lo escribe (verificado con grep sobre
--      el código real, no supuesto).
--   2) En los datos reales de producción está vacío/NULL/0 en todas las
--      filas muestreadas — no hay nada que se vaya a perder.
--
-- Antes de correr esto: usa la pestaña "Documentación" o "Duplicados"
-- del app Sistema (o vuelve a correr el inspector) para confirmar que
-- sigue así — si alguien cargó datos nuevos en estas columnas desde que
-- se hizo esta auditoría, avísame antes de borrar.

-- ═══════════════════════════════════════════════════════════
-- 1) TABLAS COMPLETAS SIN USO (0 filas, ningún código las referencia)
-- ═══════════════════════════════════════════════════════════
drop table if exists programa_terapias;
drop table if exists programas_paciente;

-- ═══════════════════════════════════════════════════════════
-- 2) psicologas — columnas duplicadas/legacy
--    (dias_trabajo, numero_cuenta, cci, dia_pago son las que SÍ usan las apps)
-- ═══════════════════════════════════════════════════════════
alter table psicologas drop column if exists dias_laborables;   -- reemplazada por dias_trabajo
alter table psicologas drop column if exists fecha_pago;        -- reemplazada por dia_pago (día del mes)
alter table psicologas drop column if exists cuenta_bancaria;   -- reemplazada por numero_cuenta
alter table psicologas drop column if exists cuenta_interbancaria; -- reemplazada por cci

-- ═══════════════════════════════════════════════════════════
-- 3) recepcionistas — mismas duplicadas que psicologas
-- ═══════════════════════════════════════════════════════════
alter table recepcionistas drop column if exists dias_laborables;
alter table recepcionistas drop column if exists fecha_pago;
alter table recepcionistas drop column if exists cuenta_bancaria;
alter table recepcionistas drop column if exists cuenta_interbancaria;

-- ═══════════════════════════════════════════════════════════
-- 4) honorarios — quedó un rediseño a medias (monto_base/bonos/total
--    siempre en 0); lo que de verdad se usa es monto + fecha
-- ═══════════════════════════════════════════════════════════
alter table honorarios drop column if exists monto_base;
alter table honorarios drop column if exists bonos;
alter table honorarios drop column if exists total;

-- ═══════════════════════════════════════════════════════════
-- 5) bonos_diarios — mismo caso: pacientes_asistidos/monto_bono/tipo_bono
--    nunca se llenan; lo real es monto + motivo
-- ═══════════════════════════════════════════════════════════
alter table bonos_diarios drop column if exists pacientes_asistidos;
alter table bonos_diarios drop column if exists monto_bono;
alter table bonos_diarios drop column if exists tipo_bono;

-- ═══════════════════════════════════════════════════════════
-- 6) gastos — tipo/descripcion sin usar; lo real es concepto + categoria
-- ═══════════════════════════════════════════════════════════
alter table gastos drop column if exists tipo;
alter table gastos drop column if exists descripcion;

-- ═══════════════════════════════════════════════════════════
-- 7) documentos — columnas de un rediseño a Storage que nunca se
--    terminó de conectar; lo real es paciente_nombre/tipo/nombre/url/
--    fecha/mime/tamano (lo que usa recepción hoy al subir un archivo)
-- ═══════════════════════════════════════════════════════════
alter table documentos drop column if exists bucket;
alter table documentos drop column if exists path;
alter table documentos drop column if exists nombre_original;
alter table documentos drop column if exists tipo_doc;
alter table documentos drop column if exists relacionado_con;
alter table documentos drop column if exists url_publica;

-- ═══════════════════════════════════════════════════════════
-- NO INCLUIDO A PROPÓSITO (revisar aparte, no se tocó):
--
-- • psicologas.banco / recepcionistas.banco: sin uso activo en las apps,
--   pero es un campo con sentido (falta el input en el formulario de
--   Accesos de gerencia). Lo dejo — es un hueco de funcionalidad, no
--   basura.
-- • tarifas_sede.precio_sesion / precio_paquete: recepcion.html SÍ las
--   lee como respaldo (t.costo_total||t.precio_paquete). Están en 0 en
--   todas las filas así que no hacen nada hoy, pero como el código las
--   referencia no las borro sin que lo confirmes tú.
-- • psicologas.especialidad: casi siempre vacía en tus datos reales,
--   pero SÍ se usa (aparece como badge en gerencia/psicólogas). Es un
--   hueco de datos que hay que llenar, no una columna duplicada.
-- ═══════════════════════════════════════════════════════════
