/************************************************************
 * DASHBOARD MOBILE V1.14 — OBLIGACIONES
 ************************************************************/

const MOBILE_CACHE_OBLIGACION_SEGUNDOS = 600;

function obtenerObligacionesMobile_(ss) {
  const hoja = ss.getSheetByName("Obligaciones");
  const hojaPagos = ss.getSheetByName("Pagos obligaciones");
  const pagos = !hojaPagos || hojaPagos.getLastRow() < 2 ? [] :
    hojaPagos.getRange(2, 1, hojaPagos.getLastRow() - 1, 9).getValues()
      .filter(fila => normalizar_(fila[5]) === "pagado")
      .map(fila => ({
        requestId: String(fila[0] || ""),
        obligacionId: String(fila[1] || ""),
        vencimiento: fechaInfo_(fila[2]).iso,
        fecha: fechaInfo_(fila[3]).texto,
        monto: numero_(fila[4]),
        estado: "Pagado"
      }));

  if (!hoja || hoja.getLastRow() < 2) return { obligaciones: [], pagos: pagos };
  const ultimoPago = Object.create(null);
  pagos.forEach(pago => { ultimoPago[pago.obligacionId] = pago; });

  const obligaciones = hoja.getRange(2, 1, hoja.getLastRow() - 1, 11).getValues()
    .filter(fila => String(fila[0] || "").trim())
    .map(fila => {
      const vence = fechaInfo_(fila[7]);
      return {
        id: String(fila[0]),
        nombre: String(fila[1] || ""),
        categoria: String(fila[2] || ""),
        subcategoria: String(fila[3] || ""),
        medioPago: String(fila[4] || ""),
        monto: numero_(fila[5]),
        frecuencia: String(fila[6] || ""),
        vencimiento: vence.texto,
        vencimientoISO: vence.iso,
        vencimientoOrden: vence.timestamp,
        activo: fila[8] !== false,
        estado: fila[8] === false ? "Pagado" : "Pendiente",
        ultimoPago: ultimoPago[String(fila[0])] || null
      };
    })
    .sort((a, b) => a.vencimientoOrden - b.vencimientoOrden);
  return { obligaciones: obligaciones, pagos: pagos };
}

function guardarObligacionMobile(datos) {
  return enviarObligacionMobile_(datos, false);
}

function pagarObligacionMobile(datos) {
  try {
    validarObjetoRegistroMobile_(datos, "pago de obligación");
    const solicitud = {
      requestId: validarRequestIdMobile_(datos.requestId),
      obligacionId: String(datos.obligacionId || "").trim(),
      fecha: validarFechaGastoMobile_(datos.fecha)
    };
    if (!solicitud.obligacionId) throw new Error("La obligación no es válida.");
    return enviarOperacionBackendMobile_(solicitud, opcionesObligacionMobile_(
      "pago_obligacion_mobile_",
      { tipo: "pagarobligacion", requestId: solicitud.requestId, obligacionId: solicitud.obligacionId, fecha: solicitud.fecha },
      "El pago de la obligación"
    ));
  } catch (error) {
    return { ok: false, error: error.message || "El pago no es válido." };
  }
}

function enviarObligacionMobile_(datos) {
  try {
    validarObjetoRegistroMobile_(datos, "obligación");
    const solicitud = {
      requestId: validarRequestIdMobile_(datos.requestId),
      id: String(datos.id || "").trim(),
      nombre: String(datos.nombre || "").trim(),
      categoria: String(datos.categoria || "").trim(),
      subcategoria: String(datos.subcategoria || "").trim(),
      medioPago: validarCuentaObligacionMobile_(datos.medioPago),
      monto: numeroGastoMobile_(datos.monto),
      frecuencia: String(datos.frecuencia || "").trim(),
      vencimiento: validarFechaGastoMobile_(datos.vencimiento),
      activo: datos.activo !== false
    };
    if (!solicitud.nombre || solicitud.nombre.length > 120) throw new Error("El nombre no es válido.");
    if (!solicitud.categoria || solicitud.categoria.length > 80) throw new Error("La categoría no es válida.");
    if (!Number.isFinite(solicitud.monto) || solicitud.monto <= 0) throw new Error("El monto debe ser mayor que cero.");
    if (!["Mensual", "Semanal", "Anual", "Única"].includes(solicitud.frecuencia)) throw new Error("La frecuencia no es válida.");

    return enviarOperacionBackendMobile_(solicitud, opcionesObligacionMobile_(
      "obligacion_mobile_",
      { tipo: "guardarobligacion", ...solicitud },
      "La obligación"
    ));
  } catch (error) {
    return { ok: false, error: error.message || "La obligación no es válida." };
  }
}

function validarCuentaObligacionMobile_(valor) {
  const medio = String(valor || "").trim();
  const valido = typeof medioGastoValidoMobileV116_ === "function"
    ? medioGastoValidoMobileV116_(medio)
    : MOBILE_MEDIOS_GASTO.includes(medio);
  if (!valido) throw new Error("El medio de pago no es válido.");
  return medio;
}

function opcionesObligacionMobile_(prefijo, payload, nombre) {
  return {
    cachePrefix: prefijo,
    cacheSegundos: MOBILE_CACHE_OBLIGACION_SEGUNDOS,
    payload: payload,
    configuracionError: nombre + " todavía no está configurada.",
    reservaError: "No fue posible asegurar la operación.",
    rechazoError: "El backend rechazó la operación.",
    inciertoError: "No se pudo confirmar la operación. Actualiza antes de volver a intentarlo.",
    esRechazoDefinitivo: mensaje => mensajeBackendIncluye_(mensaje, [
      "invalido", "invalida", "no existe", "no esta activa", "ya estaba pagado", "migracion v1.14", "token invalido"
    ]),
    crearResultado: respuesta => ({
      ok: true,
      duplicado: respuesta.duplicado === true,
      mensaje: String(respuesta.mensaje || nombre + " fue registrada.").substring(0, 160)
    })
  };
}
