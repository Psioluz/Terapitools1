-- BUG REAL: insumos.cantidad/minimo tenían los datos reales de stock (8, 12, 4, 6, 2, 3
-- unidades), pero Administración lee cantidad_actual/stock_minimo, que estaban en 0.00
-- para las 6 filas existentes -- el Inventario mostraba "0 unidades" y alertas de stock
-- bajo falsas para todo. Se migran los datos antes de eliminar las columnas viejas.
update insumos set cantidad_actual = cantidad where cantidad_actual = 0 and cantidad is not null;
update insumos set stock_minimo = minimo where stock_minimo = 0 and minimo is not null;
alter table insumos drop column if exists cantidad;
alter table insumos drop column if exists minimo;

-- BUG REAL: honorarios.monto/fecha tenían el sueldo real (S/1250 x 5 psicólogas,
-- julio 2026), pero Administración y Gerencia leen monto_base/total, que estaban en 0
-- -- la planilla mostraba S/0. Se migra el monto real a monto_base y total (sin
-- descuentos registrados, monto_base = total) antes de eliminar las columnas viejas.
update honorarios set monto_base = monto, total = monto where total = 0 and monto is not null;
alter table honorarios drop column if exists monto;
alter table honorarios drop column if exists fecha;

-- pacientes_terapias y sesiones.paciente_terapia_id son restos de un diseño normalizado
-- que quedó abandonado (0 filas en pacientes_terapias, 0 sesiones con ese id) a favor
-- del esquema que sí se usa hoy: programas_paciente + programa_terapias.
alter table sesiones drop column if exists paciente_terapia_id;
drop table if exists pacientes_terapias;
