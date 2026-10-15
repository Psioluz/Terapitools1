# Control de stock de cajas (SKU 153523 / 153553 / 153526)

Cada día, alrededor de las 08:30, llega el correo **"PE4 RSP - TOTAL INVENTORY SNAPSHOT (dd/mm/aaaa hh:mm:ss)"** de
`yobelrsp@yobel.biz` con el adjunto `TotalFotoRsp_-_AAAAMMDDHH.xlsx`. Este proceso:

1. Busca el correo del día en Gmail y abre el adjunto.
2. En la hoja `BaseDeDatosReporteador` suma el `Saldo` de las filas cuyo `Código Item` es 153523, 153553 o 153526
   **y** cuyo `Atributo 2` es `DISPONIBLE`. Un SKU puede tener varias filas; por ejemplo, en el archivo del 15/10/2026
   el 153553 tiene 4 575 + 450 = 5 025.
3. Guarda una fila por día en `Stock_Diario`.
4. Calcula el consumo diario, el promedio mensual y los días de cobertura (hojas `Consumo_Diario` e `Indicador`).
5. Si a la **hora límite** (10:00 por defecto) no se ha cargado el stock del día, envía una **alerta por correo**, una
   sola vez por día.

## Archivos

| Archivo | Para qué |
|---|---|
| `Control_Stock_Cajas.xlsx` | Plantilla del libro. Ya trae cargado el stock del 15/10/2026: 153523 = 6 725, 153553 = 5 025, 153526 = 11 025. |
| `apps-script/Codigo.gs` | Script que lee el correo, carga el stock y envía las alertas. |
| `apps-script/appsscript.json` | Manifiesto: zona horaria America/Lima y servicio avanzado Drive API v3. |
| `generar_plantilla.py` | Vuelve a generar la plantilla (openpyxl) si hay que cambiar su estructura. |

## Hojas del libro

- **Indicador**: estado de la carga de hoy, stock actual, consumo del último intervalo, consumo promedio diario
  (últimos N días y mes en curso), consumo mensual promedio, días de cobertura y estado (OK / REPONER). Debajo está la
  tabla mensual (consumo, recepción y promedio diario por SKU) con un gráfico.
- **Config**: parámetros editables (celdas amarillas): remitente, asunto, nombre del adjunto, columnas, horas de
  revisión, hora límite, **destinatarios de la alerta**, fines de semana, cobertura mínima y carpeta de archivo en
  Drive.
- **Stock_Diario**: la llena el script. Columnas: Fecha | Hora | Archivo | Origen | stock de cada SKU | filas
  encontradas | fecha de carga.
- **Recepciones** (opcional): registre aquí las recepciones conocidas (fecha, SKU, cantidad, guía).
- **Consumo_Diario**: fórmulas. `Consumo = Stock anterior + Recepción − Stock actual`. Si el stock sube y no hay
  recepción registrada, se asume `Recepción = aumento` y la fila se marca "Aumento de stock sin recepción registrada".
  La columna `Días` cuenta los días entre snapshots, así los fines de semana o los días sin archivo no distorsionan
  el promedio diario.
- **Log**: bitácora de cargas, correos no encontrados y alertas.

## Instalación (Google Sheets + Apps Script)

Haga la instalación **con la cuenta de Google Workspace que recibe el correo del bot** (por ejemplo, una de las
direcciones @rashperu.com de la lista de distribución). El script busca el correo en el Gmail de esa cuenta.

1. Suba `Control_Stock_Cajas.xlsx` a Google Drive, ábralo y use **Archivo → Guardar como Hojas de cálculo de
   Google**.
2. En **Archivo → Configuración**, ponga la zona horaria **(GMT-05:00) Lima**.
3. Vaya a **Extensiones → Apps Script**:
   - Reemplace el contenido de `Código.gs` por el de `apps-script/Codigo.gs`.
   - En ⚙️ *Configuración del proyecto*, marque **"Mostrar el archivo de manifiesto appsscript.json"** y reemplace
     su contenido por el de `apps-script/appsscript.json` (activa la Drive API y la zona horaria de Lima).
   - Guarde.
4. Vuelva a la hoja y recárguela. Aparecerá el menú **Stock Cajas**.
5. En **Config**, reemplace `correo1@rashperu.com, correo2@rashperu.com` por los destinatarios reales. Revise también
   si el bot envía el reporte los fines de semana.
6. Ejecute **Stock Cajas → Revisar correo y cargar ahora** y acepte los permisos (Gmail, Drive, enviar correo).
7. Ejecute **Stock Cajas → Instalar revisiones diarias automáticas**. Se crean revisiones diarias a las horas de
   `Config` (por defecto 08:45, 09:15, 09:45, 10:15 y 12:00; Google las ejecuta con ±15 min de margen).
8. (Opcional) Ejecute **Stock Cajas → Enviar alerta de prueba** para comprobar los destinatarios.

## Cómo funciona la alerta

- En cada revisión, si el stock de hoy ya está cargado, el script no hace nada.
- Si no está cargado, busca el correo de hoy. Si lo encuentra, lo carga.
- Si no lo encuentra y ya pasó la **hora límite**, envía la alerta "ALERTA: no se cargó el stock de cajas del
  dd/mm/aaaa", una vez por día. Si el correo llega más tarde, la siguiente revisión lo carga igual.
- Después de cada carga, si algún SKU queda con menos días de cobertura que `Cobertura mínima`, envía un aviso de
  reposición, también una vez por día.

## Carga manual (días perdidos o históricos)

Suba el `.xlsx` a Drive y use **Stock Cajas → Cargar desde archivo de Drive…**. La fecha se lee del nombre
(`..._AAAAMMDDHH.xlsx`). Si ese día ya estaba cargado, la fila se reemplaza, y la hoja se reordena por fecha.

## Notas

- Si cambia un SKU, edítelo en Config. Las columnas E, F y G de `Stock_Diario` siguen el orden de la tabla de SKUs.
- La plantilla tiene espacio para 730 días (unos 2 años) y la tabla mensual va de oct-2026 a sep-2028. Para ampliar
  ese rango, cambie `N1` y `months` en `generar_plantilla.py` y `FILA_FIN` en `Codigo.gs`.
- El consumo de un intervalo que cruza fin de mes se asigna al mes de la fecha final del intervalo.
