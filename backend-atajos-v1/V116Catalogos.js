/************************************************************
 * V1.16 — CATÁLOGOS ADMINISTRABLES
 *
 * Cuentas conserva la identidad y el estado. Saldos sigue
 * siendo la fuente financiera oficial.
 ************************************************************/

const V116_HOJA_CUENTAS = "Cuentas";
const V116_ENCABEZADOS_CUENTAS = [
  "ID", "Nombre", "Nombre en Saldos", "Aliases", "Saldo base",
  "Activa", "Fila Saldos", "Creado", "Actualizado"
];
const V116_COLUMNAS_CATEGORIAS = [
  "Categoría ID", "Categoría activa", "Subcategoría ID",
  "Subcategoría activa", "Alias categoría", "Alias subcategoría"
];

function migrarV116Catalogos() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    migrarV116Cuentas_(ss);
    migrarV116Categorias_(ss);
    return { ok: true, hojas: [V116_HOJA_CUENTAS, "Categorías"] };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function migrarV116Cuentas_(ss) {
  const hoja = asegurarHojaV113_(ss, V116_HOJA_CUENTAS, V116_ENCABEZADOS_CUENTAS);
  hoja.setFrozenRows(1);
  const existentes = leerCuentasV116_(ss);
  const porCanonico = Object.create(null);
  existentes.forEach(item => { porCanonico[normalizar(item.nombreSaldos)] = true; });

  const saldos = ss.getSheetByName("Saldos");
  if (!saldos) throw new Error("No existe la hoja Saldos");
  const filas = saldos.getRange("A3:B8").getValues();
  const ahora = new Date();
  filas.forEach((fila, indice) => {
    const canonico = String(fila[0] || "").trim();
    if (!canonico || esNombreTotalV116_(canonico) || porCanonico[normalizar(canonico)]) return;
    const visible = nombreVisibleCuentaV116_(canonico);
    hoja.appendRow([
      "CTA-" + Utilities.getUuid(), visible, canonico,
      unirAliasesV116_([visible, canonico]), numero(fila[1]), true,
      indice + 3, ahora, ahora
    ]);
    porCanonico[normalizar(canonico)] = true;
  });
}

function migrarV116Categorias_(ss) {
  const hoja = ss.getSheetByName("Categorías");
  if (!hoja) throw new Error("No existe la hoja Categorías");
  const encabezadosActuales = hoja.getRange(1, 9, 1, V116_COLUMNAS_CATEGORIAS.length).getDisplayValues()[0];
  encabezadosActuales.forEach((valor, indice) => {
    if (String(valor || "").trim() && normalizar(valor) !== normalizar(V116_COLUMNAS_CATEGORIAS[indice])) {
      throw new Error("Categorías!I:N contiene encabezados incompatibles; no se modificó la hoja.");
    }
  });
  if (
    hoja.getLastRow() >= 2 &&
    encabezadosActuales.every(valor => !String(valor || "").trim())
  ) {
    const datosLaterales = hoja.getRange(2, 9, hoja.getLastRow() - 1, V116_COLUMNAS_CATEGORIAS.length).getDisplayValues();
    if (datosLaterales.some(fila => fila.some(valor => String(valor || "").trim()))) {
      throw new Error("Categorías!I:N contiene datos sin encabezados; no se modificó la hoja.");
    }
  }
  if (encabezadosActuales.some((valor, indice) => normalizar(valor) !== normalizar(V116_COLUMNAS_CATEGORIAS[indice]))) {
    hoja.getRange(1, 9, 1, V116_COLUMNAS_CATEGORIAS.length).setValues([V116_COLUMNAS_CATEGORIAS]);
  }
  const ultima = Math.max(hoja.getLastRow(), 2);
  const datos = hoja.getRange(2, 1, ultima - 1, 14).getValues();
  datos.forEach((fila, indice) => {
    const numeroFila = indice + 2;
    if (String(fila[0] || "").trim()) {
      if (!fila[8]) hoja.getRange(numeroFila, 9).setValue("CAT-" + Utilities.getUuid());
      if (fila[9] === "") hoja.getRange(numeroFila, 10).setValue(true);
    }
    if (String(fila[1] || "").trim()) {
      if (!fila[10]) hoja.getRange(numeroFila, 11).setValue("SUB-" + Utilities.getUuid());
      if (fila[11] === "") hoja.getRange(numeroFila, 12).setValue(true);
    }
  });
}

