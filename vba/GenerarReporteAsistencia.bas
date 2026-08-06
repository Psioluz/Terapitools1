Attribute VB_Name = "modReporteAsistencia"
Option Explicit

' ============================================================
' GENERADOR DE REPORTE DE ASISTENCIA
'
' Optimizacion clave respecto a la version original:
' en vez de recorrer TODA la hoja DATOS por cada combinacion
' (colaborador x dia), se recorre DATOS una sola vez y se
' construyen dos Dictionaries (P10 minimo y P20 maximo, por
' clave CODIGO|FECHA). Esto reduce la complejidad de
' O(colaboradores x dias x filasDatos) a O(filasDatos +
' colaboradores x dias).
' ============================================================

' ---- Columnas hoja DATOS ----
Private Const COL_DATOS_CODIGO As Long = 4
Private Const COL_DATOS_FECHA As Long = 7
Private Const COL_DATOS_HORA As Long = 9
Private Const COL_DATOS_MARCA As Long = 12

' ---- Columnas hoja HORARIOS ----
Private Const COL_HOR_CODIGO As Long = 1
Private Const COL_HOR_NOMBRE As Long = 2
Private Const COL_HOR_TIPO_BASE As Long = 3
Private Const COL_HOR_ENT_LV As Long = 4
Private Const COL_HOR_SAL_LV As Long = 5
Private Const COL_HOR_ENT_SAB As Long = 6
Private Const COL_HOR_SAL_SAB As Long = 7
Private Const COL_HOR_FECHA_CAMBIO As Long = 8
Private Const COL_HOR_TIPO_NUEVO As Long = 9
Private Const COL_HOR_ENT_NUEVO As Long = 10
Private Const COL_HOR_SAL_NUEVO As Long = 11

Private Const UMBRAL_DESVIO_MIN As Long = 30

