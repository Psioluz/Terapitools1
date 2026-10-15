/**
 * Control de stock de cajas (SKU 153523 / 153553 / 153526)
 *
 * Lee el correo diario "PE4 RSP - TOTAL INVENTORY SNAPSHOT (dd/mm/aaaa hh:mm:ss)"
 * de yobelrsp@yobel.biz, abre el adjunto TotalFotoRsp_-_AAAAMMDDHH.xlsx,
 * suma el Saldo de las filas con Atributo 2 = DISPONIBLE para cada SKU de Config
 * y lo guarda en la hoja Stock_Diario. Si a la hora límite no se cargó el stock
 * del día, envía una alerta por correo a los destinatarios de Config.
 *
 * Requiere el servicio avanzado "Drive API" (v3) — ya declarado en appsscript.json.
 */

const HOJA_STOCK = 'Stock_Diario';
const HOJA_LOG = 'Log';
const FILA_INI = 5;       // primera fila de datos en Stock_Diario
const FILA_FIN = 734;     // última fila con fórmulas en Consumo_Diario
const N_COLS_STOCK = 9;   // A:I  Fecha | Hora | Archivo | Origen | SKU1 | SKU2 | SKU3 | Filas | Cargado el

/* ------------------------------------------------------------------ menú */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Stock Cajas')
    .addItem('Revisar correo y cargar ahora', 'revisarYCargar')
    .addItem('Cargar desde archivo de Drive…', 'cargarDesdeDriveManual')
    .addSeparator()
    .addItem('Instalar revisiones diarias automáticas', 'instalarRevisiones')
    .addItem('Quitar revisiones automáticas', 'quitarRevisiones')
    .addItem('Enviar alerta de prueba', 'enviarAlertaPrueba')
    .addToUi();
}

/* -------------------------------------------------------- proceso diario */

