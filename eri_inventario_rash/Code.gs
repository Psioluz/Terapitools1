// ============================================================
// ERI INVENTARIO CÍCLICO RASH - Web App Backend
// Google Apps Script - Code.gs
// ============================================================
// REQUISITO: Habilitar servicio avanzado "Drive API" v2
// ============================================================

var CONFIG = {
  LAYOUT_SHEET_ID:    '1ZrP_3Rf389hXETNi4PEqRK5ZpczjABWvxgxhkCg4jVw',
  HISTORICO_SHEET_ID: '1lB24NaKdwRKSuuLpEuF5hytvLG4JZT3_G3t62uOzU2s',
  STOCK_FOLDER_ID:    '1WLreNn7FUPcg9Dwca6VG4HlT_Wan_GfH',
  HISTORICO_TAB:      'Data de validación Diaria',
  ATTR2_VALIDOS:      ['DISPONIBLE', 'MAQUILA', 'OBSERVADOS'],
  EXCLUIR_LOC_PREFIX: 'PE4',
  PROCESO_DEFAULT:    'RASH',
  SUPERVISOR_DEFAULT: 'EXAVIER MEJIA',
  ESQUEMA_KEYWORD:    'esquema',
  ROWS_PER_PAGE:      17,    // Filas de datos por página (rows 17-33 del Esquema)
  DATA_START_ROW:     17,
  // Ubicaciones que empiezan con letra pero NO son línea de picking (LPR).
  // Si una ubicación (no registrada en el maestro Layout Rash) empieza con
  // cualquiera de estos prefijos, se clasifica como ALMACEN ALM en vez de
  // LINEA LPR. Ej: BALANZA, RAMPA, PCENTRAL, PAS101...PAS122 (pasillos).
  ESPECIALES_ALM_PREFIJOS: ['BALANZA', 'RAMPA', 'PCENTRAL', 'PAS']
};

// ───────────────────────────────────────────────────────────
// ENTRY POINT
// ───────────────────────────────────────────────────────────
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ERI Inventario Cíclico RASH')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ───────────────────────────────────────────────────────────
// PRIVATE → ¿Esta ubicación es una de las "especiales" que debe
//           tratarse como ALMACEN ALM aunque empiece con letra?
//           (báscula, rampa de descarga, pasillos PAS1xx, área central...)
// ───────────────────────────────────────────────────────────
function esUbicacionEspecialAlm_(loc) {
  var up = String(loc || '').trim().toUpperCase();
  return CONFIG.ESPECIALES_ALM_PREFIJOS.some(function(p) {
    return up.indexOf(p) === 0;
  });
}