' ====== FUNCION PRINCIPAL ======
Public Sub GenerarReporteAsistencia_Seguro()

    Dim wb As Workbook
    Dim wsDatos As Worksheet, wsHor As Worksheet, wsRep As Worksheet
    Dim ultFilaDatos As Long, ultFilaHor As Long
    Dim minFecha As Date, maxFecha As Date, tieneFecha As Boolean
    Dim fila As Long, filaHor As Long
    Dim f As Date
    Dim cod As String, nom As String
    Dim entradaProg As Variant, salidaProg As Variant
    Dim primeraP10 As Variant, ultimaP20 As Variant
    Dim desvioP10 As Long, desvioP20 As Long
    Dim estadoDia As String
    Dim filaRep As Long

    Dim eventoEntrada As String
    Dim eventoSalida As String
    Dim observacion As String
    Dim esNocturno As Boolean

    Dim dictP10Min As Object   ' Scripting.Dictionary: clave -> primer P10
    Dim dictP20Max As Object   ' Scripting.Dictionary: clave -> ultimo P20

    On Error GoTo ErrHandler
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Set wb = ActiveWorkbook

    ' ==== Validar hojas ====
    On Error Resume Next
    Set wsDatos = wb.Worksheets("DATOS")
    Set wsHor = wb.Worksheets("HORARIOS")
    Set wsRep = wb.Worksheets("REPORTE_FINAL")
    On Error GoTo ErrHandler

    If wsDatos Is Nothing Or wsHor Is Nothing Or wsRep Is Nothing Then
        MsgBox "Verifica que existan las hojas: DATOS, HORARIOS y REPORTE_FINAL.", vbCritical
        GoTo Salir
    End If

    ' ==== Ultimas filas ====
    ultFilaDatos = wsDatos.Cells(wsDatos.Rows.Count, "A").End(xlUp).Row
    ultFilaHor = wsHor.Cells(wsHor.Rows.Count, "A").End(xlUp).Row

    If ultFilaDatos < 2 Then
        MsgBox "La hoja DATOS no tiene registros.", vbExclamation
        GoTo Salir
    End If

    If ultFilaHor < 2 Then
        MsgBox "La hoja HORARIOS no tiene registros.", vbExclamation
        GoTo Salir
    End If

    ' ==== Rango de fechas + indices P10/P20 en una sola pasada por DATOS ====
    Set dictP10Min = CreateObject("Scripting.Dictionary")
    Set dictP20Max = CreateObject("Scripting.Dictionary")

    tieneFecha = False
    ConstruirIndicesDatos wsDatos, ultFilaDatos, dictP10Min, dictP20Max, _
                          minFecha, maxFecha, tieneFecha

    If Not tieneFecha Then
        MsgBox "No se encontraron fechas validas en la hoja DATOS.", vbExclamation
        GoTo Salir
    End If

    ' ==== Limpiar REPORTE_FINAL completo y poner cabecera ====
    wsRep.Cells.Clear
    wsRep.Range("A1:K1").Value = Array( _
        "CODIGO", "NOMBRE", "FECHA_JORNADA", _
        "ENTRADA_PROG", "SALIDA_PROG", _
        "MARCA_ENTRADA", "MARCA_SALIDA", _
        "EVENTO_ENTRADA", "EVENTO_SALIDA", _
        "OBSERVACION", "ESTADO")

    filaRep = 2

    ' ==== Recorrer HORARIOS (cada colaborador) ====
    For filaHor = 2 To ultFilaHor
        cod = Trim$(CStr(wsHor.Cells(filaHor, COL_HOR_CODIGO).Value))
        nom = Trim$(CStr(wsHor.Cells(filaHor, COL_HOR_NOMBRE).Value))

        If cod <> "" Then
            ' Recorrer cada fecha del rango
            For f = minFecha To maxFecha

                ' Verificar si ese dia es laborable para este colaborador
                If DiaEsLaborable_Fila(f, wsHor, filaHor) Then

                    ' Obtener horario programado
                    entradaProg = Empty
                    salidaProg = Empty
                    ObtenerHorarioProgramado_Fila f, wsHor, filaHor, entradaProg, salidaProg

                    If Not IsEmpty(entradaProg) And Not IsEmpty(salidaProg) Then

                        ' Detectar turno nocturno (sale al dia siguiente)
                        esNocturno = (CDate(salidaProg) <= CDate(entradaProg))

                        ' Buscar P10 y P20 usando los indices ya construidos
                        BuscarMarcasP10P20_Indexado cod, f, esNocturno, _
                                                     dictP10Min, dictP20Max, _
                                                     primeraP10, ultimaP20

                        ' Inicializar
                        estadoDia = ""
                        observacion = ""
                        eventoEntrada = ""
                        eventoSalida = ""
                        desvioP10 = 0
                        desvioP20 = 0

                        ' ===== Estado por faltas =====
                        If IsEmpty(primeraP10) And IsEmpty(ultimaP20) Then
                            estadoDia = "INASISTENCIA"
                        ElseIf IsEmpty(primeraP10) And Not IsEmpty(ultimaP20) Then
                            observacion = "FALTA MARCA DE ENTRADA"
                        ElseIf Not IsEmpty(primeraP10) And IsEmpty(ultimaP20) Then
                            observacion = "FALTA MARCA DE SALIDA"
                        End If

                        ' ===== Desvio entrada =====
                        If Not IsEmpty(primeraP10) Then
                            desvioP10 = Abs(DateDiff("n", CDate(entradaProg), CDate(primeraP10)))

                            If desvioP10 >= UMBRAL_DESVIO_MIN Then
                                If CDate(primeraP10) < CDate(entradaProg) Then
                                    eventoEntrada = "Sobretiempo entrada"
                                Else
                                    eventoEntrada = "Realizar evento entrada"
                                End If
                            End If
                        End If

                        ' ===== Desvio salida =====
                        If Not IsEmpty(ultimaP20) Then
                            desvioP20 = Abs(DateDiff("n", CDate(salidaProg), CDate(ultimaP20)))

                            If desvioP20 >= UMBRAL_DESVIO_MIN Then
                                If CDate(ultimaP20) < CDate(salidaProg) Then
                                    eventoSalida = "Realizar evento salida"
                                Else
                                    eventoSalida = "Sobretiempo salida"
                                End If
                            End If
                        End If

                        ' ===== Escribir una sola linea si hay algo que reportar =====
                        If eventoEntrada <> "" Or eventoSalida <> "" Or observacion <> "" Or estadoDia <> "" Then
                            With wsRep
                                .Cells(filaRep, 1).Value = cod
                                .Cells(filaRep, 2).Value = nom
                                .Cells(filaRep, 3).Value = f
                                .Cells(filaRep, 3).NumberFormat = "dd/mm/yyyy"
                                .Cells(filaRep, 4).Value = entradaProg
                                .Cells(filaRep, 4).NumberFormat = "hh:mm"
                                .Cells(filaRep, 5).Value = salidaProg
                                .Cells(filaRep, 5).NumberFormat = "hh:mm"

                                If Not IsEmpty(primeraP10) Then
                                    .Cells(filaRep, 6).Value = primeraP10
                                    .Cells(filaRep, 6).NumberFormat = "hh:mm"
                                End If

                                If Not IsEmpty(ultimaP20) Then
                                    .Cells(filaRep, 7).Value = ultimaP20
                                    .Cells(filaRep, 7).NumberFormat = "hh:mm"
                                End If

                                .Cells(filaRep, 8).Value = eventoEntrada
                                .Cells(filaRep, 9).Value = eventoSalida
                                .Cells(filaRep, 10).Value = observacion
                                .Cells(filaRep, 11).Value = estadoDia
                            End With

                            filaRep = filaRep + 1
                        End If

                    End If

                End If
            Next f
        End If
    Next filaHor

    wsRep.Columns.AutoFit
    MsgBox "Reporte generado en 'REPORTE_FINAL' (" & (filaRep - 2) & " incidencias).", vbInformation

