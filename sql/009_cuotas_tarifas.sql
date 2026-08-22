-- Permite dividir el precio de un paquete en cuotas de pago.
-- monto_cuota se recalcula automáticamente en la app (costo_total / cantidad_cuotas)
-- y se guarda aquí para que quede visible directo en la tabla sin recalcular.
alter table tarifas_sede add column if not exists cantidad_cuotas integer default 1;
alter table tarifas_sede add column if not exists monto_cuota numeric default 0;
