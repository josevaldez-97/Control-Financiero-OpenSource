/************************************************************
 * DASHBOARD MOBILE V1.17 — METAS DE AHORRO
 ************************************************************/

const MOBILE_CACHE_META_SEGUNDOS = 900;

function obtenerMetasMobile_(ss, cuentasCatalogo) {
  const hoja = ss.getSheetByName("Metas ahorro");
  const aportesHoja = ss.getSheetByName("Aportes metas");
  if (!hoja || hoja.getLastRow() < 2) return [];
  const aportes = aportesHoja && aportesHoja.getLastRow() > 1
    ? aportesHoja.getRange(2, 1, aportesHoja.getLastRow() - 1, 6).getValues()
    : [];
  const acumulado = Object.create(null);
  aportes.forEach(fila => {
    const id = String(fila[1] || "");
    acumulado[id] = (acumulado[id] || 0) + numero_(fila[3]);
  });
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, 8).getValues()
    .filter(fila => String(fila[0] || "").trim())
    .map(fila => {
      const id = String(fila[0]);
      const objetivo = numero_(fila[2]);
      const aportado = acumulado[id] || 0;
      const porcentaje = objetivo > 0 ? aportado / objetivo * 100 : 0;
      const canonico = String(fila[3] || "").trim();
      const cuenta = (cuentasCatalogo || []).find(item => normalizar_(item.nombreSaldos) === normalizar_(canonico));
      const fecha = fechaInfo_(fila[4]);
      return {
        id: id, nombre: String(fila[1] || ""), montoObjetivo: objetivo,
        cuenta: cuenta ? cuenta.nombre : canonico, fechaObjetivo: fecha.texto,
        fechaObjetivoISO: fecha.iso,
        activa: typeof valorActivoCatalogoMobileV116_ === "function"
          ? valorActivoCatalogoMobileV116_(fila[5])
          : fila[5] !== false,
        aportado: aportado, restante: objetivo - aportado,
        porcentaje: porcentaje, porcentajeBarra: Math.min(100, Math.max(0, porcentaje))
      };
    });
}

function guardarMetaMobile(datos) {
  return enviarMetaMobileV117_(datos, false);
}

function registrarAporteMetaMobile(datos) {
  return enviarMetaMobileV117_(datos, true);
}

function enviarMetaMobileV117_(datos, esAporte) {
  try {
    validarObjetoRegistroMobile_(datos, esAporte ? "aporte" : "meta");
    const requestId = validarRequestIdMobile_(datos.requestId);
    const solicitud = esAporte ? {
      requestId: requestId,
      metaId: String(datos.metaId || "").trim(),
      monto: numeroGastoMobile_(datos.monto),
      fecha: validarFechaGastoMobile_(datos.fecha),
      nota: textoGastoMobile_(datos.nota, "", 240, false)
    } : {
      requestId: requestId,
      id: String(datos.id || "").trim(),
      nombre: textoGastoMobile_(datos.nombre, "El nombre es obligatorio.", 120, true),
      montoObjetivo: numeroGastoMobile_(datos.montoObjetivo),
      cuenta: validarCuentaRegistroMobile_(datos.cuenta, "La cuenta vinculada no es válida."),
      fechaObjetivo: validarFechaGastoMobile_(datos.fechaObjetivo),
      activa: datos.activa !== false
    };
    if (esAporte && !solicitud.metaId) throw new Error("La meta no es válida.");
    const monto = esAporte ? solicitud.monto : solicitud.montoObjetivo;
    if (!Number.isFinite(monto) || monto <= 0) throw new Error("El monto debe ser mayor que cero.");
    return enviarOperacionBackendMobile_(solicitud, {
      cachePrefix: esAporte ? "aporte_meta_mobile_" : "meta_mobile_",
      cacheSegundos: MOBILE_CACHE_META_SEGUNDOS,
      payload: Object.assign({ tipo: esAporte ? "aportemeta" : "guardarmeta" }, solicitud),
      configuracionError: "Las metas todavía no están configuradas.",
      reservaError: "No fue posible asegurar la actualización de la meta.",
      rechazoError: "El backend rechazó la actualización de la meta.",
      inciertoError: "No se pudo confirmar la operación. Actualiza las metas antes de volver a intentarlo.",
      esRechazoDefinitivo: mensaje => mensajeBackendIncluye_(mensaje, [
        "invalido", "no existe", "desactivada", "migracion v1.17", "token invalido"
      ]),
      crearResultado: respuesta => ({
        ok: true, duplicado: respuesta.duplicado === true,
        mensaje: String(respuesta.mensaje || (esAporte ? "Aporte registrado" : "Meta guardada")).substring(0, 160)
      })
    });
  } catch (error) {
    return { ok: false, error: error.message || "La meta no es válida." };
  }
}
