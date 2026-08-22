-- Psicoluz — agrega la columna "categoria" a objetivos_terapeuticos, para
-- el nuevo Panel de Hitos de Desarrollo en la app Psicóloga (agrupa el
-- progreso por área: Comunicación verbal, Motricidad fina, Interacción
-- social, etc. — en vez de solo asistencia/ánimo).
--
-- Los objetivos que ya existan sin categoría quedan como "Otro" y se
-- pueden reclasificar editándolos desde Sistema si se desea.

alter table objetivos_terapeuticos add column if not exists categoria text default 'Otro';
