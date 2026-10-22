/************************************************************
 * V1.13 — PRESUPUESTOS
 * Migración aditiva. No se ejecuta automáticamente.
 ************************************************************/

const V113_HOJA_PRESUPUESTOS = "Presupuestos";
const V113_ENCABEZADOS_PRESUPUESTOS = [
  "ID", "Mes", "Categoría", "Monto", "Activo", "Creado", "Actualizado"
];

function normalizarMesPresupuesto(valor) {
  if (
    Object.prototype.toString.call(valor) === "[object Date]" &&
    !isNaN(valor.getTime())
  ) {
    return Utilities.formatDate(valor, "America/Asuncion", "yyyy-MM");
  }

  const texto = String(valor == null ? "" : valor).trim();
  let partes = texto.match(/^(\d{4})[-\/](0?[1-9]|1[0-2])$/);
  if (partes) return partes[1] + "-" + String(Number(partes[2])).padStart(2, "0");

  partes = texto.match(/^(\d{4})[-\/](0?[1-9]|1[0-2])[-\/](0?[1-9]|[12]\d|3[01])(?:[T\s].*)?$/);
  if (partes) return partes[1] + "-" + String(Number(partes[2])).padStart(2, "0");

  partes = texto.match(/^(0?[1-9]|[12]\d|3[01])[-\/](0?[1-9]|1[0-2])[-\/](\d{4})(?:[T\s].*)?$/);
  if (partes) return partes[3] + "-" + String(Number(partes[2])).padStart(2, "0");

  partes = texto.match(/^(0?[1-9]|1[0-2])[-\/](\d{4})$/);
  return partes
    ? partes[2] + "-" + String(Number(partes[1])).padStart(2, "0")
    : "";
}

function claveNaturalPresupuestoV113_(mes, categoria) {
  return normalizarMesPresupuesto(mes) + "|" + normalizar(categoria);
}

function migrarV113Presupuestos() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = asegurarHojaV113_(ss, V113_HOJA_PRESUPUESTOS, V113_ENCABEZADOS_PRESUPUESTOS);
  hoja.setFrozenRows(1);
  return { ok: true, hoja: V113_HOJA_PRESUPUESTOS, creada: hoja.getLastRow() === 1 };
}

function asegurarHojaV113_(ss, nombre, encabezados) {
  let hoja = ss.getSheetByName(nombre);
  if (!hoja) hoja = ss.insertSheet(nombre);

  const actuales = hoja.getRange(1, 1, 1, encabezados.length).getDisplayValues()[0];
  const vacia = actuales.every(valor => String(valor || "").trim() === "");
  if (vacia) {
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
  } else {
    encabezados.forEach((encabezado, indice) => {
      if (normalizar(actuales[indice]) !== normalizar(encabezado)) {
        throw new Error("La hoja " + nombre + " tiene encabezados incompatibles.");
      }
    });
  }
  return hoja;
}

function registrarPresupuesto(datos) {
  const mes = normalizarMesPresupuesto(datos.mes);
  let categoria = String(datos.categoria || "").trim();
  const monto = numero(datos.monto);
  const requestId = String(datos.requestId || "").trim();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    return responder({ ok: false, error: "Mes inválido" });
  }
  if (!categoria || categoria.length > 80) {
    return responder({ ok: false, error: "Categoría inválida" });
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return responder({ ok: false, error: "Monto inválido" });
  }
  if (!/^[A-Za-z0-9-]{16,80}$/.test(requestId)) {
    return responder({ ok: false, error: "Identificación de solicitud inválida" });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoja = ss.getSheetByName(V113_HOJA_PRESUPUESTOS);
    if (!hoja) {
      return responder({ ok: false, error: "La migración V1.13 todavía no fue ejecutada" });
    }
    if (!categoriaExisteV113_(ss, categoria)) {
      return responder({ ok: false, error: "La categoría no existe en el catálogo" });
    }
    if (typeof resolverCategoriaV116_ === "function") {
      const resuelta = resolverCategoriaV116_(ss, categoria, "");
      if (resuelta) categoria = resuelta.categoria;
    }

    const ultimaFila = hoja.getLastRow();
    const filas = ultimaFila > 1
      ? hoja.getRange(2, 1, ultimaFila - 1, V113_ENCABEZADOS_PRESUPUESTOS.length).getValues()
      : [];
    const categoriaCanonica = valor => {
      if (typeof resolverCategoriaV116_ !== "function") return String(valor || "");
      const resultado = resolverCategoriaV116_(ss, valor, "");
      return resultado ? resultado.categoria : String(valor || "");
    };
    const claveBuscada = claveNaturalPresupuestoV113_(mes, categoria);
    const indicesCoincidentes = [];
    filas.forEach((fila, indiceFila) => {
      if (
        claveNaturalPresupuestoV113_(
          fila[1],
          categoriaCanonica(fila[2])
        ) === claveBuscada
      ) {
        indicesCoincidentes.push(indiceFila);
      }
    });
    const indice = indicesCoincidentes.length ? indicesCoincidentes[0] : -1;
    const ahora = new Date();

    if (indice >= 0) {
      const filaHoja = indice + 2;
      hoja.getRange(filaHoja, 3, 1, 5).setValues([[
        categoria, monto, true, filas[indice][5] || ahora, ahora
      ]]);
      SpreadsheetApp.flush();
      return responder({
        ok: true,
        mensaje: "Presupuesto actualizado",
        mes: mes,
        categoria: categoria,
        monto: monto,
        duplicadosDetectados: Math.max(0, indicesCoincidentes.length - 1)
      });
    }

    hoja.appendRow([
      "PRES-" + Utilities.getUuid(), mes, categoria, monto, true, ahora, ahora
    ]);
    SpreadsheetApp.flush();
    return responder({ ok: true, mensaje: "Presupuesto creado", mes: mes, categoria: categoria, monto: monto });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function categoriaExisteV113_(ss, categoria) {
  const hoja = ss.getSheetByName("Categorías");
  if (!hoja || hoja.getLastRow() < 2) return false;
  if (
    typeof resolverCategoriaV116_ === "function" &&
    normalizar(hoja.getRange(1, 9).getValue()) === "categoriaid"
  ) {
    return resolverCategoriaV116_(ss, categoria, "") !== null;
  }
  const valores = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getDisplayValues();
  const buscada = normalizar(categoria);
  return valores.some(fila => normalizar(fila[0]) === buscada);
}
