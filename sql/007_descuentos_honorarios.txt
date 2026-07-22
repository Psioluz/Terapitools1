-- Descuentos por tardanza/inasistencia en honorarios (S/ por ocurrencia, configurable por Administración)
alter table honorarios add column if not exists descuento_tardanza numeric default 0;
alter table honorarios add column if not exists descuento_inasistencia numeric default 0;
