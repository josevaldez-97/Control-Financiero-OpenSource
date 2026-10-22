/************************************************************
 * DASHBOARD MOBILE V1.13 — PRESUPUESTOS
 ************************************************************/

const MOBILE_CACHE_PRESUPUESTO_SEGUNDOS = 600;

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

function clavePresupuestoMobileV113_(mes, categoria, claveCategoria) {
  return normalizarMesPresupuesto(mes) + "|" + claveCategoria(categoria);
}

function obtenerPresupuestosMobile_(ss, gastos) {
  const hoja = ss.getSheetByName("Presupuestos");
  if (!hoja || hoja.getLastRow() < 2) return [];

  const filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, 7).getValues();
  const gastoPorClave = Object.create(null);
  const aliasesCategorias = typeof obtenerMapaAliasCategoriasMobileV116_ === "function"
    ? obtenerMapaAliasCategoriasMobileV116_(ss)
    : Object.create(null);
  const claveCategoria = valor => normalizar_(aliasesCategorias[normalizar_(valor)] || valor);

  (gastos || []).forEach(gasto => {
    const mes = normalizarMesPresupuesto(gasto.fechaISO);
    if (!mes) return;
    const clave = clavePresupuestoMobileV113_(mes, gasto.categoria, claveCategoria);
    gastoPorClave[clave] = (gastoPorClave[clave] || 0) + numero_(gasto.monto);
  });

  const presupuestosPorClave = Object.create(null);

  filas
    .filter(fila => String(fila[1] || "").trim() && String(fila[2] || "").trim())
    .filter(fila => fila[4] !== false && normalizar_(fila[4]) !== "no" && normalizar_(fila[4]) !== "inactivo")
    .forEach(fila => {
      const mes = normalizarMesPresupuesto(fila[1]);
      const categoria = String(fila[2] || "").trim();
      if (!mes || !categoria) return;

      const clave = clavePresupuestoMobileV113_(mes, categoria, claveCategoria);
      if (presupuestosPorClave[clave]) {
        presupuestosPorClave[clave].duplicadosDetectados += 1;
        return;
      }

      const monto = numero_(fila[3]);
      const gastado = gastoPorClave[clave] || 0;
      const porcentaje = monto > 0 ? gastado / monto * 100 : 0;
      presupuestosPorClave[clave] = {
        id: String(fila[0] || ""),
        mes: mes,
        categoria: categoria,
        monto: monto,
        gastado: gastado,
        disponible: monto - gastado,
        porcentaje: porcentaje,
        porcentajeBarra: Math.min(100, Math.max(0, porcentaje)),
        estado: porcentaje >= 100 ? "excedido" : porcentaje >= 80 ? "proximo" : "normal",
        duplicadosDetectados: 0
      };
    });

  return Object.keys(presupuestosPorClave)
    .map(clave => presupuestosPorClave[clave])
    .sort((a, b) => b.mes.localeCompare(a.mes) || a.categoria.localeCompare(b.categoria, "es"));
}

function guardarPresupuestoMobile(datos) {
  try {
    validarObjetoRegistroMobile_(datos, "presupuesto");
    const solicitud = {
      requestId: validarRequestIdMobile_(datos.requestId),
      mes: normalizarMesPresupuesto(datos.mes),
      categoria: String(datos.categoria || "").trim(),
      monto: numeroGastoMobile_(datos.monto)
    };
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(solicitud.mes)) throw new Error("El mes no es válido.");
    if (!solicitud.categoria || solicitud.categoria.length > 80) throw new Error("La categoría no es válida.");
    if (!Number.isFinite(solicitud.monto) || solicitud.monto <= 0) throw new Error("El monto debe ser mayor que cero.");

    return enviarOperacionBackendMobile_(solicitud, {
      cachePrefix: "presupuesto_mobile_",
      cacheSegundos: MOBILE_CACHE_PRESUPUESTO_SEGUNDOS,
      payload: {
        tipo: "guardarpresupuesto",
        requestId: solicitud.requestId,
        mes: solicitud.mes,
        categoria: solicitud.categoria,
        monto: solicitud.monto
      },
      configuracionError: "Los presupuestos todavía no están configurados.",
      reservaError: "No fue posible asegurar el presupuesto.",
      rechazoError: "El backend rechazó el presupuesto.",
      inciertoError: "No se pudo confirmar el presupuesto. Actualiza antes de volver a guardarlo.",
      esRechazoDefinitivo: mensaje => mensajeBackendIncluye_(mensaje, [
        "mes invalido", "categoria invalida", "monto invalido", "migracion v1.13", "token invalido"
      ]),
      crearResultado: respuesta => ({
        ok: true,
        mensaje: String(respuesta.mensaje || "Presupuesto guardado").substring(0, 160),
        mes: solicitud.mes,
        categoria: solicitud.categoria,
        monto: solicitud.monto
      })
    });
  } catch (error) {
    return { ok: false, error: error.message || "El presupuesto no es válido." };
  }
}
