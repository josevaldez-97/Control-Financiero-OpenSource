/************************************************************
 * V1.17 — METAS DE AHORRO
 *
 * Los aportes son asignaciones informativas. No mueven fondos
 * ni modifican Saldos, Gastos, Ingresos o Transferencias.
 ************************************************************/

const V117_HOJA_METAS = "Metas ahorro";
const V117_HOJA_APORTES = "Aportes metas";
const V117_ENCABEZADOS_METAS = [
  "ID", "Nombre", "Monto objetivo", "Cuenta vinculada",
  "Fecha objetivo", "Activa", "Creado", "Actualizado"
];
const V117_ENCABEZADOS_APORTES = [
  "RequestId", "Meta ID", "Fecha", "Monto", "Nota", "Creado"
];

function migrarV117Metas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  asegurarHojaV113_(ss, V117_HOJA_METAS, V117_ENCABEZADOS_METAS).setFrozenRows(1);
  asegurarHojaV113_(ss, V117_HOJA_APORTES, V117_ENCABEZADOS_APORTES).setFrozenRows(1);
  return { ok: true, hojas: [V117_HOJA_METAS, V117_HOJA_APORTES] };
}

function guardarMetaV117(datos) {
  const id = String(datos.id || "").trim();
  const nombre = String(datos.nombre || "").trim();
  const montoObjetivo = numero(datos.montoObjetivo);
  const cuentaRecibida = String(datos.cuenta || "").trim();
  const fechaObjetivo = fechaEstrictaV114_(datos.fechaObjetivo);
  const activa = datos.activa !== false;
  if (!nombre || nombre.length > 120) return responder({ ok: false, error: "Nombre inválido" });
  if (!Number.isFinite(montoObjetivo) || montoObjetivo <= 0) return responder({ ok: false, error: "Monto objetivo inválido" });
  if (!fechaObjetivo) return responder({ ok: false, error: "Fecha objetivo inválida" });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoja = ss.getSheetByName(V117_HOJA_METAS);
    if (!hoja) return responder({ ok: false, error: "La migración V1.17 todavía no fue ejecutada" });
    const cuenta = resolverCuentaV116_(cuentaRecibida, activa);
    if (!cuenta) return responder({ ok: false, error: "Cuenta vinculada inválida" });
    const filas = hoja.getLastRow() > 1
      ? hoja.getRange(2, 1, hoja.getLastRow() - 1, V117_ENCABEZADOS_METAS.length).getValues()
      : [];
    const indice = id ? filas.findIndex(fila => String(fila[0]) === id) : -1;
    if (id && indice < 0) return responder({ ok: false, error: "La meta no existe" });
    const ahora = new Date();
    if (indice >= 0) {
      hoja.getRange(indice + 2, 2, 1, 7).setValues([[
        nombre, montoObjetivo, cuenta.nombreSaldos, fechaObjetivo,
        activa, filas[indice][6] || ahora, ahora
      ]]);
      return responder({ ok: true, mensaje: "Meta actualizada", id: id });
    }
    const nuevoId = "META-" + Utilities.getUuid();
    hoja.appendRow([nuevoId, nombre, montoObjetivo, cuenta.nombreSaldos, fechaObjetivo, true, ahora, ahora]);
    return responder({ ok: true, mensaje: "Meta creada", id: nuevoId });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function registrarAporteMetaV117(datos) {
  const requestId = String(datos.requestId || "").trim();
  const metaId = String(datos.metaId || "").trim();
  const monto = numero(datos.monto);
  const fecha = fechaEstrictaV114_(datos.fecha);
  const nota = String(datos.nota || "").trim().substring(0, 240);
  if (!/^[A-Za-z0-9-]{16,80}$/.test(requestId)) return responder({ ok: false, error: "Identificación de solicitud inválida" });
  if (!metaId) return responder({ ok: false, error: "Meta inválida" });
  if (!Number.isFinite(monto) || monto <= 0) return responder({ ok: false, error: "Monto inválido" });
  if (!fecha) return responder({ ok: false, error: "Fecha inválida" });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const metas = ss.getSheetByName(V117_HOJA_METAS);
    const aportes = ss.getSheetByName(V117_HOJA_APORTES);
    if (!metas || !aportes) return responder({ ok: false, error: "La migración V1.17 todavía no fue ejecutada" });
    const filasMetas = metas.getLastRow() > 1
      ? metas.getRange(2, 1, metas.getLastRow() - 1, V117_ENCABEZADOS_METAS.length).getValues()
      : [];
    const meta = filasMetas.find(fila => String(fila[0]) === metaId);
    if (!meta || (typeof valorActivoV116_ === "function" ? !valorActivoV116_(meta[5]) : meta[5] === false)) {
      return responder({ ok: false, error: "La meta no existe o está desactivada" });
    }
    const filasAportes = aportes.getLastRow() > 1
      ? aportes.getRange(2, 1, aportes.getLastRow() - 1, V117_ENCABEZADOS_APORTES.length).getValues()
      : [];
    if (filasAportes.some(fila => String(fila[0]) === requestId)) {
      return responder({ ok: true, duplicado: true, mensaje: "El aporte ya estaba registrado", requestId: requestId });
    }
    aportes.appendRow([requestId, metaId, fecha, monto, nota, new Date()]);
    SpreadsheetApp.flush();
    return responder({ ok: true, mensaje: "Aporte registrado", requestId: requestId, metaId: metaId, monto: monto });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}
