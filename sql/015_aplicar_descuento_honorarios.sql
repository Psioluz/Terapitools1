-- Permite marcar por trabajador(a)/mes si el descuento automático por
-- tardanza/inasistencia se aplica de verdad al total a pagar, o se deja
-- solo como dato informativo (ej. si la falta fue justificada y de
-- todos modos se decide pagar completo).
alter table honorarios add column if not exists aplicar_descuento boolean not null default true;
