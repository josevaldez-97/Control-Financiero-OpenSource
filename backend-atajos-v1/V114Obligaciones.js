/************************************************************
 * V1.14 — GASTOS RECURRENTES Y VENCIMIENTOS
 ************************************************************/

const V114_HOJA_OBLIGACIONES = "Obligaciones";
const V114_HOJA_PAGOS = "Pagos obligaciones";
const V114_ENCABEZADOS_OBLIGACIONES = [
  "ID", "Nombre", "Categoría", "Subcategoría", "Medio de pago", "Monto",
  "Frecuencia", "Próximo vencimiento", "Activo", "Creado", "Actualizado"
];
const V114_ENCABEZADOS_PAGOS = [
  "RequestId", "Obligación ID", "Vencimiento", "Fecha pago", "Monto",
  "Estado", "Fila gasto", "Creado", "Actualizado"
];
const V114_FRECUENCIAS = ["Mensual", "Semanal", "Anual", "Única"];

function migrarV114Obligaciones() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  asegurarHojaV113_(ss, V114_HOJA_OBLIGACIONES, V114_ENCABEZADOS_OBLIGACIONES).setFrozenRows(1);
  asegurarHojaV113_(ss, V114_HOJA_PAGOS, V114_ENCABEZADOS_PAGOS).setFrozenRows(1);
  return { ok: true, hojas: [V114_HOJA_OBLIGACIONES, V114_HOJA_PAGOS] };
}

