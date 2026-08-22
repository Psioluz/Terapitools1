-- tarifas_sede tenía 2 generaciones de columnas para lo mismo: terapia/precio_sesion/
-- precio_paquete (diseño original) y nombre_servicio/costo_por_sesion/costo_total
-- (rediseño con sede+cuotas). Ninguna app escribe ya las columnas viejas -- guardarTarifa()
-- en administración solo usa nombre_servicio/costo_total/cantidad_cuotas/monto_cuota.
-- costo_por_sesion tampoco se escribe (reemplazado por monto_cuota). La tabla está vacía
-- (0 filas), así que se eliminan sin riesgo de perder datos.
alter table tarifas_sede drop column if exists terapia;
alter table tarifas_sede drop column if exists precio_sesion;
alter table tarifas_sede drop column if exists precio_paquete;
alter table tarifas_sede drop column if exists costo_por_sesion;
