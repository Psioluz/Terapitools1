# Revisión del sitio institucional

Esta propuesta está preparada en la rama `improve/psicoluz-institutional-web`. No modifica las apps de recepción, administración, sistema ni las migraciones SQL. La rama principal sigue separada para revisar antes de desplegar.

## Cambios

- Paleta basada en el logo: turquesa, lima, amarillo y fucsia, con textos oscuros.
- Navegación por anclas, todas las secciones visibles, menú móvil accesible y enlace para saltar al contenido.
- Presentación de atención para niños y adultos y orientación familiar; filtros de servicios.
- Tarjetas con direcciones activas de `sedes`, búsqueda por nombre/distrito y selección en formulario. Maps busca la dirección registrada, sin inventar pines.
- Logos de Facebook, Instagram y WhatsApp sin enlaces, como pidió el usuario. Los contactos de ejemplo se retiraron. Confirmar los canales oficiales antes de activarlos.
- Formulario conserva `solicitudes_web` y su esquema actual. Una respuesta correcta muestra confirmación de solicitud; una respuesta fallida conserva los campos y no afirma que se guardó. No abre WhatsApp con datos personales ni usa números ficticios.
- Publicaciones y textos CMS continúan leyendo Supabase. El contenido público se representa con nodos de texto y URLs HTTPS, sin interpolar HTML remoto.
- La imagen `ambiente-conceptual.png` fue generada para explorar el diseño. Está etiquetada como conceptual, no es una sede real; sustituir por fotografías autorizadas cuando estén disponibles.
- El bloque original de JavaScript de la intranet se conserva sin modificaciones, para no romper su flujo de edición.

## Verificación reproducible

Sirve `sitio-publico/` desde la raíz del repo:

```sh
python3 -m http.server 8020 --bind 127.0.0.1 --directory sitio-publico
```

Con Playwright y Chromium disponibles, ejecuta en otro terminal:

```sh
node tests/public-site.cjs
```

Si Playwright está instalado fuera del repo, establece `PLAYWRIGHT_MODULE` con la ruta a su módulo. En el entorno preparado:

```sh
PLAYWRIGHT_MODULE=/workspace/.cloud-setup/terapitools/node_modules/playwright node tests/public-site.cjs
```

`CHROMIUM_PATH` permite seleccionar otra ubicación del ejecutable. La prueba intercepta todas las llamadas de Supabase: nunca escribe solicitudes reales ni consulta pacientes o credenciales. Comprueba filtros, sedes, Maps, selección de formulario, contenido remoto sin ejecución de HTML, fallos y éxito de envío simulados, apertura de intranet, navegación móvil, cuatro anchos de pantalla y caída de carga de sedes.

## Límites antes de publicar

- El dominio informado es `https://psicoluz-sitio.vercel.app/`. El acceso HTTP desde este entorno fue bloqueado; no se ha verificado la configuración real de Vercel ni su directorio de despliegue. Conservar la configuración existente; el código del sitio está en `sitio-publico/`.
- El acceso Git de lectura y escritura es independiente del acceso a Vercel. No se ha cambiado ningún dominio ni solicitado un despliegue de producción. Un push de rama puede activar una vista previa según la configuración ya existente de Vercel; su protección y URL deben comprobarse allí. No se puede afirmar que una vista previa sea privada sin verificarlo.
- La autenticación heredada de intranet consulta `usuarios_gerencia` con contraseña en filtros desde el navegador. No se ha certificado su seguridad ni las políticas reales de Supabase. Requiere migración de autenticación/autorización y revisión de RLS antes de afirmar que la aplicación completa es apta para uso comercial.
- El formulario retiene el flujo existente. Faltan verificar en el servidor la validación, protección contra abuso, permisos de acceso, conservación y aviso de privacidad aprobado. Las validaciones de navegador no sustituyen esas medidas.
- Las pruebas de solicitudes están simuladas. No se ha validado una recepción real ni se han creado datos personales de prueba en producción.
- Revisar los textos CMS de portada/misión/visión: si existen valores anteriores en `sitio_contenido`, prevalecen sobre los valores locales por diseño.
- No se ha cambiado el contenido remoto, cuentas, sedes, permisos ni migraciones de la base clínica.

La revisión y aprobación de esta rama deben preceder a su integración en la rama que despliega Vercel.