function guardarCuentaV116(datos) {
  const item = validarCuentaV116_(datos);
  if (!item.ok) return responder(item);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoja = ss.getSheetByName(V116_HOJA_CUENTAS);
    const saldos = ss.getSheetByName("Saldos");
    if (!hoja || !saldos) return responder({ ok: false, error: "La migración V1.16 todavía no fue ejecutada" });
    const cuentas = leerCuentasV116_(ss);
    const indice = item.id ? cuentas.findIndex(cuenta => cuenta.id === item.id) : -1;
    if (item.id && indice < 0) return responder({ ok: false, error: "La cuenta no existe" });
    const conflicto = cuentas.some(cuenta => cuenta.id !== item.id && coincideCuentaV116_(cuenta, item.nombre));
    if (conflicto) return responder({ ok: false, error: "Ya existe una cuenta con ese nombre o alias" });
    if (!item.id && existeCuentaEnHistoriaV116_(ss, item.nombre)) {
      return responder({ ok: false, error: "La cuenta ya aparece en el historial; debe revisarse antes de crearla" });
    }
    const ahora = new Date();

    if (indice >= 0) {
      const anterior = cuentas[indice];
      const aliases = unirAliasesV116_(anterior.aliases.concat([anterior.nombre, anterior.nombreSaldos, item.nombre]));
      hoja.getRange(anterior.filaCatalogo, 2, 1, 8).setValues([[
        item.nombre, anterior.nombreSaldos, aliases, anterior.saldoBase,
        item.activa, anterior.filaSaldos, anterior.creado || ahora, ahora
      ]]);
      return responder({ ok: true, mensaje: "Cuenta actualizada", id: anterior.id });
    }

    const canonico = item.nombre;
    const aliases = [canonico];
    const id = "CTA-" + Utilities.getUuid();
    const filaTotal = localizarFilaTotalSaldosV116_(saldos);
    const respaldoTotal = respaldarFilaTotalSaldosV116_(saldos, filaTotal);
    const filaSaldos = filaTotal;
    const filaCatalogo = hoja.getLastRow() + 1;
    let filaInsertada = false;

    try {
      saldos.insertRowsBefore(filaTotal, 1);
      filaInsertada = true;
      saldos.getRange(filaSaldos, 1, 1, 2).setValues([[canonico, item.saldoBase]]);
      saldos.getRange(filaSaldos, 3, 1, 4).setFormulas([[
        formulaSumaCuentaV116_("Ingresos", "E", 4, "D", aliases),
        formulaSumaCuentaV116_("Gastos", "F", 7, "E", aliases),
        formulaSumaCuentaV116_("Pagos tarjetas", "D", 2, "C", aliases),
        "=B" + filaSaldos + "+C" + filaSaldos + "-D" + filaSaldos + "-E" + filaSaldos
      ]]);
      actualizarFormulasTotalSaldosV116_(saldos, filaTotal + 1);

      hoja.appendRow([
        id, item.nombre, canonico, unirAliasesV116_(aliases), item.saldoBase,
        item.activa, filaSaldos, ahora, ahora
      ]);
      SpreadsheetApp.flush();

      verificarCuentaCreadaV116_(saldos, hoja, {
        id: id,
        nombreSaldos: canonico,
        saldoBase: item.saldoBase,
        filaSaldos: filaSaldos,
        filaCatalogo: filaCatalogo,
        filaTotal: filaTotal + 1
      });

      return responder({ ok: true, mensaje: "Cuenta creada", id: id, filaSaldos: filaSaldos });
    } catch (error) {
      const rollbackCorrecto = revertirCreacionCuentaV116_({
        saldos: saldos,
        cuentas: hoja,
        id: id,
        nombreSaldos: canonico,
        filaSaldos: filaSaldos,
        filaInsertada: filaInsertada,
        respaldoTotal: respaldoTotal
      });
      if (!rollbackCorrecto) {
        throw new Error("No se pudo revertir completamente la creación de la cuenta; requiere revisión manual.");
      }
      return responder({ ok: false, error: "No fue posible crear la cuenta; no se aplicaron cambios." });
    }
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function guardarCategoriaV116(datos) {
  return guardarElementoCategoriaV116_(datos, false);
}

function guardarSubcategoriaV116(datos) {
  return guardarElementoCategoriaV116_(datos, true);
}

function guardarElementoCategoriaV116_(datos, esSubcategoria) {
  const id = String(datos.id || "").trim();
  const nombre = String(datos.nombre || "").trim();
  const padre = String(datos.categoriaPadre || "").trim();
  const activa = datos.activa !== false;
  if (!nombre || nombre.length > 80 || /[|\r\n]/.test(nombre)) return responder({ ok: false, error: "Nombre inválido" });
  if (esSubcategoria && !padre) return responder({ ok: false, error: "Categoría padre obligatoria" });
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoja = ss.getSheetByName("Categorías");
    if (!hoja || normalizar(hoja.getRange(1, 9).getValue()) !== "categoriaid") {
      return responder({ ok: false, error: "La migración V1.16 todavía no fue ejecutada" });
    }
    const ultima = Math.max(hoja.getLastRow(), 2);
    const filas = hoja.getRange(2, 1, ultima - 1, 14).getValues();
    const colNombre = esSubcategoria ? 1 : 0;
    const colId = esSubcategoria ? 10 : 8;
    const colActiva = esSubcategoria ? 11 : 9;
    const colAlias = esSubcategoria ? 13 : 12;
    const indice = id ? filas.findIndex(fila => String(fila[colId] || "") === id) : -1;
    if (id && indice < 0) return responder({ ok: false, error: "El elemento no existe" });
    const duplicado = filas.some((fila, i) =>
      i !== indice &&
      normalizar(fila[colNombre]) === normalizar(nombre) &&
      (!esSubcategoria || normalizar(fila[7]) === normalizar(padre))
    );
    if (duplicado) return responder({ ok: false, error: "Ya existe un elemento con ese nombre" });
    if (esSubcategoria && !categoriaActivaV116_(filas, padre)) {
      return responder({ ok: false, error: "La categoría padre no existe o está desactivada" });
    }

    if (indice >= 0) {
      const numeroFila = indice + 2;
      const anterior = String(filas[indice][colNombre] || "").trim();
      hoja.getRange(numeroFila, colNombre + 1).setValue(nombre);
      hoja.getRange(numeroFila, colActiva + 1).setValue(activa);
      hoja.getRange(numeroFila, colAlias + 1).setValue(unirAliasesV116_([filas[indice][colAlias], anterior]));
      if (esSubcategoria) hoja.getRange(numeroFila, 8).setValue(padre);
      if (!esSubcategoria && normalizar(anterior) !== normalizar(nombre)) {
        filas.forEach((fila, i) => {
          if (normalizar(fila[7]) === normalizar(anterior)) hoja.getRange(i + 2, 8).setValue(nombre);
        });
      }
      return responder({ ok: true, mensaje: esSubcategoria ? "Subcategoría actualizada" : "Categoría actualizada", id: id });
    }

    const columna = colNombre + 1;
    let numeroFila = 2;
    while (String(hoja.getRange(numeroFila, columna).getValue() || "").trim()) numeroFila++;
    const nuevoId = (esSubcategoria ? "SUB-" : "CAT-") + Utilities.getUuid();
    hoja.getRange(numeroFila, columna).setValue(nombre);
    hoja.getRange(numeroFila, colId + 1).setValue(nuevoId);
    hoja.getRange(numeroFila, colActiva + 1).setValue(activa);
    if (esSubcategoria) hoja.getRange(numeroFila, 8).setValue(padre);
    return responder({ ok: true, mensaje: esSubcategoria ? "Subcategoría creada" : "Categoría creada", id: nuevoId });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function leerCuentasV116_(ss) {
  const hoja = ss.getSheetByName(V116_HOJA_CUENTAS);
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, V116_ENCABEZADOS_CUENTAS.length).getValues()
    .filter(fila =>
      String(fila[0] || "").trim() &&
      !esNombreTotalV116_(fila[1]) &&
      !esNombreTotalV116_(fila[2])
    )
    .map((fila, indice) => ({
      id: String(fila[0]), nombre: String(fila[1] || "").trim(),
      nombreSaldos: String(fila[2] || "").trim(), aliases: separarAliasesV116_(fila[3]),
      saldoBase: numero(fila[4]), activa: valorActivoV116_(fila[5]),
      filaSaldos: Number(fila[6]) || 0, creado: fila[7], filaCatalogo: indice + 2
    }));
}

function resolverCuentaV116_(valor, exigirActiva) {
  const texto = String(valor || "").trim();
  if (!texto) return null;
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const cuenta = leerCuentasV116_(ss).find(item => coincideCuentaV116_(item, texto));
    if (!cuenta || (exigirActiva && !cuenta.activa)) return null;
    return cuenta;
  } catch (error) {
    return null;
  }
}