/** Función que ejecutan los activadores. Idempotente: si hoy ya hay carga, no hace nada. */
function revisarYCargar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const ss = SpreadsheetApp.getActive();
    const cfg = leerConfig_(ss);
    const hoy = soloFecha_(new Date());

    limpiarMarcasAntiguas_();
    if (existeCarga_(ss, hoy)) return;

    const hallazgo = buscarCorreoDelDia_(cfg, hoy);
    if (hallazgo) {
      const res = cargarAdjunto_(ss, cfg, hallazgo.blob, hallazgo.fechaSnapshot, hallazgo.horaSnapshot, 'Correo');
      registrar_(ss, 'Carga OK', res.detalle);
      avisarCoberturaBaja_(ss, cfg);
      return;
    }

    registrar_(ss, 'Sin correo', 'No se encontró el correo/adjunto del día a las ' + hora_(new Date()) + '.');
    if (pasoHoraLimite_(cfg) && correspondeAlertar_(cfg, hoy)) {
      enviarAlertaFaltante_(ss, cfg, hoy);
    }
  } catch (e) {
    registrar_(SpreadsheetApp.getActive(), 'Error', String(e && e.stack || e));
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/** Busca en Gmail el correo del bot recibido hoy y devuelve el adjunto. */
function buscarCorreoDelDia_(cfg, hoy) {
  const tz = Session.getScriptTimeZone();
  const desde = Utilities.formatDate(hoy, tz, 'yyyy/MM/dd');
  const q = [
    cfg.remitente ? 'from:' + cfg.remitente : '',
    cfg.asunto ? 'subject:"' + cfg.asunto + '"' : '',
    'has:attachment',
    'after:' + desde,
  ].join(' ');

  const hilos = GmailApp.search(q, 0, 20);
  let mejor = null;
  hilos.forEach(function (h) {
    h.getMessages().forEach(function (m) {
      if (soloFecha_(m.getDate()).getTime() !== hoy.getTime()) return;
      m.getAttachments().forEach(function (a) {
        const nombre = a.getName();
        if (!/\.xlsx?$/i.test(nombre)) return;
        if (cfg.patron && nombre.toLowerCase().indexOf(cfg.patron.toLowerCase()) !== 0) return;
        if (!mejor || m.getDate() > mejor.fechaCorreo) {
          mejor = { blob: a.copyBlob().setName(nombre), fechaCorreo: m.getDate(), asunto: m.getSubject() };
        }
      });
    });
  });
  if (!mejor) return null;

  // Fecha/hora del snapshot: primero el asunto "(15/10/2026 08:29:18)", si no la del correo.
  const mm = /\((\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/.exec(mejor.asunto || '');
  if (mm) {
    mejor.fechaSnapshot = new Date(+mm[3], +mm[2] - 1, +mm[1]);
    mejor.horaSnapshot = mm[4] + ':' + mm[5];
  } else {
    mejor.fechaSnapshot = soloFecha_(mejor.fechaCorreo);
    mejor.horaSnapshot = hora_(mejor.fechaCorreo);
  }
  return mejor;
}

/**
 * Convierte el .xlsx a Google Sheets temporal, suma el stock DISPONIBLE por SKU
 * y escribe/actualiza la fila de la fecha en Stock_Diario.
 */
function cargarAdjunto_(ss, cfg, blob, fechaSnapshot, horaSnapshot, origen) {
  if (cfg.carpetaDrive) {
    DriveApp.getFolderById(cfg.carpetaDrive).createFile(blob.copyBlob());
  }

  const tmp = Drive.Files.create(
    { name: 'tmp_stock_' + blob.getName(), mimeType: MimeType.GOOGLE_SHEETS },
    blob.copyBlob()
  );
  let totales, filas;
  try {
    const hoja = SpreadsheetApp.openById(tmp.id).getSheetByName(cfg.hojaOrigen);
    if (!hoja) throw new Error('El archivo no tiene la hoja "' + cfg.hojaOrigen + '".');
    const ultFila = hoja.getLastRow();
    const encabezado = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]
      .map(function (v) { return String(v).trim().toLowerCase(); });
    const col = function (nombre) {
      const i = encabezado.indexOf(String(nombre).trim().toLowerCase());
      if (i < 0) throw new Error('No se encontró la columna "' + nombre + '" en ' + cfg.hojaOrigen + '.');
      return i + 1;
    };
    const n = Math.max(ultFila - 1, 0);
    const leer = function (c) { return n ? hoja.getRange(2, c, n, 1).getValues() : []; };
    const cod = leer(col(cfg.colCodigo));
    const fil = leer(col(cfg.colFiltro));
    const sal = leer(col(cfg.colCantidad));

    const filtro = cfg.valorFiltro.trim().toUpperCase();
    totales = cfg.skus.map(function () { return 0; });
    filas = cfg.skus.map(function () { return 0; });
    for (let i = 0; i < n; i++) {
      if (String(fil[i][0]).trim().toUpperCase() !== filtro) continue;
      const k = cfg.skus.indexOf(String(cod[i][0]).trim());
      if (k < 0) continue;
      totales[k] += aNumero_(sal[i][0]);
      filas[k] += 1;
    }
  } finally {
    DriveApp.getFileById(tmp.id).setTrashed(true);
  }

  escribirFila_(ss, [
    fechaSnapshot, horaSnapshot, blob.getName(), origen,
    totales[0], totales[1], totales[2], filas.join('/'), new Date(),
  ]);

  const sinFilas = cfg.skus.filter(function (s, k) { return filas[k] === 0; });
  let detalle = Utilities.formatDate(fechaSnapshot, Session.getScriptTimeZone(), 'dd/MM/yyyy') + ' ' + horaSnapshot +
    ' — ' + cfg.skus.map(function (s, k) { return s + '=' + totales[k]; }).join(', ') + ' (' + blob.getName() + ')';
  if (sinFilas.length) {
    detalle += ' | ATENCIÓN: sin filas ' + cfg.valorFiltro + ' para ' + sinFilas.join(', ') + ' (se registró 0).';
  }
  return { totales: totales, detalle: detalle };
}

/** Inserta o reemplaza la fila de esa fecha y deja Stock_Diario ordenado por fecha. */
function escribirFila_(ss, fila) {
  const sh = ss.getSheetByName(HOJA_STOCK);
  const rango = sh.getRange(FILA_INI, 1, FILA_FIN - FILA_INI + 1, N_COLS_STOCK);
  const datos = rango.getValues();
  const t = soloFecha_(fila[0]).getTime();
  let destino = -1, n = 0;
  for (let i = 0; i < datos.length; i++) {
    if (datos[i][0] === '' || datos[i][0] === null) break;
    n++;
    if (datos[i][0] instanceof Date && soloFecha_(datos[i][0]).getTime() === t) destino = i;
  }
  if (destino < 0) {
    if (n >= datos.length) throw new Error('Stock_Diario está lleno (' + datos.length + ' filas). Amplíe la plantilla.');
    destino = n;
    n++;
  }
  sh.getRange(FILA_INI + destino, 1, 1, N_COLS_STOCK).setValues([fila]);
  if (n > 1) sh.getRange(FILA_INI, 1, n, N_COLS_STOCK).sort({ column: 1, ascending: true });
}

function existeCarga_(ss, fecha) {
  const sh = ss.getSheetByName(HOJA_STOCK);
  const t = fecha.getTime();
  return sh.getRange(FILA_INI, 1, FILA_FIN - FILA_INI + 1, 1).getValues()
    .some(function (r) { return r[0] instanceof Date && soloFecha_(r[0]).getTime() === t; });
}

/* ---------------------------------------------------------------- alertas */

function pasoHoraLimite_(cfg) {
  const p = cfg.horaLimite.split(':');
  const ahora = new Date();
  return ahora.getHours() * 60 + ahora.getMinutes() >= (+p[0]) * 60 + (+(p[1] || 0));
}

function correspondeAlertar_(cfg, hoy) {
  const dia = hoy.getDay();
  if ((dia === 0 || dia === 6) && cfg.finesSemana !== 'SI') return false;
  return !PropertiesService.getScriptProperties().getProperty(claveAlerta_('faltante', hoy));
}

function enviarAlertaFaltante_(ss, cfg, hoy) {
  if (!cfg.destinatarios) {
    registrar_(ss, 'Alerta NO enviada', 'No hay destinatarios en Config.');
    return;
  }
  const f = Utilities.formatDate(hoy, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const asunto = 'ALERTA: no se cargó el stock de cajas del ' + f;
  const cuerpo =
    'Hasta las ' + hora_(new Date()) + ' no se encontró/cargó el correo "' + cfg.asunto + '" de ' + cfg.remitente +
    ' con el adjunto ' + cfg.patron + '*.xlsx correspondiente al ' + f + '.\n\n' +
    'SKUs afectados: ' + cfg.skus.join(', ') + '.\n\n' +
    'Acciones: verificar si el bot envió el reporte; si llegó tarde, el script lo cargará en la siguiente revisión ' +
    'o puede usar el menú "Stock Cajas > Revisar correo y cargar ahora".\n\n' +
    'Planilla: ' + ss.getUrl();
  MailApp.sendEmail({ to: cfg.destinatarios, subject: asunto, body: cuerpo, name: 'Control Stock Cajas' });
  PropertiesService.getScriptProperties().setProperty(claveAlerta_('faltante', hoy), new Date().toISOString());
  registrar_(ss, 'Alerta enviada', asunto + ' → ' + cfg.destinatarios);
}

function avisarCoberturaBaja_(ss, cfg) {
  if (cfg.avisoCobertura !== 'SI' || !cfg.destinatarios) return;
  const hoy = soloFecha_(new Date());
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(claveAlerta_('cobertura', hoy))) return;
  SpreadsheetApp.flush();
  const cob = ss.getRangeByName('ind_Cobertura').getValues().map(function (r) { return r[0]; });
  const bajos = [];
  cfg.skus.forEach(function (s, k) {
    if (typeof cob[k] === 'number' && cob[k] < cfg.coberturaMin) bajos.push(s + ': ' + cob[k].toFixed(1) + ' días');
  });
  if (!bajos.length) return;
  const asunto = 'Aviso: cobertura baja de cajas (' + bajos.length + ' SKU)';
  MailApp.sendEmail({
    to: cfg.destinatarios,
    subject: asunto,
    body: 'Con el stock cargado hoy, estos SKU tienen cobertura menor a ' + cfg.coberturaMin + ' días:\n\n' +
      bajos.join('\n') + '\n\nVer hoja Indicador: ' + ss.getUrl(),
    name: 'Control Stock Cajas',
  });
  props.setProperty(claveAlerta_('cobertura', hoy), new Date().toISOString());
  registrar_(ss, 'Aviso cobertura', bajos.join(' | '));
}

function enviarAlertaPrueba() {
  const ss = SpreadsheetApp.getActive();
  const cfg = leerConfig_(ss);
  MailApp.sendEmail({
    to: cfg.destinatarios,
    subject: 'PRUEBA - Control Stock Cajas',
    body: 'Correo de prueba de la alerta de stock de cajas.\nPlanilla: ' + ss.getUrl(),
    name: 'Control Stock Cajas',
  });
  registrar_(ss, 'Prueba', 'Alerta de prueba enviada a ' + cfg.destinatarios);
  SpreadsheetApp.getUi().alert('Alerta de prueba enviada a: ' + cfg.destinatarios);
}

/* -------------------------------------------------------- carga manual */

/** Para cargar un día puntual (correo perdido o archivo histórico) desde un .xlsx subido a Drive. */
function cargarDesdeDriveManual() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Cargar desde Drive', 'Pegue el enlace o ID del archivo TotalFotoRsp_-_AAAAMMDDHH.xlsx en Drive:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const m = /[-\w]{25,}/.exec(r.getResponseText());
  if (!m) { ui.alert('No se reconoce el ID/enlace.'); return; }
  const archivo = DriveApp.getFileById(m[0]);
  const blob = archivo.getBlob().setName(archivo.getName());

  // Fecha desde el nombre: ..._AAAAMMDDHH.xlsx
  const f = /(\d{4})(\d{2})(\d{2})(\d{2})\D*$/.exec(archivo.getName().replace(/\.xlsx?$/i, ''));
  let fecha, hora;
  if (f) {
    fecha = new Date(+f[1], +f[2] - 1, +f[3]);
    hora = f[4] + ':00';
  } else {
    const rf = ui.prompt('Fecha del snapshot', 'No se pudo leer la fecha del nombre. Ingrese dd/mm/aaaa:', ui.ButtonSet.OK_CANCEL);
    if (rf.getSelectedButton() !== ui.Button.OK) return;
    const p = rf.getResponseText().trim().split('/');
    fecha = new Date(+p[2], +p[1] - 1, +p[0]);
    hora = '';
  }
  const ss = SpreadsheetApp.getActive();
  const res = cargarAdjunto_(ss, leerConfig_(ss), blob, fecha, hora, 'Manual');
  registrar_(ss, 'Carga manual', res.detalle);
  ui.alert('Cargado: ' + res.detalle);
}

/* ------------------------------------------------------------ activadores */

function instalarRevisiones() {
  quitarRevisiones();
  const cfg = leerConfig_(SpreadsheetApp.getActive());
  const horas = cfg.horasRevision.split(/[,;]/).map(function (s) { return s.trim(); }).filter(String);
  horas.forEach(function (h) {
    const p = h.split(':');
    ScriptApp.newTrigger('revisarYCargar').timeBased().everyDays(1)
      .atHour(+p[0]).nearMinute(+(p[1] || 0)).create();
  });
  registrar_(SpreadsheetApp.getActive(), 'Activadores', 'Revisiones diarias instaladas: ' + horas.join(', '));
  try { SpreadsheetApp.getUi().alert('Revisiones diarias instaladas: ' + horas.join(', ')); } catch (e) {}
}

function quitarRevisiones() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'revisarYCargar') ScriptApp.deleteTrigger(t);
  });
}