Salir:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Exit Sub

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Error: " & Err.Number & " - " & Err.Description, vbCritical
End Sub

' ====== RECORRE DATOS UNA SOLA VEZ: RANGO DE FECHAS + INDICES P10/P20 ======
Private Sub ConstruirIndicesDatos(ByVal wsDatos As Worksheet, _
                                   ByVal ultFilaDatos As Long, _
                                   ByRef dictP10Min As Object, _
                                   ByRef dictP20Max As Object, _
                                   ByRef minFecha As Date, _
                                   ByRef maxFecha As Date, _
                                   ByRef tieneFecha As Boolean)
    Dim datos As Variant
    Dim fila As Long
    Dim cod As String, marca As String
    Dim fechaRow As Variant, horaRow As Variant
    Dim fechaVal As Date
    Dim clave As String

    ' Leer el rango completo de una sola vez (mucho mas rapido que Cells por fila)
    datos = wsDatos.Range(wsDatos.Cells(2, 1), _
                           wsDatos.Cells(ultFilaDatos, Application.WorksheetFunction.Max( _
                               COL_DATOS_CODIGO, COL_DATOS_FECHA, COL_DATOS_HORA, COL_DATOS_MARCA))).Value

    For fila = 1 To UBound(datos, 1)
        fechaRow = datos(fila, COL_DATOS_FECHA)
        If IsDate(fechaRow) Then
            fechaVal = CDate(fechaRow)

            If Not tieneFecha Then
                minFecha = fechaVal
                maxFecha = fechaVal
                tieneFecha = True
            Else
                If fechaVal < minFecha Then minFecha = fechaVal
                If fechaVal > maxFecha Then maxFecha = fechaVal
            End If

            cod = Trim$(CStr(datos(fila, COL_DATOS_CODIGO)))
            marca = UCase$(Trim$(CStr(datos(fila, COL_DATOS_MARCA))))
            horaRow = datos(fila, COL_DATOS_HORA)

            If marca = "P10" Then
                clave = cod & "|" & CLng(fechaVal)
                If Not dictP10Min.Exists(clave) Then
                    dictP10Min.Add clave, horaRow
                ElseIf IsDate(horaRow) Then
                    If CDate(horaRow) < CDate(dictP10Min(clave)) Then
                        dictP10Min(clave) = horaRow
                    End If
                End If
            ElseIf marca = "P20" Then
                clave = cod & "|" & CLng(fechaVal)
                If Not dictP20Max.Exists(clave) Then
                    dictP20Max.Add clave, horaRow
                ElseIf IsDate(horaRow) Then
                    If CDate(horaRow) > CDate(dictP20Max(clave)) Then
                        dictP20Max(clave) = horaRow
                    End If
                End If
            End If
        End If
    Next fila
End Sub

' ====== BUSCA PRIMERA P10 Y ULTIMA P20 USANDO LOS INDICES (O(1)) ======
Private Sub BuscarMarcasP10P20_Indexado(ByVal cod As String, _
                                         ByVal fecha As Date, _
                                         ByVal esNocturno As Boolean, _
                                         ByRef dictP10Min As Object, _
                                         ByRef dictP20Max As Object, _
                                         ByRef primeraP10 As Variant, _
                                         ByRef ultimaP20 As Variant)
    Dim fechaSalida As Date
    Dim claveEntrada As String, claveSalida As String

    fechaSalida = IIf(esNocturno, fecha + 1, fecha)

    claveEntrada = cod & "|" & CLng(fecha)
    claveSalida = cod & "|" & CLng(fechaSalida)

    If dictP10Min.Exists(claveEntrada) Then
        primeraP10 = dictP10Min(claveEntrada)
    Else
        primeraP10 = Empty
    End If

    If dictP20Max.Exists(claveSalida) Then
        ultimaP20 = dictP20Max(claveSalida)
    Else
        ultimaP20 = Empty
    End If