function cuentaValidaV116_(valor) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss.getSheetByName(V116_HOJA_CUENTAS)) return CUENTAS.includes(String(valor || "").trim());
  return resolverCuentaV116_(valor, true) !== null;
}

function medioGastoValidoV116_(valor) {
  const texto = String(valor || "").trim();
  if (["Tarjeta Ueno", "Tarjeta Continental", "Tarjeta GNB", "Transferencia"].includes(texto)) return true;
  return cuentaValidaV116_(texto);
}

function medioParaHojaV116_(valor) {
  const cuenta = resolverCuentaV116_(valor, false);
  return cuenta ? cuenta.nombreSaldos : String(valor || "").trim();
}

function nombreVisibleCuentaV116_(canonico) {
  const mapa = { "Ueno": "Cuenta Ueno", "Banco Continental": "Cuenta Continental", "Banco Atlas": "Cuenta Atlas", "Banco GNB": "Cuenta GNB" };
  return mapa[canonico] || canonico;
}

function coincideCuentaV116_(cuenta, valor) {
  const clave = normalizar(valor);
  return [cuenta.nombre, cuenta.nombreSaldos].concat(cuenta.aliases || []).some(alias => normalizar(alias) === clave);
}

function validarCuentaV116_(datos) {
  const nombre = String(datos.nombre || "").trim();
  const saldoBase = numero(datos.saldoBase);
  if (!nombre || nombre.length > 80 || /[|\r\n]/.test(nombre)) return { ok: false, error: "Nombre de cuenta inválido" };
  if (["total", "tarjetaueno", "tarjetacontinental", "tarjetagnb", "transferencia"].includes(normalizar(nombre))) {
    return { ok: false, error: "El nombre está reservado para otro medio de pago" };
  }
  if (!String(datos.id || "").trim() && !esSaldoBaseValidoV116_(datos.saldoBase)) {
    return { ok: false, error: "Saldo base inválido" };
  }
  return { ok: true, id: String(datos.id || "").trim(), nombre: nombre, saldoBase: saldoBase, activa: datos.activa !== false };
}

