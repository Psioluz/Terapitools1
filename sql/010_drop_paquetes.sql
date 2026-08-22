-- Tabla "paquetes" era data semilla de la configuración inicial (3 filas de ejemplo),
-- nunca fue usada por ninguna app. Los precios y paquetes reales viven en tarifas_sede,
-- que sí soporta sede y cuotas. Se elimina para no confundir a futuro.
drop table if exists paquetes;