/* ---------------------------------------------------------------- helpers */

function leerConfig_(ss) {
  const v = function (n) {
    const r = ss.getRangeByName(n);
    if (!r) throw new Error('Falta el rango con nombre ' + n + ' en Config.');
    return r.getValue();
  };
  const txt = function (n) { return String(v(n) == null ? '' : v(n)).trim(); };
  const horaTxt = function (n) {
    const x = v(n);
    return x instanceof Date ? hora_(x) : String(x).trim();
  };
  return {
    remitente: txt('cfg_Remitente'),
    asunto: txt('cfg_Asunto'),
    patron: txt('cfg_PatronAdjunto'),
    hojaOrigen: txt('cfg_HojaOrigen'),
    colCodigo: txt('cfg_ColCodigo'),
    colFiltro: txt('cfg_ColFiltro'),
    valorFiltro: txt('cfg_ValorFiltro'),
    colCantidad: txt('cfg_ColCantidad'),
    horasRevision: txt('cfg_HorasRevision'),
    horaLimite: horaTxt('cfg_HoraLimite'),
    destinatarios: txt('cfg_Destinatarios').replace(/;/g, ','),
    finesSemana: txt('cfg_FinesSemana').toUpperCase(),
    coberturaMin: Number(v('cfg_CoberturaMin')) || 0,
    avisoCobertura: txt('cfg_AvisoCobertura').toUpperCase(),
    carpetaDrive: txt('cfg_CarpetaDrive'),
    skus: ss.getRangeByName('cfg_SKUs').getValues()
      .map(function (r) { return String(r[0]).trim(); }),
  };
}

function registrar_(ss, evento, detalle) {
  ss.getSheetByName(HOJA_LOG).appendRow([new Date(), evento, detalle]);
}

function aNumero_(x) {
  if (typeof x === 'number') return x;
  const n = parseFloat(String(x).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function soloFecha_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function hora_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'HH:mm');
}

/** Borra las marcas de alerta de hace más de 30 días (evita llenar PropertiesService). */
function limpiarMarcasAntiguas_() {
  const props = PropertiesService.getScriptProperties();
  const limite = Utilities.formatDate(new Date(Date.now() - 30 * 864e5), Session.getScriptTimeZone(), 'yyyyMMdd');
  props.getKeys().forEach(function (k) {
    const m = /^alerta_\w+_(\d{8})$/.exec(k);
    if (m && m[1] < limite) props.deleteProperty(k);
  });
}

function claveAlerta_(tipo, fecha) {
  return 'alerta_' + tipo + '_' + Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyyMMdd');
}