function esSaldoBaseValidoV116_(valor) {
  if (valor === null || valor === undefined || valor === "") return false;
  if (typeof valor === "number") return Number.isFinite(valor);
  let texto = String(valor).replace(/Gs\.?/gi, "").replace(/\s/g, "").trim();
  if (/^-?\d{1,3}(\.\d{3})+$/.test(texto)) texto = texto.replace(/\./g, "");
  if (/^-?\d{1,3}(,\d{3})+$/.test(texto)) texto = texto.replace(/,/g, "");
  return texto !== "" && Number.isFinite(Number(texto));
}

function formulaSumaCuentaV116_(hoja, columnaCriterio, filaInicio, columnaMonto, aliases) {
  return "=" + aliases.map(alias => {
    const seguro = String(alias).replace(/"/g, '""');
    return "SUMIF('" + hoja + "'!$" + columnaCriterio + "$" + filaInicio + ":$" + columnaCriterio + ";\"" + seguro + "\";'" + hoja + "'!$" + columnaMonto + "$" + filaInicio + ":$" + columnaMonto + ")";
  }).join("+");
}

function esNombreTotalV116_(valor) {
  return normalizar(valor) === "total";
}

function localizarFilaTotalSaldosV116_(hoja) {
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 3) throw new Error("No existe la fila TOTAL en Saldos");
  const coincidencias = [];
  hoja.getRange(3, 1, ultimaFila - 2, 1).getDisplayValues().forEach((fila, indice) => {
    if (esNombreTotalV116_(fila[0])) coincidencias.push(indice + 3);
  });
  if (coincidencias.length !== 1) {
    throw new Error(coincidencias.length ? "Existe más de una fila TOTAL en Saldos" : "No existe la fila TOTAL en Saldos");
  }
  return coincidencias[0];
}