function guardarObligacion(datos) {
  const validacion = validarObligacionV114_(datos);
  if (!validacion.ok) return responder(validacion);
  const item = validacion.item;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoja = ss.getSheetByName(V114_HOJA_OBLIGACIONES);
    if (!hoja) return responder({ ok: false, error: "La migración V1.14 todavía no fue ejecutada" });
    if (!categoriaExisteV113_(ss, item.categoria)) return responder({ ok: false, error: "La categoría no existe en el catálogo" });

    const filas = hoja.getLastRow() > 1
      ? hoja.getRange(2, 1, hoja.getLastRow() - 1, V114_ENCABEZADOS_OBLIGACIONES.length).getValues()
      : [];
    const indice = item.id ? filas.findIndex(fila => String(fila[0]) === item.id) : -1;
    const ahora = new Date();
    if (item.id && indice < 0) return responder({ ok: false, error: "La obligación no existe" });

    if (indice >= 0) {
      hoja.getRange(indice + 2, 2, 1, 10).setValues([[
        item.nombre, item.categoria, item.subcategoria, item.medioPago, item.monto,
        item.frecuencia, item.vencimiento, item.activo, filas[indice][9] || ahora, ahora
      ]]);
      return responder({ ok: true, mensaje: "Obligación actualizada", id: item.id });
    }

    const id = "OBL-" + Utilities.getUuid();
    hoja.appendRow([
      id, item.nombre, item.categoria, item.subcategoria, item.medioPago, item.monto,
      item.frecuencia, item.vencimiento, true, ahora, ahora
    ]);
    return responder({ ok: true, mensaje: "Obligación creada", id: id });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function pagarObligacion(datos) {
  const id = String(datos.obligacionId || "").trim();
  const requestId = String(datos.requestId || "").trim();
  const fechaPago = fechaEstrictaV114_(datos.fecha);
  if (!id) return responder({ ok: false, error: "Obligación inválida" });
  if (!/^[A-Za-z0-9-]{16,80}$/.test(requestId)) return responder({ ok: false, error: "Identificación de solicitud inválida" });
  if (!fechaPago) return responder({ ok: false, error: "Fecha inválida" });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoja = ss.getSheetByName(V114_HOJA_OBLIGACIONES);
    const pagos = ss.getSheetByName(V114_HOJA_PAGOS);
    const gastos = ss.getSheetByName("Gastos");
    if (!hoja || !pagos) return responder({ ok: false, error: "La migración V1.14 todavía no fue ejecutada" });
    if (!gastos) return responder({ ok: false, error: "No existe la hoja Gastos" });

    const filas = hoja.getLastRow() > 1
      ? hoja.getRange(2, 1, hoja.getLastRow() - 1, V114_ENCABEZADOS_OBLIGACIONES.length).getValues()
      : [];
    const indice = filas.findIndex(fila => String(fila[0]) === id);
    if (indice < 0 || filas[indice][8] === false) return responder({ ok: false, error: "La obligación no está activa" });
    const obligacion = filas[indice];
    const vence = formatearFechaV114_(obligacion[7]);

    const pagosFilas = pagos.getLastRow() > 1
      ? pagos.getRange(2, 1, pagos.getLastRow() - 1, V114_ENCABEZADOS_PAGOS.length).getValues()
      : [];
    const existente = pagosFilas.find(fila => String(fila[0]) === requestId ||
      (String(fila[1]) === id && formatearFechaV114_(fila[2]) === vence));
    if (existente) {
      return responder({
        ok: normalizar(existente[5]) === "pagado",
        duplicado: true,
        incierto: normalizar(existente[5]) !== "pagado",
        mensaje: normalizar(existente[5]) === "pagado" ? "El vencimiento ya estaba pagado" : "El pago ya está en procesamiento"
      });
    }

    const ahora = new Date();
    pagos.appendRow([requestId, id, obligacion[7], fechaPago, obligacion[5], "Procesando", "", ahora, ahora]);
    const filaPago = pagos.getLastRow();
    SpreadsheetApp.flush();

    gastos.appendRow([
      fechaPago, obligacion[2], obligacion[3] || "Otros", obligacion[1],
      numero(obligacion[5]),
      typeof medioParaHojaV116_ === "function" ? medioParaHojaV116_(obligacion[4]) : obligacion[4],
      "Pago de obligación " + vence, "Dashboard V1.14"
    ]);
    const filaGasto = gastos.getLastRow();
    pagos.getRange(filaPago, 6, 1, 4).setValues([["Pagado", filaGasto, ahora, new Date()]]);

    const siguiente = siguienteVencimientoV114_(obligacion[7], obligacion[6]);
    if (siguiente) {
      hoja.getRange(indice + 2, 8, 1, 4).setValues([[siguiente, true, obligacion[9], new Date()]]);
    } else {
      hoja.getRange(indice + 2, 9, 1, 3).setValues([[false, obligacion[9], new Date()]]);
    }
    SpreadsheetApp.flush();
    return responder({ ok: true, mensaje: "Obligación pagada", id: id, filaGasto: filaGasto });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function validarObligacionV114_(datos) {
  const item = {
    id: String(datos.id || "").trim(),
    nombre: String(datos.nombre || "").trim(),
    categoria: String(datos.categoria || "").trim(),
    subcategoria: String(datos.subcategoria || "").trim(),
    medioPago: String(datos.medioPago || "").trim(),
    monto: numero(datos.monto),
    frecuencia: String(datos.frecuencia || "").trim(),
    vencimiento: fechaEstrictaV114_(datos.vencimiento),
    activo: datos.activo !== false
  };
  if (!item.nombre || item.nombre.length > 120) return { ok: false, error: "Nombre inválido" };
  if (!item.categoria || item.categoria.length > 80) return { ok: false, error: "Categoría inválida" };
  const medioValido = typeof medioGastoValidoV116_ === "function"
    ? medioGastoValidoV116_(item.medioPago)
    : MEDIOS_GASTO.includes(item.medioPago);
  if (!medioValido) return { ok: false, error: "Medio de pago inválido" };
  if (!Number.isFinite(item.monto) || item.monto <= 0) return { ok: false, error: "Monto inválido" };
  if (!V114_FRECUENCIAS.includes(item.frecuencia)) return { ok: false, error: "Frecuencia inválida" };
  if (!item.vencimiento) return { ok: false, error: "Vencimiento inválido" };
  return { ok: true, item: item };
}

function fechaEstrictaV114_(valor) {
  return normalizarFechaV113A118_(valor);
}

function normalizarFechaV113A118_(valor) {
  let texto;
  if (
    Object.prototype.toString.call(valor) === "[object Date]" &&
    !isNaN(valor.getTime())
  ) {
    texto = Utilities.formatDate(valor, "America/Asuncion", "yyyy-MM-dd");
  } else {
    texto = String(valor == null ? "" : valor).trim();
  }

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const local = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!iso && !local) return null;

  const anio = Number(iso ? iso[1] : local[3]);
  const mes = Number(iso ? iso[2] : local[2]);
  const dia = Number(iso ? iso[3] : local[1]);
  const fecha = new Date(anio, mes - 1, dia, 12, 0, 0);
  return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia ? fecha : null;
}

function formatearFechaV114_(valor) {
  const fecha = valor instanceof Date ? valor : fechaEstrictaV114_(valor);
  return fecha && !isNaN(fecha.getTime()) ? Utilities.formatDate(fecha, TZ, "yyyy-MM-dd") : "";
}

function siguienteVencimientoV114_(valor, frecuencia) {
  const fecha = valor instanceof Date ? new Date(valor.getTime()) : fechaEstrictaV114_(valor);
  if (!fecha || frecuencia === "Única") return null;
  if (frecuencia === "Semanal") fecha.setDate(fecha.getDate() + 7);
  if (frecuencia === "Mensual") {
    const dia = fecha.getDate();
    fecha.setDate(1);
    fecha.setMonth(fecha.getMonth() + 1);
    const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
    fecha.setDate(Math.min(dia, ultimoDia));
  }
  if (frecuencia === "Anual") {
    const mes = fecha.getMonth();
    const dia = fecha.getDate();
    fecha.setDate(1);
    fecha.setFullYear(fecha.getFullYear() + 1);
    fecha.setMonth(mes);
    const ultimoDia = new Date(fecha.getFullYear(), mes + 1, 0).getDate();
    fecha.setDate(Math.min(dia, ultimoDia));
  }
  return fecha;
}
