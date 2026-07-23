-- Permite que un tipo de terapia sea exclusivo de una sede (opcional).
-- Si "sede" queda vacío/NULL, la terapia se considera disponible en TODAS
-- las sedes (comportamiento igual al actual, no rompe nada existente).
alter table terapias add column if not exists sede text;