function respaldarFilaTotalSaldosV116_(hoja, filaTotal) {
  const rango = hoja.getRange(filaTotal, 1, 1, 6);
  return {
    fila: filaTotal,
    valores: rango.getValues()[0],
    formulas: rango.getFormulas()[0]
  };
}

function actualizarFormulasTotalSaldosV116_(hoja, filaTotal) {
  const ultimaCuenta = filaTotal - 1;
  hoja.getRange(filaTotal, 2, 1, 5).setFormulas([[
    "=SUM(B3:B" + ultimaCuenta + ")",
    "=SUM(C3:C" + ultimaCuenta + ")",
    "=SUM(D3:D" + ultimaCuenta + ")",
    "=SUM(E3:E" + ultimaCuenta + ")",
    "=SUM(F3:F" + ultimaCuenta + ")"
  ]]);
}

function restaurarFilaTotalSaldosV116_(hoja, respaldo) {
  respaldo.valores.forEach((valor, indice) => {
    const celda = hoja.getRange(respaldo.fila, indice + 1);
    if (respaldo.formulas[indice]) celda.setFormula(respaldo.formulas[indice]);
    else celda.setValue(valor);
  });
}

function verificarCuentaCreadaV116_(saldos, cuentas, esperado) {
  const filaCuenta = saldos.getRange(esperado.filaSaldos, 1, 1, 6);
  const valoresCuenta = filaCuenta.getValues()[0];
  const formulasCuenta = filaCuenta.getFormulas()[0];
  const filaCatalogo = cuentas.getRange(esperado.filaCatalogo, 1, 1, V116_ENCABEZADOS_CUENTAS.length).getValues()[0];
  const nombreTotal = saldos.getRange(esperado.filaTotal, 1).getDisplayValue();
  const formulasTotal = saldos.getRange(esperado.filaTotal, 2, 1, 5).getFormulas()[0];
  const formulasTotalEsperadas = ["B", "C", "D", "E", "F"].map(columna =>
    "=SUM(" + columna + "3:" + columna + (esperado.filaTotal - 1) + ")"
  );

  if (
    normalizar(valoresCuenta[0]) !== normalizar(esperado.nombreSaldos) ||
    numero(valoresCuenta[1]) !== numero(esperado.saldoBase) ||
    formulasCuenta.slice(2, 6).some(formula => !formula) ||
    String(filaCatalogo[0] || "") !== esperado.id ||
    normalizar(filaCatalogo[2]) !== normalizar(esperado.nombreSaldos) ||
    Number(filaCatalogo[6]) !== esperado.filaSaldos ||
    !esNombreTotalV116_(nombreTotal) ||
    formulasTotal.some((formula, indice) => formula !== formulasTotalEsperadas[indice])
  ) {
    throw new Error("No se pudo verificar la cuenta creada");
  }
}