// ───────────────────────────────────────────────────────────
// PUBLIC → Preparar plantilla (convierte Esquema una sola vez)
// ───────────────────────────────────────────────────────────
function prepararPlantilla() {
  try {
    PropertiesService.getScriptProperties().deleteProperty('ESQUEMA_SHEET_ID');
    var r = getEsquemaSheetId_();
    if (!r.ok) return r;
    return { ok: true, message: 'Plantilla lista. Generaciones futuras serán más rápidas.' };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ───────────────────────────────────────────────────────────
// PUBLIC → Opciones de filtros al cargar la página
// ───────────────────────────────────────────────────────────
function getFilterOptions() {
  try {
    var maestro   = getMaestroUbicaciones_();
    var historico = getHistoricoMes_();
    var lprAreas  = {}, almRacks = {};
    maestro.forEach(function(u) {
      if (u.tipo === 'LINEA LPR') {
        var p = String(u.ubicacion).substring(0,2).toUpperCase();
        lprAreas[p] = (lprAreas[p]||0)+1;
      } else if (u.tipo === 'ALMACEN ALM') {
        var r = String(u.rack); almRacks[r] = (almRacks[r]||0)+1;
      }
    });
    var maxV = 1;
    Object.keys(historico).forEach(function(k){ if(historico[k]>maxV) maxV=historico[k]; });
    return {
      ok: true,
      lprAreas: Object.keys(lprAreas).sort().map(function(p){ return {prefix:p,totalUbic:lprAreas[p]}; }),
      almRacks:  Object.keys(almRacks).sort(function(a,b){return Number(a)-Number(b);})
                        .map(function(r){ return {rack:r,totalUbic:almRacks[r]}; }),
      maxVueltas: maxV,
      mes: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM yyyy')
    };
  } catch(e) { return {ok:false,error:e.message}; }
}

// ─────────────────────────────────────────────────────────────
// PUBLIC → Lee el stock y extrae prefijos/racks reales dinámicos
//   LPR: primeras 2 letras  (RA, RB, SR, UR, RM, etc.)
//   ALM: primeros 3 dígitos (301, 302, 303, etc.) o ubicaciones
//        especiales (BALANZA, RAMPA, PCENTRAL, PAS101...PAS122)
// ─────────────────────────────────────────────────────────────
function getOpcionesDesdeStock() {
  try {
    var stock = getStockSnapshot_();
    if (!stock.ok) return stock;

    var lprLocs = {};   // prefix -> { ubicaciones únicas }
    var almLocs = {};   // rack   -> { ubicaciones únicas }

    Object.keys(stock.stockMap).forEach(function(key) {
      var loc = stock.stockMap[key].location;
      if (!loc) return;
      var esDigito = (loc.charAt(0) >= '0' && loc.charAt(0) <= '9');
      if (esDigito || esUbicacionEspecialAlm_(loc)) {
        // ALM: primeros 3 caracteres (numéricos o de la ubicación especial)
        var rack = loc.substring(0, 3).toUpperCase();
        if (!almLocs[rack]) almLocs[rack] = {};
        almLocs[rack][loc] = true;
      } else {
        // LPR: primeras 2 letras
        var prefix = loc.substring(0, 2).toUpperCase();
        if (!lprLocs[prefix]) lprLocs[prefix] = {};
        lprLocs[prefix][loc] = true;
      }
    });

    return {
      ok:          true,
      lprPrefixes: Object.keys(lprLocs).sort().map(function(p) {
        return { prefix: p, totalUbic: Object.keys(lprLocs[p]).length };
      }),
      almRacks: Object.keys(almLocs)
        .sort(function(a,b){ return Number(a)-Number(b)||a.localeCompare(b); })
        .map(function(r){ return { rack: r, totalUbic: Object.keys(almLocs[r]).length }; }),
      fileName:  stock.fileName,
      fileDate:  stock.fileDate,
      fromCache: stock.fromCache   // indica si la lectura fue desde caché
    };
  } catch(e){ return {ok:false, error:e.message}; }
}

// ─────────────────────────────────────────────────────────────
// PUBLIC → Resumen de ubicaciones pendientes
// ───────────────────────────────────────────────────────────
function getResumenPendientes(tipoUbic, filtro, numVuelta) {
  try {
    var cons = buildConsolidado_(tipoUbic, filtro, parseInt(numVuelta,10));
    if (!cons.ok) return cons;
    var ubics = {};
    cons.data.forEach(function(r){ ubics[r.ubicacion]=true; });
    return {
      ok: true,
      ubicsPendientes:  Object.keys(ubics).length,
      lineasPendientes: cons.data.length,
      fileName: cons.fileName,
      fileDate: cons.fileDate
    };
  } catch(e) { return {ok:false,error:e.message}; }
}

// ───────────────────────────────────────────────────────────
// PUBLIC → Generar ficha ERI
//
// Devuelve:
//   pdfUrl   → URL de exportación PDF del Google Sheet formateado
//              (imprime con el formato exacto del Esquema, logo incluido)
//   xlsxUrl  → URL de exportación XLSX de una hoja plana con todas
//              las filas (una sola hoja, para llenado de validaciones)
// ───────────────────────────────────────────────────────────
function generarFichaERI(params) {
  try {
    var offset    = parseInt(params.offset,    10) || 0;
    var numLineas = parseInt(params.numLineas, 10) || 50;
    var numVuelta = parseInt(params.numVuelta, 10) || 1;

    // 1. Obtener datos pendientes
    var cons = buildConsolidado_(params.tipoUbic, params.filtro, numVuelta);
    if (!cons.ok) return cons;
    var allRows = cons.data;
    if (offset >= allRows.length)
      return { ok:false, error:'No quedan ubicaciones pendientes. ¡Todas asignadas!' };

    var fichaRows  = allRows.slice(offset, offset + numLineas);

    // FIX: completar la última ubicación para no dejarla a mitad
    // Si la última fila corta una ubicación, incluir todas sus líneas restantes
    while (fichaRows.length > 0 &&
           offset + fichaRows.length < allRows.length &&
           allRows[offset + fichaRows.length].ubicacion === fichaRows[fichaRows.length-1].ubicacion) {
      fichaRows.push(allRows[offset + fichaRows.length]);
    }

    var nextOffset = offset + fichaRows.length;
    var hasMore    = nextOffset < allRows.length;

    // 2. Crear libro formateado (copia del Esquema, para PDF)
    var tz     = Session.getScriptTimeZone();
    var today  = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy');
    var sufijo = (params.filtro||'ALL') + '_V' + numVuelta + '_' +
                 (params.colaborador||'COLAB').replace(/\s+/g,'_') + '_' +
                 Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss');

    var printSS = crearLibroFormateado_(fichaRows, params, today, sufijo);
    if (!printSS.ok) return printSS;

    // 3. Crear libro plano de una hoja (para descarga XLSX de llenado)
    var flatSS = crearLibroPlano_(fichaRows, params, today, sufijo, offset);
    if (!flatSS.ok) return flatSS;

    // URL PDF: exporta el libro formateado como PDF con los ajustes del Esquema
    // (landscape, A4, sin márgenes, sin cuadrículas, sin títulos)
    var pdfUrl = 'https://docs.google.com/spreadsheets/d/' + printSS.id +
      '/export?format=pdf' +
      '&size=A4' +
      '&portrait=false' +          // landscape
      '&fitw=true' +               // ajustar al ancho
      '&scale=4' +               // Fit to Page: escala cada hoja a 1 sola página PDF
      '&gridlines=false' +
      '&printtitle=false' +
      '&sheetnames=false' +
      '&top_margin=0.25' +
      '&bottom_margin=0.25' +
      '&left_margin=0.40' +
      '&right_margin=0.40';

    // URL XLSX: descarga el libro plano como Excel
    var xlsxUrl = 'https://docs.google.com/spreadsheets/d/' + flatSS.id +
      '/export?format=xlsx&id=' + flatSS.id;

    return {
      ok:              true,
      pdfUrl:          pdfUrl,
      xlsxUrl:         xlsxUrl,
      printSsUrl:      'https://docs.google.com/spreadsheets/d/' + printSS.id,
      totalLineas:     fichaRows.length,
      totalPaginas:    printSS.numPages,
      nextOffset:      nextOffset,
      hasMore:         hasMore,
      totalPendientes: allRows.length,
      stockFile:       cons.fileName,
      stockDate:       cons.fileDate
    };
  } catch(e) { return {ok:false,error:e.message}; }
}

// ───────────────────────────────────────────────────────────
// PUBLIC → Cargar ficha completada al histórico
// ───────────────────────────────────────────────────────────
function cargarFichaCompletada(fileDataBase64, fileName) {
  try {
    var blob = Utilities.newBlob(
      Utilities.base64Decode(fileDataBase64),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName);
    var tmpFile = Drive.Files.insert(
      {title:'TEMP_CARGA_'+Date.now(), mimeType:'application/vnd.google-apps.spreadsheet'},
      blob, {convert:true});
    try {
      var tmpSS = SpreadsheetApp.openById(tmpFile.id);
      var rows  = [], today = new Date();
      tmpSS.getSheets().forEach(function(ws) {
        var raw = ws.getDataRange().getValues(), hdr = -1;
        for (var i=0; i<Math.min(25,raw.length); i++) {
          var c0=String(raw[i][0]).trim().toUpperCase(), c1=String(raw[i][1]).trim().toUpperCase();
          if (c0==='N°'||c1==='LOCACIÓN'||c1==='LOCACION') { hdr=i; break; }
        }
        if (hdr===-1) return;
        for (var i=hdr+1; i<raw.length; i++) {
          var row=raw[i], loc=String(row[1]||'').trim();
          if (!loc||loc.toUpperCase()==='TOTAL') continue;
          if (typeof row[0]==='string' && String(row[0]).length>10) break;
          var l1=row[4]!==''&&row[4]!==null?Number(row[4]):null;
          var f1=row[5]!==''&&row[5]!==null?Number(row[5]):null;
          var l2=row[8]!==''&&row[8]!==null?Number(row[8]):null;
          var f2=row[9]!==''&&row[9]!==null?Number(row[9]):null;
          rows.push([today,loc,String(row[2]||'').trim(),String(row[3]||'').trim(),
            l1,f1,(f1!==null&&l1!==null?f1-l1:null),String(row[7]||'').trim(),
            l2,f2,(f2!==null&&l2!==null?f2-l2:null),String(row[11]||'').trim()]);
        }
      });
      if (rows.length===0) return {ok:false,error:'No se encontraron filas de datos.'};
      var histSS = SpreadsheetApp.openById(CONFIG.HISTORICO_SHEET_ID);
      var histWS = histSS.getSheetByName(CONFIG.HISTORICO_TAB)||histSS.getSheets()[0];
      histWS.getRange(histWS.getLastRow()+1,1,rows.length,12).setValues(rows);
      return {ok:true,rowsCargadas:rows.length,
              fecha:Utilities.formatDate(today,Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm')};
    } finally { Drive.Files.remove(tmpFile.id); }
  } catch(e) { return {ok:false,error:e.message}; }
}

// ───────────────────────────────────────────────────────────
// PRIVATE → Crear libro formateado (copia del Esquema × páginas)
//           → Se exportará como PDF conservando logo, instrucciones, etc.
// ───────────────────────────────────────────────────────────
function crearLibroFormateado_(fichaRows, params, today, sufijo) {
  try {
    var esquema = getEsquemaSheetId_();
    if (!esquema.ok) return esquema;

    var templateSS    = SpreadsheetApp.openById(esquema.id);
    var templateSheet = templateSS.getSheets()[0];

    var ss           = SpreadsheetApp.create('ERI_PRINT_' + sufijo);
    var defaultSheet = ss.getActiveSheet();
    var numPages     = Math.ceil(fichaRows.length / CONFIG.ROWS_PER_PAGE);

    for (var p = 0; p < numPages; p++) {
      var ws = templateSheet.copyTo(ss);
      ws.setName('Pág ' + (p+1));
      ws.setTabColor(p===0 ? '#1F3864' : '#39C8BB');

      // FIX: eliminar filas más allá del área de impresión (A1:L54)
      // El template tiene 1621 filas vacías que generan páginas en blanco en el PDF
      var maxR = ws.getMaxRows();
      if (maxR > 54) { ws.deleteRows(55, maxR - 54); }

      var slice      = fichaRows.slice(p*CONFIG.ROWS_PER_PAGE, (p+1)*CONFIG.ROWS_PER_PAGE);
      var pageOffset = (parseInt(params.offset,10)||0) + p*CONFIG.ROWS_PER_PAGE;
      llenarCabecera_(ws, params, today, p+1, numPages);
      llenarFilasDatos_(ws, slice, pageOffset);
    }
    ss.deleteSheet(defaultSheet);
    return { ok: true, id: ss.getId(), numPages: numPages };
  } catch(e) { return {ok:false,error:'Error creando libro formateado: '+e.message}; }
}

// ───────────────────────────────────────────────────────────
// PRIVATE → Crear libro plano de una sola hoja (para llenado XLSX)
//           → Sin formato del Esquema, solo los datos en una tabla
// ───────────────────────────────────────────────────────────
function crearLibroPlano_(fichaRows, params, today, sufijo, globalOffset) {
  try {
    var ss = SpreadsheetApp.create('ERI_LLENADO_' + sufijo);
    var ws = ss.getActiveSheet();
    ws.setName('Llenado');

    // Cabecera informativa
    ws.getRange(1,1).setValue('FICHA ERI - LLENADO DE VALIDACIONES');
    ws.getRange(1,1,1,12).merge().setFontWeight('bold').setBackground('#1F3864').setFontColor('#FFFFFF').setFontSize(11);
    ws.getRange(2,1).setValue('Colaborador: ' + (params.colaborador||''));
    ws.getRange(2,4).setValue('Fecha: ' + today);
    ws.getRange(2,7).setValue('Tipo: ' + (params.tipoUbic==='LPR'?'LINEA LPR':'ALMACEN ALM') +
                              ' · ' + (params.filtro||'') + ' · Vuelta ' + (params.numVuelta||1));
    ws.getRange(2,1,1,12).setBackground('#F0F4F8').setFontSize(10);

    // Encabezados de columna
    var hdrs = [['N°','LOCACIÓN','CÓDIGO','DESCRIPCIÓN',
                 'LÓGICO C1','FÍSICO C1','DIF C1','COMENTARIO C1',
                 'LÓGICO C2','FÍSICO C2','DIF C2','COMENTARIO C2']];
    ws.getRange(3,1,1,12).setValues(hdrs)
      .setFontWeight('bold').setBackground('#1F3864').setFontColor('#FFFFFF').setHorizontalAlignment('center');

    // Datos — UNA SOLA HOJA CON TODAS LAS FILAS
    var data = fichaRows.map(function(r,i){
      return [globalOffset+i+1, r.ubicacion, r.item, r.desc,
              r.logico||0, '', '', '',
              r.logico||0, '', '', ''];
    });
    if (data.length > 0) {
      ws.getRange(4,1,data.length,12).setValues(data);
      // Fórmulas DIF
      for (var i=0; i<data.length; i++) {
        var rn=4+i;
        ws.getRange(rn,7).setFormula('=IF(F'+rn+'="","",F'+rn+'-E'+rn+')');
        ws.getRange(rn,11).setFormula('=IF(J'+rn+'="","",J'+rn+'-I'+rn+')');
        ws.getRange(rn,3).setNumberFormat('@');
        ws.getRange(rn,1,1,12).setBackground(i%2===0?'#FFFFFF':'#F5F8FF');
      }
      ws.getRange(4,1,data.length,12)
        .setBorder(true,true,true,true,true,true,'#CCCCCC',SpreadsheetApp.BorderStyle.SOLID);
      // Anchos
      var colW=[38,90,105,300,65,65,55,140,65,65,55,140];
      for(var c=0;c<colW.length;c++) ws.setColumnWidth(c+1,colW[c]);
      ws.setFrozenRows(3);
      // Fila total
      var tot = 4+data.length;
      ws.getRange(tot,1).setValue('TOTAL');
      ws.getRange(tot,5).setFormula('=SUM(E4:E'+(tot-1)+')');
      ws.getRange(tot,6).setFormula('=SUM(F4:F'+(tot-1)+')');
      ws.getRange(tot,9).setFormula('=SUM(I4:I'+(tot-1)+')');
      ws.getRange(tot,10).setFormula('=SUM(J4:J'+(tot-1)+')');
      ws.getRange(tot,1,1,12).setFontWeight('bold').setBackground('#E7DB0E');
    }
    return { ok: true, id: ss.getId() };
  } catch(e) { return {ok:false,error:'Error creando libro de llenado: '+e.message}; }
}

// ───────────────────────────────────────────────────────────
// PRIVATE → Llenar cabecera del Esquema (campos estándar)
// ───────────────────────────────────────────────────────────
function llenarCabecera_(ws, params, today, pageNum, totalPages) {
  ws.getRange('C8').setValue(params.proceso  || CONFIG.PROCESO_DEFAULT);
  ws.getRange('C9').setValue(today);
  ws.getRange('C10').setValue(params.supervisor || CONFIG.SUPERVISOR_DEFAULT);
  ws.getRange('I8').setValue(params.colaborador || '');
  // Celdas libres del esquema (merges J5:L5 y K6:L6)
  ws.getRange('J5').setValue(
    (params.tipoUbic==='LPR'?'LINEA LPR':'ALMACEN ALM') +
    ' · ' + (params.filtro||'') + ' · Vuelta ' + (params.numVuelta||1)
  );
  ws.getRange('K6').setValue('Pág ' + pageNum + ' / ' + totalPages);
}

// ───────────────────────────────────────────────────────────
// PRIVATE → Llenar filas de datos (rows 17-33 del Esquema)
// ───────────────────────────────────────────────────────────
function llenarFilasDatos_(ws, rows, globalOffset) {
  var DS = CONFIG.DATA_START_ROW, RP = CONFIG.ROWS_PER_PAGE;
  // FIX: limpiar toda el área de datos primero para eliminar fórmulas residuales
  // del template que causan #ERROR! en columna DIF
  ws.getRange(DS, 1, RP, 12).clearContent();

  for (var i=0; i<RP; i++) {
    var r = DS+i;
    if (i < rows.length) {
      var d = rows[i];
      ws.getRange(r,1).setValue(globalOffset+i+1);
      ws.getRange(r,2).setValue(d.ubicacion||'');
      ws.getRange(r,3).setNumberFormat('@').setValue(d.item||'');
      ws.getRange(r,4).setValue(d.desc||'');
      ws.getRange(r,5).setValue(d.logico!==undefined?d.logico:0);
      // DIF queda en blanco — el inventariador calcula al contar físicamente
      ws.getRange(r,9).setValue(d.logico!==undefined?d.logico:0);
    }
    // Filas sin datos: ya quedan vacías del clearContent inicial
  }
}

// ───────────────────────────────────────────────────────────
// PRIVATE → Obtener ID del Esquema como Google Sheet (cacheado)
// ───────────────────────────────────────────────────────────
function getEsquemaSheetId_() {
  var props    = PropertiesService.getScriptProperties();
  var storedId = props.getProperty('ESQUEMA_SHEET_ID');

  if (storedId) {
    try {
      var f = DriveApp.getFileById(storedId);
      if (f.getMimeType()==='application/vnd.google-apps.spreadsheet')
        return {ok:true, id:storedId};
    } catch(e) { props.deleteProperty('ESQUEMA_SHEET_ID'); }
  }

  // Buscar en la carpeta
  var folder = DriveApp.getFolderById(CONFIG.STOCK_FOLDER_ID);
  var files  = folder.getFiles();
  while (files.hasNext()) {
    var f    = files.next();
    var name = f.getName().toLowerCase();
    if (name.indexOf(CONFIG.ESQUEMA_KEYWORD)===-1) continue;

    if (f.getMimeType()==='application/vnd.google-apps.spreadsheet') {
      props.setProperty('ESQUEMA_SHEET_ID', f.getId());
      return {ok:true, id:f.getId()};
    }
    // Convertir XLSX → Google Sheets (solo la primera vez)
    var converted = Drive.Files.insert(
      {title:'ERI_Esquema_Template', mimeType:'application/vnd.google-apps.spreadsheet'},
      f.getBlob(), {convert:true});
    props.setProperty('ESQUEMA_SHEET_ID', converted.id);
    return {ok:true, id:converted.id};
  }
  return {ok:false, error:'No se encontró el Esquema_ERI en la carpeta de stock.'};
}

// ───────────────────────────────────────────────────────────
// PRIVATE → Maestro de ubicaciones
// ───────────────────────────────────────────────────────────
function getMaestroUbicaciones_() {
  var data = SpreadsheetApp.openById(CONFIG.LAYOUT_SHEET_ID)
                            .getSheets()[0].getDataRange().getValues();
  var result = [];
  for (var i=1; i<data.length; i++) {
    var r=data[i]; if(!r[0]) continue;
    result.push({ubicacion:String(r[0]).trim(), rack:String(r[1]||'').trim(),
                 tipo:String(r[2]||'').trim()});
  }
  return result;
}

// ───────────────────────────────────────────────────────────
// PRIVATE → Historial vueltas mes actual
// ───────────────────────────────────────────────────────────
function getHistoricoMes_() {
  var ss   = SpreadsheetApp.openById(CONFIG.HISTORICO_SHEET_ID);
  var ws   = ss.getSheetByName(CONFIG.HISTORICO_TAB)||ss.getSheets()[0];
  var data = ws.getDataRange().getValues();
  var now  = new Date(), cm=now.getMonth(), cy=now.getFullYear();
  var tz   = Session.getScriptTimeZone(), start=1;
  for (var i=0;i<Math.min(5,data.length);i++) {
    if (String(data[i][0]).toLowerCase().indexOf('fecha')!==-1){start=i+1;break;}
  }
  var ubDates={};
  for (var i=start;i<data.length;i++) {
    var r=data[i]; if(!r[0]||!r[1]) continue;
    var f=(r[0] instanceof Date)?r[0]:new Date(r[0]);
    if(isNaN(f.getTime())||f.getMonth()!==cm||f.getFullYear()!==cy) continue;
    var u=String(r[1]).trim(), ds=Utilities.formatDate(f,tz,'yyyy-MM-dd');
    if(!ubDates[u]) ubDates[u]={};
    ubDates[u][ds]=true;
  }
  var result={};
  Object.keys(ubDates).forEach(function(u){result[u]=Object.keys(ubDates[u]).length;});
  return result;
}

// ───────────────────────────────────────────────────────────
// PRIVATE → Stock snapshot diario (excluye el Esquema)
// ───────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// PUBLIC → Limpiar cache de stock (llamar si el stock fue reemplazado manualmente)
// ─────────────────────────────────────────────────────────────
function limpiarCacheStock() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('STOCK_SHEET_ID');
  if (id) { try { Drive.Files.remove(id); } catch(e){} }
  props.deleteProperty('STOCK_FILE_DATE');
  props.deleteProperty('STOCK_SHEET_ID');
  return { ok: true, message: 'Cache de stock eliminado. Próxima lectura reconvertirá el archivo.' };
}

function getStockSnapshot_() {
  // ── 1. Encontrar el archivo de stock más reciente (excluir esquema) ──
  var folder = DriveApp.getFolderById(CONFIG.STOCK_FOLDER_ID);
  var files  = folder.getFiles();
  var latest = null, latestDate = new Date(0);
  while (files.hasNext()) {
    var f = files.next(), name = f.getName().toLowerCase();
    if (name.indexOf(CONFIG.ESQUEMA_KEYWORD) !== -1) continue;
    var mime = f.getMimeType();
    var valid = (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                 mime === 'application/vnd.ms-excel' ||
                 mime === 'application/vnd.google-apps.spreadsheet');
    if (valid && f.getLastUpdated() > latestDate) { latestDate = f.getLastUpdated(); latest = f; }
  }
  if (!latest) return { ok:false, error:'No se encontró archivo de stock en la carpeta.' };

  // ── 2. Cache por fecha de modificación del archivo ──
  // Si el archivo no cambió, usar el Google Sheet ya convertido (mucho más rápido)
  var props       = PropertiesService.getScriptProperties();
  var cachedDate  = props.getProperty('STOCK_FILE_DATE');
  var cachedId    = props.getProperty('STOCK_SHEET_ID');
  var fileDate    = latestDate.getTime().toString();
  var tz          = Session.getScriptTimeZone();
  var rawData;

  if (cachedDate === fileDate && cachedId) {
    // Mismo archivo que la última vez — leer desde el Sheet cacheado (rápido: ~3 seg)
    try {
      rawData = SpreadsheetApp.openById(cachedId).getSheets()[0].getDataRange().getValues();
    } catch(e) {
      // Sheet cacheado fue eliminado — limpiar y reconvertir
      props.deleteProperty('STOCK_FILE_DATE');
      props.deleteProperty('STOCK_SHEET_ID');
      cachedId = null;
    }
  }

  if (!rawData) {
    // Archivo nuevo o cache inválido — convertir y guardar el ID para próximas llamadas
    if (latest.getMimeType() === 'application/vnd.google-apps.spreadsheet') {
      // Ya es un Google Sheet — leer directamente
      rawData = SpreadsheetApp.openById(latest.getId()).getSheets()[0].getDataRange().getValues();
      props.setProperty('STOCK_FILE_DATE', fileDate);
      props.setProperty('STOCK_SHEET_ID',  latest.getId());
    } else {
      // XLSX → convertir a Google Sheets y CONSERVAR (no eliminar) para reutilizar
      // Primero eliminar el Sheet cacheado anterior si existe
      if (cachedId) { try { Drive.Files.remove(cachedId); } catch(e){} }
      var converted = Drive.Files.insert(
        { title: 'STOCK_CACHE_ERI', mimeType: 'application/vnd.google-apps.spreadsheet' },
        latest.getBlob(), { convert: true }
      );
      rawData = SpreadsheetApp.openById(converted.id).getSheets()[0].getDataRange().getValues();
      props.setProperty('STOCK_FILE_DATE', fileDate);
      props.setProperty('STOCK_SHEET_ID',  converted.id);
    }
  }

  // ── 3. Parsear datos ──
  var hdrs = rawData[0].map(function(h){ return String(h).trim(); });
  var iL = hdrs.indexOf('Location'),          iI = hdrs.indexOf('Display Item Number'),
      iD = hdrs.indexOf('Description'),       iQ = hdrs.indexOf('Actual qty'),
      iA = hdrs.indexOf('Attribute 2');
  if (iL===-1||iI===-1||iQ===-1)
    return { ok:false, error:'Columnas no encontradas en archivo de stock.' };

  var map = {};
  for (var i = 1; i < rawData.length; i++) {
    var r   = rawData[i];
    var loc = String(r[iL]||'').trim();
    if (!loc) continue;
    if (loc.toUpperCase().startsWith(CONFIG.EXCLUIR_LOC_PREFIX)) continue;
    var a2 = iA >= 0 ? String(r[iA]||'').trim().toUpperCase() : 'DISPONIBLE';
    if (iA >= 0 && CONFIG.ATTR2_VALIDOS.indexOf(a2) === -1) continue;
    var item = String(r[iI]||'').trim(), desc = String(r[iD]||'').trim(), qty = Number(r[iQ])||0;
    if (qty <= 0) continue;
    var k = loc+'|'+item;
    if (!map[k]) map[k] = { location:loc, item:item, desc:desc, qty:qty };
    else          map[k].qty += qty;
  }

  return {
    ok:        true,
    stockMap:  map,
    fileName:  latest.getName(),
    fileDate:  Utilities.formatDate(latestDate, tz, 'dd/MM/yyyy HH:mm'),
    fromCache: (cachedDate === fileDate)  // true si vino del caché
  };
}

// ───────────────────────────────────────────────────────────
// PRIVATE → Consolidado de ubicaciones pendientes
// ───────────────────────────────────────────────────────────
function buildConsolidado_(tipoUbic, filtro, numVuelta) {
  var maestro=getMaestroUbicaciones_(),hist=getHistoricoMes_(),stock=getStockSnapshot_();
  if(!stock.ok) return stock;
  var smap = stock.stockMap;

  // Índice maestro para lookup rápido (tipo y rack oficiales)
  var maestroIdx = {};
  maestro.forEach(function(u){ maestroIdx[u.ubicacion] = u; });

  // Deduce tipo/rack cuando la ubicación no está en el maestro.
  // Orden de reglas:
  //   1. Si está en el maestro, se respeta su Tipo tal cual está en Layout Rash.
  //   2. Si es una ubicación "especial" (BALANZA, RAMPA, PCENTRAL, PAS1xx), es ALMACEN ALM
  //      aunque su código empiece con letra — NO es línea de picking.
  //   3. Si empieza con dígito, es ALMACEN ALM.
  //   4. En cualquier otro caso, es LINEA LPR.
  function deducirTipo(loc) {
    if (maestroIdx[loc]) return maestroIdx[loc].tipo;
    if (esUbicacionEspecialAlm_(loc)) return 'ALMACEN ALM';
    return (loc.charAt(0) >= '0' && loc.charAt(0) <= '9') ? 'ALMACEN ALM' : 'LINEA LPR';
  }
  function deducirRack(loc) {
    return maestroIdx[loc] ? (maestroIdx[loc].rack || loc.substring(0,3)) : loc.substring(0,3).toUpperCase();
  }

  // Filtro tipo + prefijo/rack — funciona para cualquier ubicación del stock
  function matchFiltro(loc) {
    var tipo = deducirTipo(loc);
    if (tipoUbic === 'LPR') {
      if (tipo !== 'LINEA LPR') return false;
      return filtro ? loc.toUpperCase().startsWith(filtro.toUpperCase()) : true;
    } else {
      if (tipo !== 'ALMACEN ALM') return false;
      return filtro ? loc.substring(0,3).toUpperCase() === String(filtro).toUpperCase() : true;
    }
  }

  // ubicMap desde STOCK (incluye ubicaciones no registradas en maestro)
  var ubicMap = {};
  Object.keys(smap).forEach(function(k) {
    var s = smap[k];
    if (!matchFiltro(s.location)) return;
    if (!ubicMap[s.location]) {
      ubicMap[s.location] = {
        meta: { tipo: deducirTipo(s.location), rack: deducirRack(s.location), ubicacion: s.location },
        items: []
      };
    }
    ubicMap[s.location].items.push({ item: s.item, desc: s.desc, qty: s.qty });
  });

  // Agregar ubicaciones del maestro que pasaron el filtro pero no tienen stock (VACÍAS)
  maestro.forEach(function(u) {
    if (!matchFiltro(u.ubicacion)) return;
    if (!ubicMap[u.ubicacion]) ubicMap[u.ubicacion] = { meta: u, items: [] };
  });
  var vt=numVuelta||1,result=[];
  Object.keys(ubicMap).sort().forEach(function(ubic){
    var v=hist[ubic]||0; if(v>=vt) return;
    var e=ubicMap[ubic];
    if(e.items.length===0){
      result.push({ubicacion:ubic,rack:e.meta.rack,tipo:e.meta.tipo,
                   item:'',desc:'',logico:0,estado:'VACÍA',vueltas:v});
    } else {
      e.items.forEach(function(it){
        result.push({ubicacion:ubic,rack:e.meta.rack,tipo:e.meta.tipo,
                     item:it.item,desc:it.desc,logico:it.qty,estado:'CON STOCK',vueltas:v});
      });
    }
  });
  return {ok:true,data:result,fileName:stock.fileName,fileDate:stock.fileDate};
}
