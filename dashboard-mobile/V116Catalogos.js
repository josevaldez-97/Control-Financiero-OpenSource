/************************************************************
 * DASHBOARD MOBILE V1.16 — CATÁLOGOS
 ************************************************************/

function obtenerCuentasCatalogoMobile_(ss) {
  const hoja = ss.getSheetByName("Cuentas");
  if (!hoja || hoja.getLastRow() < 2) {
    return MOBILE_CUENTAS_INGRESO.map((nombre, indice) => ({
      id: "", nombre: nombre, nombreSaldos: nombreCuentaSaldosMobileV116_(nombre),
      aliases: [nombre], saldoBase: 0, activa: true, filaSaldos: indice + 3,
      migrada: false
    }));
  }
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, 9).getValues()
    .filter(fila =>
      String(fila[0] || "").trim() &&
      normalizar_(fila[1]) !== "total" &&
      normalizar_(fila[2]) !== "total"
    )
    .map(fila => ({
      id: String(fila[0]), nombre: String(fila[1] || "").trim(),
      nombreSaldos: String(fila[2] || "").trim(),
      aliases: String(fila[3] || "").split("|").map(item => item.trim()).filter(Boolean),
      saldoBase: numero_(fila[4]), activa: valorActivoCatalogoMobileV116_(fila[5]),
      filaSaldos: Number(fila[6]) || 0, migrada: true
    }));
}

function confirmarCuentaMobileV116(datos) {
  try {
    const id = String((datos || {}).id || "").trim();
    const nombre = String((datos || {}).nombre || "").trim();
    if (!id && !nombre) return { ok: false, error: "No se recibió una cuenta para confirmar." };

    const ss = SpreadsheetApp.openById(MOBILE_SPREADSHEET_ID);
    const cuenta = obtenerCuentasCatalogoMobile_(ss).find(item =>
      (id && item.id === id) ||
      (!id && [item.nombre, item.nombreSaldos].concat(item.aliases || [])
        .some(alias => normalizar_(alias) === normalizar_(nombre)))
    );
    if (!cuenta || normalizar_(cuenta.nombreSaldos) === "total") {
      return { ok: false, error: "La cuenta no aparece en el catálogo actualizado." };
    }

    const hojaSaldos = ss.getSheetByName("Saldos");
    const filaSaldos = Number(cuenta.filaSaldos) || 0;
    if (!hojaSaldos || filaSaldos < 3 || filaSaldos > hojaSaldos.getLastRow()) {
      return { ok: false, error: "La cuenta no tiene una fila financiera válida." };
    }
    const fila = hojaSaldos.getRange(filaSaldos, 1, 1, 6).getValues()[0];
    if (
      normalizar_(fila[0]) === "total" ||
      normalizar_(fila[0]) !== normalizar_(cuenta.nombreSaldos)
    ) {
      return { ok: false, error: "La cuenta no coincide con su fila financiera." };
    }

    return {
      ok: true,
      cuenta: {
        id: cuenta.id,
        nombre: cuenta.nombre,
        nombreSaldos: cuenta.nombreSaldos,
        filaSaldos: filaSaldos,
        activa: cuenta.activa,
        saldo: numero_(fila[5])
      }
    };
  } catch (error) {
    return { ok: false, error: "No se pudo confirmar la cuenta en los datos actualizados." };
  }
}

function obtenerCategoriasAdministrablesMobile_(datos) {
  if (!datos.length) return { categorias: [], subcategorias: [], migrada: false };
  const migrada = normalizar_(datos[0][8]) === "categoriaid";
  const categorias = [];
  const subcategorias = [];
  datos.slice(1).forEach(fila => {
    const categoria = String(fila[0] || "").trim();
    const subcategoria = String(fila[1] || "").trim();
    if (categoria) categorias.push({
      id: String(fila[8] || ""), nombre: categoria,
      activa: valorActivoCatalogoMobileV116_(fila[9]), aliases: String(fila[12] || "")
    });
    if (subcategoria) subcategorias.push({
      id: String(fila[10] || ""), nombre: subcategoria,
      categoriaPadre: String(fila[7] || "").trim(),
      activa: valorActivoCatalogoMobileV116_(fila[11]), aliases: String(fila[13] || "")
    });
  });
  return { categorias: categorias, subcategorias: subcategorias, migrada: migrada };
}

function obtenerMapaAliasCategoriasMobileV116_(ss) {
  const hoja = ss.getSheetByName("Categorías");
  const mapa = Object.create(null);
  if (!hoja || hoja.getLastRow() < 2 || normalizar_(hoja.getRange(1, 9).getValue()) !== "categoriaid") return mapa;
  hoja.getRange(2, 1, hoja.getLastRow() - 1, 14).getDisplayValues().forEach(fila => {
    const nombre = String(fila[0] || "").trim();
    if (!nombre) return;
    [nombre].concat(String(fila[12] || "").split("|")).forEach(alias => {
      const clave = normalizar_(alias);
      if (clave) mapa[clave] = nombre;
    });
  });
  return mapa;
}

