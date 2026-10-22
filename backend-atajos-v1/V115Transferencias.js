/************************************************************
 * V1.15 — TRANSFERENCIAS ENTRE CUENTAS
 ************************************************************/

const V115_HOJA_TRANSFERENCIAS = "Transferencias";
const V115_ENCABEZADOS_TRANSFERENCIAS = [
  "RequestId", "Fecha", "Cuenta origen", "Cuenta destino", "Monto",
  "Observación", "Estado", "Creado"
];

function migrarV115Transferencias() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  asegurarHojaV113_(ss, V115_HOJA_TRANSFERENCIAS, V115_ENCABEZADOS_TRANSFERENCIAS).setFrozenRows(1);
  return { ok: true, hoja: V115_HOJA_TRANSFERENCIAS };
}

function registrarTransferencia(datos) {
  const requestId = String(datos.requestId || "").trim();
  const origen = String(datos.cuentaOrigen || "").trim();
  const destino = String(datos.cuentaDestino || "").trim();
  const monto = numero(datos.monto);
  const fecha = fechaEstrictaV114_(datos.fecha);
  const observacion = String(datos.observacion || "").trim().substring(0, 240);

  if (!/^[A-Za-z0-9-]{16,80}$/.test(requestId)) return responder({ ok: false, error: "Identificación de solicitud inválida" });
  const cuentaValida = cuenta => typeof cuentaValidaV116_ === "function"
    ? cuentaValidaV116_(cuenta)
    : CUENTAS.includes(cuenta);
  if (!cuentaValida(origen) || !cuentaValida(destino)) return responder({ ok: false, error: "Cuenta inválida" });
  if (origen === destino) return responder({ ok: false, error: "Las cuentas deben ser diferentes" });
  if (!Number.isFinite(monto) || monto <= 0) return responder({ ok: false, error: "Monto inválido" });
  if (!fecha) return responder({ ok: false, error: "Fecha inválida" });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoja = ss.getSheetByName(V115_HOJA_TRANSFERENCIAS);
    if (!hoja) return responder({ ok: false, error: "La migración V1.15 todavía no fue ejecutada" });
    const filas = hoja.getLastRow() > 1
      ? hoja.getRange(2, 1, hoja.getLastRow() - 1, V115_ENCABEZADOS_TRANSFERENCIAS.length).getValues()
      : [];
    const existente = filas.find(fila => String(fila[0]) === requestId);
    if (existente) {
      return responder({ ok: true, duplicado: true, mensaje: "La transferencia ya estaba registrada", requestId: requestId });
    }

    hoja.appendRow([
      requestId, fecha, cuentaParaHoja(origen), cuentaParaHoja(destino), monto,
      observacion, "Aplicada", new Date()
    ]);
    SpreadsheetApp.flush();
    return responder({
      ok: true, mensaje: "Transferencia registrada", requestId: requestId,
      cuentaOrigen: origen, cuentaDestino: destino, monto: monto,
      fecha: Utilities.formatDate(fecha, TZ, "dd/MM/yyyy")
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function obtenerTransferenciasV115_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName(V115_HOJA_TRANSFERENCIAS);
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, V115_ENCABEZADOS_TRANSFERENCIAS.length).getValues()
    .filter(fila => normalizar(fila[6]) === "aplicada")
    .map(fila => ({
      requestId: String(fila[0] || ""), fecha: fila[1], origen: String(fila[2] || ""),
      destino: String(fila[3] || ""), monto: numero(fila[4]), observacion: String(fila[5] || "")
    }));
}

function aplicarTransferenciasV115ASaldos_(saldos) {
  const transferencias = obtenerTransferenciasV115_();
  const porCuenta = Object.create(null);
  saldos.forEach(item => { porCuenta[normalizar(item.cuenta)] = item; });
  transferencias.forEach(item => {
    const origen = porCuenta[normalizar(item.origen)];
    const destino = porCuenta[normalizar(item.destino)];
    if (origen) origen.saldo -= item.monto;
    if (destino) destino.saldo += item.monto;
  });
  return saldos;
}
