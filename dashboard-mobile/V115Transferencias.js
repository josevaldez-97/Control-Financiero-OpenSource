/************************************************************
 * DASHBOARD MOBILE V1.15 — TRANSFERENCIAS
 ************************************************************/

const MOBILE_CACHE_TRANSFERENCIA_SEGUNDOS = 900;

function obtenerTransferenciasMobile_(ss) {
  const hoja = ss.getSheetByName("Transferencias");
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, 8).getValues()
    .filter(fila => normalizar_(fila[6]) === "aplicada")
    .map(fila => {
      const fecha = fechaInfo_(fila[1]);
      return {
        requestId: String(fila[0] || ""),
        fecha: fecha.texto,
        fechaISO: fecha.iso,
        timestamp: fecha.timestamp,
        cuentaOrigen: String(fila[2] || ""),
        cuentaDestino: String(fila[3] || ""),
        monto: numero_(fila[4]),
        observacion: String(fila[5] || "")
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

function aplicarTransferenciasMobileASaldos_(cuentas, transferencias) {
  const porCuenta = Object.create(null);
  cuentas.forEach(cuenta => { porCuenta[normalizar_(cuenta.cuenta)] = cuenta; });
  (transferencias || []).forEach(item => {
    const origen = porCuenta[normalizar_(item.cuentaOrigen)];
    const destino = porCuenta[normalizar_(item.cuentaDestino)];
    if (origen) origen.saldo -= item.monto;
    if (destino) destino.saldo += item.monto;
  });
  return cuentas;
}

function obtenerMovimientosTransferenciasMobile_(transferencias) {
  return (transferencias || []).map((item, indice) => ({
    id: "transferencia-" + (item.requestId || indice),
    tipo: "transferencia",
    fecha: item.fecha,
    fechaISO: item.fechaISO,
    timestamp: item.timestamp,
    titulo: "Transferencia",
    subtitulo: item.cuentaOrigen + " → " + item.cuentaDestino,
    categoria: "Transferencia interna",
    cuenta: item.cuentaOrigen,
    cuentaDestino: item.cuentaDestino,
    monto: item.monto,
    observacion: item.observacion
  }));
}

function registrarTransferenciaMobile(datos) {
  try {
    validarObjetoRegistroMobile_(datos, "transferencia");
    const solicitud = {
      requestId: validarRequestIdMobile_(datos.requestId),
      cuentaOrigen: validarCuentaRegistroMobile_(datos.cuentaOrigen, "La cuenta de origen no es válida."),
      cuentaDestino: validarCuentaRegistroMobile_(datos.cuentaDestino, "La cuenta de destino no es válida."),
      monto: numeroGastoMobile_(datos.monto),
      fecha: validarFechaGastoMobile_(datos.fecha),
      observacion: textoGastoMobile_(datos.observacion, "", 240, false)
    };
    if (solicitud.cuentaOrigen === solicitud.cuentaDestino) throw new Error("Las cuentas deben ser diferentes.");
    if (!Number.isFinite(solicitud.monto) || solicitud.monto <= 0) throw new Error("El monto debe ser mayor que cero.");

    return enviarOperacionBackendMobile_(solicitud, {
      cachePrefix: "transferencia_mobile_",
      cacheSegundos: MOBILE_CACHE_TRANSFERENCIA_SEGUNDOS,
      payload: { tipo: "transferencia", ...solicitud },
      configuracionError: "Las transferencias todavía no están configuradas.",
      reservaError: "No fue posible asegurar la transferencia.",
      rechazoError: "El backend rechazó la transferencia.",
      inciertoError: "No se pudo confirmar la transferencia. Actualiza ambas cuentas antes de volver a intentarlo.",
      esRechazoDefinitivo: mensaje => mensajeBackendIncluye_(mensaje, [
        "cuenta invalida", "cuentas deben ser diferentes", "monto invalido", "fecha invalida", "migracion v1.15", "token invalido"
      ]),
      crearResultado: respuesta => ({
        ok: true,
        duplicado: respuesta.duplicado === true,
        mensaje: String(respuesta.mensaje || "Transferencia registrada").substring(0, 160)
      })
    });
  } catch (error) {
    return { ok: false, error: error.message || "La transferencia no es válida." };
  }
}