function resolverCuentaRegistroMobileV116_(valor, exigirActiva) {
  const clave = normalizar_(valor);
  if (!clave) return null;
  try {
    const ss = SpreadsheetApp.openById(MOBILE_SPREADSHEET_ID);
    const cuentas = obtenerCuentasCatalogoMobile_(ss);
    const cuenta = cuentas.find(item =>
      [item.nombre, item.nombreSaldos].concat(item.aliases || [])
        .some(alias => normalizar_(alias) === clave)
    );
    return cuenta && (!exigirActiva || cuenta.activa) ? cuenta : null;
  } catch (error) {
    return null;
  }
}

function cuentaRegistroValidaMobileV116_(valor) {
  return resolverCuentaRegistroMobileV116_(valor, true) !== null;
}

function medioGastoValidoMobileV116_(valor) {
  const texto = String(valor || "").trim();
  if (MOBILE_TARJETAS_PAGO.includes(texto) || ["Transferencia"].includes(texto)) return true;
  return cuentaRegistroValidaMobileV116_(texto);
}

function guardarCuentaMobile(datos) {
  try {
    validarObjetoRegistroMobile_(datos, "cuenta");
    const solicitud = {
      requestId: validarRequestIdMobile_(datos.requestId),
      id: String(datos.id || "").trim(),
      nombre: textoGastoMobile_(datos.nombre, "El nombre de la cuenta es obligatorio.", 80, true),
      saldoBase: numeroGastoMobile_(datos.saldoBase),
      activa: datos.activa !== false
    };
    if (!solicitud.id && !Number.isFinite(solicitud.saldoBase)) throw new Error("El saldo base no es válido.");
    return enviarOperacionBackendMobile_(solicitud, opcionesCatalogoMobileV116_(
      solicitud, "cuenta_mobile_", "guardarcuenta", "la cuenta", "Cuenta guardada"
    ));
  } catch (error) {
    return { ok: false, error: error.message || "La cuenta no es válida." };
  }
}

function guardarCategoriaMobile(datos) {
  return guardarElementoCategoriaMobileV116_(datos, false);
}

function guardarSubcategoriaMobile(datos) {
  return guardarElementoCategoriaMobileV116_(datos, true);
}

function guardarElementoCategoriaMobileV116_(datos, esSubcategoria) {
  try {
    validarObjetoRegistroMobile_(datos, esSubcategoria ? "subcategoría" : "categoría");
    const solicitud = {
      requestId: validarRequestIdMobile_(datos.requestId),
      id: String(datos.id || "").trim(),
      nombre: textoGastoMobile_(datos.nombre, "El nombre es obligatorio.", 80, true),
      categoriaPadre: String(datos.categoriaPadre || "").trim(),
      activa: datos.activa !== false
    };
    if (esSubcategoria && !solicitud.categoriaPadre) throw new Error("Selecciona una categoría padre.");
    return enviarOperacionBackendMobile_(solicitud, opcionesCatalogoMobileV116_(
      solicitud,
      esSubcategoria ? "subcategoria_mobile_" : "categoria_mobile_",
      esSubcategoria ? "guardarsubcategoria" : "guardarcategoria",
      esSubcategoria ? "la subcategoría" : "la categoría",
      esSubcategoria ? "Subcategoría guardada" : "Categoría guardada"
    ));
  } catch (error) {
    return { ok: false, error: error.message || "El catálogo no es válido." };
  }
}

function opcionesCatalogoMobileV116_(solicitud, prefijo, tipo, nombre, mensaje) {
  return {
    cachePrefix: prefijo,
    cacheSegundos: 900,
    payload: Object.assign({ tipo: tipo }, solicitud),
    configuracionError: "La administración de catálogos todavía no está configurada.",
    reservaError: "No fue posible asegurar la actualización de " + nombre + ".",
    rechazoError: "El backend rechazó la actualización de " + nombre + ".",
    inciertoError: "No se pudo confirmar la actualización de " + nombre + ". Actualiza antes de volver a intentarlo.",
    esRechazoDefinitivo: mensajeError => mensajeBackendIncluye_(mensajeError, [
      "invalido", "obligatoria", "no existe", "desactivada", "ya existe", "historial", "reservado", "migracion v1.16", "token invalido"
    ]),
    crearResultado: respuesta => ({
      ok: true, mensaje: String(respuesta.mensaje || mensaje).substring(0, 160),
      id: String(respuesta.id || "")
    })
  };
}

function nombreCuentaSaldosMobileV116_(nombre) {
  const mapa = {
    "Cuenta Ueno": "Ueno", "Cuenta Continental": "Banco Continental",
    "Cuenta Atlas": "Banco Atlas", "Cuenta GNB": "Banco GNB"
  };
  return mapa[nombre] || nombre;
}

function valorActivoCatalogoMobileV116_(valor) {
  const clave = normalizar_(valor);
  return valor !== false && !["false", "no", "inactivo", "0"].includes(clave);
}