End Sub

' ====== DETERMINA EL TIPO DE JORNADA VIGENTE PARA UNA FECHA (BASE O NUEVO) ======
Private Function TipoVigente_Fila(ByVal fecha As Date, _
                                   ByVal wsHor As Worksheet, _
                                   ByVal filaHor As Long) As String
    Dim tipoBase As String, tipoNuevo As String
    Dim fCambio As Variant

    tipoBase = CStr(wsHor.Cells(filaHor, COL_HOR_TIPO_BASE).Value)
    tipoNuevo = CStr(wsHor.Cells(filaHor, COL_HOR_TIPO_NUEVO).Value)
    fCambio = wsHor.Cells(filaHor, COL_HOR_FECHA_CAMBIO).Value

    TipoVigente_Fila = tipoBase

    If Not IsEmpty(fCambio) And Not IsNull(fCambio) Then
        If IsDate(fCambio) Then
            If fecha >= CDate(fCambio) And tipoNuevo <> "" Then
                TipoVigente_Fila = tipoNuevo
            End If
        End If
    End If
End Function

' ====== DETERMINA SI EL DIA ES LABORABLE (USANDO LA FILA EN HORARIOS) ======
Private Function DiaEsLaborable_Fila(ByVal fecha As Date, _
                                     ByVal wsHor As Worksheet, _
                                     ByVal filaHor As Long) As Boolean
    Dim dia As Long
    Dim tipo As String

    dia = Weekday(fecha, vbMonday)
    tipo = TipoVigente_Fila(fecha, wsHor, filaHor)

    Select Case UCase$(tipo)
        Case "L-S"
            DiaEsLaborable_Fila = (dia >= 1 And dia <= 6)
        Case "D-V"
            ' Domingo a Viernes: laborable todos los dias excepto sabado (dia 6)
            DiaEsLaborable_Fila = (dia = 7 Or (dia >= 1 And dia <= 5))
        Case Else
            DiaEsLaborable_Fila = False
    End Select
End Function

' ====== OBTIENE HORARIO PROGRAMADO ======
Private Sub ObtenerHorarioProgramado_Fila(ByVal fecha As Date, _
                                          ByVal wsHor As Worksheet, _
                                          ByVal filaHor As Long, _
                                          ByRef entradaProg As Variant, _
                                          ByRef salidaProg As Variant)
    Dim dia As Long
    Dim entLV As Variant, salLV As Variant
    Dim entSab As Variant, salSab As Variant
    Dim entNew As Variant, salNew As Variant
    Dim tipo As String
    Dim fCambio As Variant
    Dim cambioAplicado As Boolean

    dia = Weekday(fecha, vbMonday)
    tipo = TipoVigente_Fila(fecha, wsHor, filaHor)

    entLV = wsHor.Cells(filaHor, COL_HOR_ENT_LV).Value
    salLV = wsHor.Cells(filaHor, COL_HOR_SAL_LV).Value
    entSab = wsHor.Cells(filaHor, COL_HOR_ENT_SAB).Value
    salSab = wsHor.Cells(filaHor, COL_HOR_SAL_SAB).Value
    entNew = wsHor.Cells(filaHor, COL_HOR_ENT_NUEVO).Value
    salNew = wsHor.Cells(filaHor, COL_HOR_SAL_NUEVO).Value
    fCambio = wsHor.Cells(filaHor, COL_HOR_FECHA_CAMBIO).Value

    cambioAplicado = IsDate(fCambio) And (fecha >= CDate(fCambio))

    If cambioAplicado Then
        If Not IsEmpty(entNew) Then entLV = entNew
        If Not IsEmpty(salNew) Then salLV = salNew
        If IsEmpty(entSab) Then entSab = entLV
        If IsEmpty(salSab) Then salSab = salLV
    End If

    entradaProg = Empty
    salidaProg = Empty

    Select Case UCase$(tipo)
        Case "L-S"
            If dia >= 1 And dia <= 5 Then
                entradaProg = entLV
                salidaProg = salLV
            ElseIf dia = 6 Then
                If Not IsEmpty(entSab) Then
                    entradaProg = entSab
                    salidaProg = salSab
                Else
                    entradaProg = entLV
                    salidaProg = salLV
                End If
            End If
        Case "D-V"
            If dia = 7 Or (dia >= 1 And dia <= 5) Then
                entradaProg = entLV
                salidaProg = salLV
            End If
    End Select
End Sub