function revertirCreacionCuentaV116_(estado) {
  try {
    let rollbackCorrecto = true;
    if (estado.filaInsertada) {
      const nombreActual = estado.saldos.getRange(estado.filaSaldos, 1).getDisplayValue();
      if (!nombreActual || normalizar(nombreActual) === normalizar(estado.nombreSaldos)) {
        estado.saldos.deleteRow(estado.filaSaldos);
        restaurarFilaTotalSaldosV116_(estado.saldos, estado.respaldoTotal);
      } else {
        rollbackCorrecto = false;
      }
    }
    const filaCatalogoActual = localizarFilaCatalogoV116_(estado.cuentas, estado.id);
    if (filaCatalogoActual) {
      estado.cuentas.deleteRow(filaCatalogoActual);
    }
    SpreadsheetApp.flush();
    return rollbackCorrecto && !localizarFilaCatalogoV116_(estado.cuentas, estado.id);
  } catch (error) {
    return false;
  }
}

function localizarFilaCatalogoV116_(hoja, id) {
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return 0;
  const indice = hoja.getRange(2, 1, ultimaFila - 1, 1).getValues()
    .findIndex(fila => String(fila[0] || "") === String(id || ""));
  return indice < 0 ? 0 : indice + 2;
}

function existeCuentaEnHistoriaV116_(ss, nombre) {
  const clave = normalizar(nombre);
  const fuentes = [
    ["Ingresos", 5, 4],
    ["Gastos", 6, 7],
    ["Pagos tarjetas", 4, 2]
  ];
  if (ss.getSheetByName("Transferencias")) {
    fuentes.push(["Transferencias", 3, 2], ["Transferencias", 4, 2]);
  }
  return fuentes.some(configuracion => {
    const hoja = ss.getSheetByName(configuracion[0]);
    if (!hoja || hoja.getLastRow() < configuracion[2]) return false;
    return hoja.getRange(
      configuracion[2], configuracion[1],
      hoja.getLastRow() - configuracion[2] + 1, 1
    ).getDisplayValues().some(fila => normalizar(fila[0]) === clave);
  });
}

function separarAliasesV116_(valor) {
  return String(valor || "").split("|").map(item => item.trim()).filter(Boolean);
}

function unirAliasesV116_(valores) {
  const vistos = Object.create(null);
  const salida = [];
  valores.forEach(valor => {
    separarAliasesV116_(valor).forEach(item => {
      const clave = normalizar(item);
      if (clave && !vistos[clave]) { vistos[clave] = true; salida.push(item); }
    });
  });
  return salida.join(" | ");
}

function categoriaActivaV116_(filas, nombre) {
  return filas.some(fila => normalizar(fila[0]) === normalizar(nombre) && valorActivoV116_(fila[9]));
}

function resolverCategoriaV116_(ss, categoria, subcategoria) {
  const hoja = ss.getSheetByName("Categorías");
  const categoriaTexto = String(categoria || "").trim();
  const subcategoriaTexto = String(subcategoria || "").trim();
  if (!hoja || hoja.getLastRow() < 2) return null;
  const migrada = normalizar(hoja.getRange(1, 9).getValue()) === "categoriaid";
  if (!migrada) return { categoria: categoriaTexto, subcategoria: subcategoriaTexto };
  const filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, 14).getValues();
  const categoriaFila = filas.find(fila => valorActivoV116_(fila[9]) &&
    [fila[0]].concat(separarAliasesV116_(fila[12])).some(valor => normalizar(valor) === normalizar(categoriaTexto)));
  if (!categoriaFila) return null;
  if (!subcategoriaTexto) return { categoria: String(categoriaFila[0]), subcategoria: "" };
  const subcategoriaFila = filas.find(fila => valorActivoV116_(fila[11]) &&
    normalizar(fila[7]) === normalizar(categoriaFila[0]) &&
    [fila[1]].concat(separarAliasesV116_(fila[13])).some(valor => normalizar(valor) === normalizar(subcategoriaTexto)));
  return subcategoriaFila
    ? { categoria: String(categoriaFila[0]), subcategoria: String(subcategoriaFila[1]) }
    : null;
}

function valorActivoV116_(valor) {
  const clave = normalizar(valor);
  return valor !== false && !["false", "no", "inactivo", "0"].includes(clave);
}
