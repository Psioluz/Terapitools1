# Psicoluz

Apps del Centro Terapéutico Integral Psicoluz. Todo el sistema vive en
**Supabase** (nada en localStorage para datos de la clínica).

## Apps (carpeta `apps/`)

- `sistema` — panel de super-administración (solo escritorio, Flutter).
- `gerencia`, `administracion`, `recepcion`, `psicologa` — desplegadas en
  Vercel, una app = un proyecto = un enlace.

## Otras carpetas

- `flutter-desktop/` — proyecto de escritorio de Sistema, Recepción y
  Administración (Windows).
- `sql/` — migraciones de la base de datos, en orden.
