/************************************************************
 * CONTROL FINANCIERO PERSONAL
 * DASHBOARD MOBILE V1.18.5
 * VISUALIZACIÓN + CENTRO DE REGISTROS
 *
 * NO MODIFICA:
 * - Atajos iPhone
 * - Fórmulas de las hojas
 *
 * Operaciones terminadas: gasto, ingreso, pago de tarjeta
 * y pago de cuota, siempre a través del backend V2.
 ************************************************************/

const MOBILE_SPREADSHEET_ID =
  "REEMPLAZAR_CON_ID_DE_TU_HOJA";

const MOBILE_TZ =
  "America/Asuncion";


const MOBILE_MEDIOS_GASTO = [
  "Efectivo",
  "Cuenta Ueno",
  "Cuenta Continental",
  "Cuenta Atlas",
  "Cuenta GNB",
  "Tarjeta Ueno",
  "Tarjeta Continental",
  "Tarjeta GNB",
  "Transferencia",
  "Otro"
];


const MOBILE_CACHE_GASTO_SEGUNDOS =
  21600;


const MOBILE_CUENTAS_INGRESO = [
  "Efectivo",
  "Cuenta Ueno",
  "Cuenta Continental",
  "Cuenta Atlas",
  "Cuenta GNB",
  "Otro"
];


const MOBILE_CACHE_INGRESO_SEGUNDOS =
  21600;


const MOBILE_TARJETAS_PAGO = [
  "Tarjeta Ueno",
  "Tarjeta Continental",
  "Tarjeta GNB"
];


const MOBILE_ENTIDADES_CUOTA = [
  "Banco Atlas",
  "Medalla Milagrosa",
  "Cooperativa San Cristóbal"
];


const MOBILE_CACHE_TARJETA_SEGUNDOS =
  21600;


const MOBILE_CACHE_CUOTA_SEGUNDOS =
  21600;


/************************************************************
 * WEB
 ************************************************************/

function doGet() {

  return HtmlService
    .createTemplateFromFile("index")
    .evaluate()
    .setTitle("Control Financiero")
    .addMetaTag(
      "viewport",
      "width=device-width, initial-scale=1, viewport-fit=cover"
    )
    .addMetaTag(
      "apple-mobile-web-app-capable",
      "yes"
    )
    .addMetaTag(
      "mobile-web-app-capable",
      "yes"
    )
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );
}


/************************************************************
 * REGISTRAR GASTO DESDE EL DASHBOARD
 ************************************************************/

function registrarGastoMobile(
  datos
) {

  let solicitud;


  try {

    solicitud =
      validarGastoMobile_(
        datos
      );

  } catch (error) {

    return {
      ok: false,
      error:
        error.message ||
        "Los datos del gasto no son válidos."
    };
  }


  const propiedades =
    PropertiesService
      .getScriptProperties();


  const backendUrl =
    String(
      propiedades.getProperty(
        "BACKEND_V2_URL"
      ) ||
      ""
    ).trim();


  const backendToken =
    String(
      propiedades.getProperty(
        "BACKEND_V2_TOKEN"
      ) ||
      ""
    );


  if (
    !backendUrl ||
    !backendToken
  ) {

    return {
      ok: false,
      error:
        "El registro de gastos todavía no está configurado."
    };
  }


  if (
    !/^https:\/\//i.test(
      backendUrl
    )
  ) {

    return {
      ok: false,
      error:
        "La configuración del registro no es válida."
    };
  }


  const cache =
    CacheService
      .getScriptCache();


  const cacheKey =
    "gasto_mobile_" +
    solicitud.requestId;


  const lock =
    LockService
      .getScriptLock();


  try {

    lock.waitLock(
      10000
    );


    const guardado =
      cache.get(
        cacheKey
      );


    if (guardado) {

      if (
        guardado.indexOf(
          "completado:"
        ) === 0
      ) {

        return JSON.parse(
          guardado.substring(
            11
          )
        );
      }


      return {
        ok: false,
        incierto: true,
        duplicado: true,
        error:
          "Esta solicitud ya fue enviada. Verifica Movimientos antes de intentar registrarla nuevamente."
      };
    }


    cache.put(
      cacheKey,
      "procesando",
      MOBILE_CACHE_GASTO_SEGUNDOS
    );

  } catch (error) {

    return {
      ok: false,
      error:
        "No fue posible asegurar el envío. Intenta nuevamente antes de confirmar el gasto."
    };

  } finally {

    if (
      lock.hasLock()
    ) {
      lock.releaseLock();
    }
  }


  const payload = {
    token:
      backendToken,
    tipo:
      "gasto",
    monto:
      solicitud.monto,
    medioPago:
      solicitud.medioPago,
    fecha:
      solicitud.fecha,
    categoria:
      solicitud.categoria,
    subcategoria:
      solicitud.subcategoria,
    descripcion:
      solicitud.descripcion,
    observacion:
      solicitud.observacion
  };


  try {

    const respuestaHttp =
      ejecutarSolicitudBackendMobile_(
        backendUrl,
        payload
      );


    const analisis =
      analizarRespuestaBackendMobile_(
        respuestaHttp,
        backendUrl,
        backendToken,
        esRechazoDefinitivoGasto_
      );


    if (!analisis.ok) {

      if (analisis.incierto) {

        guardarCacheGastoSilencioso_(
          cache,
          cacheKey,
          "incierto",
          MOBILE_CACHE_GASTO_SEGUNDOS
        );


        return respuestaInciertaGasto_(
          analisis.codigo,
          analisis.error
        );
      }

      eliminarCacheGastoSilencioso_(
        cache,
        cacheKey
      );


      return {
        ok: false,
        estadoEscritura:
          analisis.estadoEscritura,
        codigo:
          analisis.codigo,
        error:
          analisis.error ||
          "El backend rechazó el gasto."
      };
    }


    const resultado = {
      ok: true,
      estadoEscritura:
        "WRITE_CONFIRMED",
      mensaje:
        "Gasto registrado",
      monto:
        solicitud.monto,
      medioPago:
        solicitud.medioPago,
      fecha:
        solicitud.fecha
    };


    guardarCacheGastoSilencioso_(
      cache,
      cacheKey,
      "completado:" +
        JSON.stringify(
          resultado
        ),
      MOBILE_CACHE_GASTO_SEGUNDOS
    );


    return resultado;

  } catch (error) {

    guardarCacheGastoSilencioso_(
      cache,
      cacheKey,
      "incierto",
      MOBILE_CACHE_GASTO_SEGUNDOS
    );


    return respuestaInciertaGasto_(
      "BACKEND_TRANSPORT_ERROR",
      "No se pudo comunicar con el Backend. El resultado del gasto no puede confirmarse."
    );
  }
}


function validarGastoMobile_(
  datos
) {

  if (
    !datos ||
    typeof datos !==
      "object" ||
    Array.isArray(
      datos
    )
  ) {
    throw new Error(
      "Los datos del gasto no son válidos."
    );
  }


  const requestId =
    String(
      datos.requestId ||
      ""
    ).trim();


  if (
    !/^[A-Za-z0-9-]{16,80}$/.test(
      requestId
    )
  ) {
    throw new Error(
      "La identificación de la solicitud no es válida."
    );
  }


  const monto =
    numeroGastoMobile_(
      datos.monto
    );


  if (
    !Number.isFinite(
      monto
    ) ||
    monto <= 0
  ) {
    throw new Error(
      "El monto debe ser mayor que cero."
    );
  }


  const medioPago =
    String(
      datos.medioPago ||
      ""
    ).trim();


  if (
    !medioGastoValidoMobileV116_(
      medioPago
    )
  ) {
    throw new Error(
      "El medio de pago no es válido."
    );
  }


  return {
    requestId:
      requestId,
    monto:
      monto,
    medioPago:
      medioPago,
    fecha:
      validarFechaGastoMobile_(
        datos.fecha
      ),
    categoria:
      textoGastoMobile_(
        datos.categoria,
        "La categoría es obligatoria.",
        80,
        true
      ),
    subcategoria:
      textoGastoMobile_(
        datos.subcategoria,
        "La subcategoría es obligatoria.",
        80,
        true
      ),
    descripcion:
      textoGastoMobile_(
        datos.descripcion,
        "La descripción es obligatoria.",
        160,
        true
      ),
    observacion:
      textoGastoMobile_(
        datos.observacion,
        "",
        300,
        false
      )
  };
}


function validarFechaGastoMobile_(
  valor
) {

  const fechaNormalizada =
    normalizarFechaMobile_(
      valor
    );


  if (!fechaNormalizada) {

    const texto =
      String(
        valor == null
          ? ""
          : valor
      ).trim();


    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        texto
      ) ||
      /^\d{2}\/\d{2}\/\d{4}$/.test(
        texto
      )
    ) {
      throw new Error(
        "La fecha ingresada no existe."
      );
    }


    throw new Error(
      "La fecha debe tener el formato DD/MM/AAAA o AAAA-MM-DD."
    );
  }


  return fechaNormalizada;
}


function normalizarFechaMobile_(
  valor
) {

  let texto;


  if (
    Object.prototype.toString.call(
      valor
    ) === "[object Date]" &&
    !isNaN(
      valor.getTime()
    )
  ) {
    texto =
      Utilities.formatDate(
        valor,
        MOBILE_TZ,
        "dd/MM/yyyy"
      );
  } else {
    texto =
      String(
        valor == null
          ? ""
          : valor
      ).trim();
  }


  const coincidenciaISO =
    texto.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );


  const coincidenciaLocal =
    texto.match(
      /^(\d{2})\/(\d{2})\/(\d{4})$/
    );


  if (
    !coincidenciaISO &&
    !coincidenciaLocal
  ) return "";


  const dia =
    Number(
      coincidenciaISO
        ? coincidenciaISO[3]
        : coincidenciaLocal[1]
    );

  const mes =
    Number(
      coincidenciaISO
        ? coincidenciaISO[2]
        : coincidenciaLocal[2]
    );

  const anio =
    Number(
      coincidenciaISO
        ? coincidenciaISO[1]
        : coincidenciaLocal[3]
    );


  const fecha =
    new Date(
      anio,
      mes - 1,
      dia,
      12,
      0,
      0
    );


  if (
    fecha.getFullYear() !==
      anio ||
    fecha.getMonth() !==
      mes - 1 ||
    fecha.getDate() !==
      dia
  ) {
    return "";
  }


  return [
    String(dia).padStart(2, "0"),
    String(mes).padStart(2, "0"),
    String(anio).padStart(4, "0")
  ].join("/");
}


function numeroGastoMobile_(
  valor
) {

  if (
    typeof valor ===
      "number"
  ) {
    return valor;
  }


  let texto =
    String(
      valor === undefined ||
      valor === null
        ? ""
        : valor
    )
      .replace(
        /Gs\.?/gi,
        ""
      )
      .replace(
        /\s/g,
        ""
      )
      .trim();


  if (
    /^\d{1,3}(\.\d{3})+$/.test(
      texto
    )
  ) {
    texto =
      texto.replace(
        /\./g,
        ""
      );
  }


  if (
    /^\d{1,3}(,\d{3})+$/.test(
      texto
    )
  ) {
    texto =
      texto.replace(
        /,/g,
        ""
      );
  }


  return Number(
    texto
  );
}


function textoGastoMobile_(
  valor,
  mensajeObligatorio,
  maximo,
  obligatorio
) {

  if (
    valor !== undefined &&
    valor !== null &&
    typeof valor !==
      "string"
  ) {
    throw new Error(
      "Uno de los textos enviados no es válido."
    );
  }

  const texto =
    String(
      valor ||
      ""
    ).trim();


  if (
    obligatorio &&
    !texto
  ) {
    throw new Error(
      mensajeObligatorio
    );
  }


  if (
    texto.length >
      maximo
  ) {
    throw new Error(
      "Uno de los textos supera la longitud permitida."
    );
  }


  return texto;
}


function limpiarMensajeBackend_(
  mensaje,
  backendUrl,
  backendToken
) {

  let texto =
    String(
      mensaje ||
      ""
    ).substring(
      0,
      240
    );


  [
    backendUrl,
    backendToken
  ].forEach(
    secreto => {

      if (secreto) {
        texto =
          texto.split(
            secreto
          ).join(
            "[dato protegido]"
          );
      }
    }
  );


  return texto;
}


function ejecutarSolicitudBackendMobile_(
  backendUrl,
  payload
) {

  const respuestaInicial =
    UrlFetchApp.fetch(
      backendUrl,
      {
        method:
          "post",
        contentType:
          "application/json",
        payload:
          JSON.stringify(
            payload
          ),
        followRedirects:
          false,
        muteHttpExceptions:
          true
      }
    );

  const estadoInicial =
    Number(
      respuestaInicial.getResponseCode()
    );


  if (
    estadoInicial !== 302 &&
    estadoInicial !== 303
  ) {
    return respuestaInicial;
  }


  const encabezados =
    respuestaInicial.getHeaders();

  const ubicacion =
    String(
      encabezados.Location ||
      encabezados.location ||
      ""
    ).trim();


  if (
    !/^https:\/\/script\.googleusercontent\.com(?:\/|$)/i.test(
      ubicacion
    )
  ) {
    return respuestaInicial;
  }


  return UrlFetchApp.fetch(
    ubicacion,
    {
      method:
        "get",
      followRedirects:
        false,
      muteHttpExceptions:
        true
    }
  );
}


function analizarRespuestaBackendMobile_(
  respuestaHttp,
  backendUrl,
  backendToken,
  esRechazoDefinitivo
) {

  const estadoHttp =
    Number(
      respuestaHttp.getResponseCode()
    );

  const contenido =
    String(
      respuestaHttp.getContentText() ||
      ""
    );

  const pareceHtml =
    /<!doctype\s+html|<html\b|<body\b|<form\b/i.test(
      contenido
    ) ||
    /servicelogin|accounts\.google\.com/i.test(
      contenido
    );


  if (pareceHtml) {
    return {
      ok: false,
      incierto: true,
      estadoEscritura:
        "WRITE_UNCERTAIN",
      codigo:
        "BACKEND_AUTH_HTML",
      error:
        "El Backend respondió con una pantalla de autenticación en lugar de JSON."
    };
  }


  if (
    estadoHttp < 200 ||
    estadoHttp >= 300
  ) {
    return {
      ok: false,
      incierto: true,
      estadoEscritura:
        "WRITE_UNCERTAIN",
      codigo:
        "BACKEND_HTTP_ERROR",
      estadoHttp:
        estadoHttp,
      error:
        "El Backend respondió con un estado HTTP no exitoso (" +
        estadoHttp +
        ")."
    };
  }


  let respuesta;


  try {
    respuesta =
      JSON.parse(
        contenido
      );
  } catch (error) {
    return {
      ok: false,
      incierto: true,
      estadoEscritura:
        "WRITE_UNCERTAIN",
      codigo:
        "BACKEND_INVALID_JSON",
      error:
        "El Backend respondió con contenido que no es JSON válido."
    };
  }


  if (
    !respuesta ||
    typeof respuesta !==
      "object" ||
    Array.isArray(
      respuesta
    ) ||
    typeof respuesta.ok !==
      "boolean"
  ) {
    return {
      ok: false,
      incierto: true,
      estadoEscritura:
        "WRITE_UNCERTAIN",
      codigo:
        "BACKEND_INVALID_JSON",
      error:
        "El Backend devolvió un JSON con una estructura inesperada."
    };
  }


  if (respuesta.ok !== true) {

    const mensaje =
      limpiarMensajeBackend_(
        respuesta.error,
        backendUrl,
        backendToken
      ) ||
      "El Backend no confirmó la operación.";


    const estadoBackend =
      String(
        respuesta.estadoEscritura ||
        ""
      );


    const inciertoExplicito =
      respuesta.incierto === true ||
      estadoBackend ===
        "WRITE_UNCERTAIN";


    let rechazoDefinitivo =
      !inciertoExplicito &&
      (
        respuesta.incierto === false ||
        estadoBackend ===
          "WRITE_REJECTED" ||
        typeof esRechazoDefinitivo !==
          "function"
      );


    if (
      !inciertoExplicito &&
      !rechazoDefinitivo &&
      typeof esRechazoDefinitivo ===
        "function"
    ) {
      try {
        rechazoDefinitivo =
          esRechazoDefinitivo(
            mensaje
          ) === true;
      } catch (error) {
        rechazoDefinitivo =
          false;
      }
    }


    if (!rechazoDefinitivo) {
      return {
        ok: false,
        incierto: true,
        estadoEscritura:
          "WRITE_UNCERTAIN",
        codigo:
          String(
            respuesta.codigo ||
            "BACKEND_UNCERTAIN"
          ).substring(0, 80),
        error:
          mensaje
      };
    }


    return {
      ok: false,
      incierto: false,
      estadoEscritura:
        "WRITE_REJECTED",
      codigo:
        String(
          respuesta.codigo ||
          "BACKEND_REJECTED"
        ).substring(0, 80),
      error:
        mensaje
    };
  }


  return {
    ok: true,
    estadoEscritura:
      "WRITE_CONFIRMED",
    respuesta:
      respuesta
  };
}


function guardarCacheGastoSilencioso_(
  cache,
  clave,
  valor,
  segundos
) {

  try {

    cache.put(
      clave,
      valor,
      segundos
    );

  } catch (error) {}
}


function eliminarCacheGastoSilencioso_(
  cache,
  clave
) {

  try {

    cache.remove(
      clave
    );

  } catch (error) {}
}


function esRechazoDefinitivoGasto_(
  mensaje
) {

  const normalizado =
    String(
      mensaje ||
      ""
    )
      .toLowerCase()
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );


  return [
    "monto invalido",
    "medio de pago invalido",
    "categoria o subcategoria invalida",
    "token invalido",
    "tipo de operacion no reconocido"
  ].some(
    texto =>
      normalizado.includes(
        texto
      )
  );
}


function respuestaInciertaGasto_(
  codigo,
  mensaje
) {

  return {
    ok: false,
    incierto: true,
    estadoEscritura:
      "WRITE_UNCERTAIN",
    codigo:
      codigo ||
      "BACKEND_TRANSPORT_ERROR",
    error:
      mensaje ||
      "No se pudo confirmar el resultado. El gasto podría haberse registrado. Verifica Movimientos antes de volver a registrarlo."
  };
}


/************************************************************
 * DASHBOARD COMPLETO
 ************************************************************/

function obtenerMobileDashboard() {

  const inicioMedicion =
    Date.now();

  const ss =
    SpreadsheetApp.openById(
      MOBILE_SPREADSHEET_ID
    );

  const cuentasCatalogo =
    obtenerCuentasCatalogoMobile_(
      ss
    );

  const transferencias =
    obtenerTransferenciasMobile_(ss);

  const saldos =
    obtenerSaldos_(
      ss,
      transferencias,
      cuentasCatalogo
    );

  const gastos =
    obtenerGastos_(ss);

  const ingresos =
    obtenerIngresos_(ss);

  const pagosTarjetas =
    obtenerPagosTarjetas_(ss);

  const cuotas =
    obtenerCuotas_(ss);

  const tarjetas =
    obtenerTarjetas_(ss);

  const resumenMes =
    obtenerResumenMes_(
      gastos,
      ingresos
    );

  const movimientos =
    obtenerMovimientos_(
      gastos,
      ingresos,
      pagosTarjetas
    )
      .concat(
        obtenerMovimientosTransferenciasMobile_(
          transferencias
        )
      )
      .sort(
        (a, b) =>
          b.timestamp - a.timestamp
      );

  const categorias =
    obtenerGastosCategorias_(
      gastos
    );

  const medios =
    obtenerGastosMedios_(
      gastos
    );

  const estadisticas =
    obtenerEstadisticasMensuales_(
      gastos,
      ingresos,
      6
    );

  const prestamos =
    obtenerResumenPrestamos_(
      cuotas
    );

  const catalogosRegistro =
    obtenerCatalogosRegistro_(
      ss,
      cuentasCatalogo
    );

  const presupuestos =
    obtenerPresupuestosMobile_(
      ss,
      gastos
    );

  const obligaciones =
    obtenerObligacionesMobile_(
      ss
    );

  const metas =
    obtenerMetasMobile_(
      ss,
      cuentasCatalogo
    );


  const respuesta = {

    version:
      "V1.18.5",

    actualizado:
      Utilities.formatDate(
        new Date(),
        MOBILE_TZ,
        "dd/MM/yyyy HH:mm"
      ),

    resumen: {

      disponible:
        saldos.total,

      ingresos:
        resumenMes.ingresos,

      gastos:
        resumenMes.gastos,

      balance:
        resumenMes.balance,

      mes:
        resumenMes.mes
    },

    cuentas:
      saldos.cuentas,

    cuentasCatalogo:
      cuentasCatalogo,

    movimientos:
      movimientos,

    pagosTarjetas:
      pagosTarjetas,

    transferencias:
      transferencias,

    tarjetas:
      tarjetas,

    cuotas:
      cuotas,

    prestamos:
      prestamos,

    catalogosRegistro:
      catalogosRegistro,

    presupuestos:
      presupuestos,

    obligaciones:
      obligaciones.obligaciones,

    pagosObligaciones:
      obligaciones.pagos,

    metas:
      metas,

    gastosCategoria:
      categorias,

    gastosMedio:
      medios,

    estadisticasMensuales:
      estadisticas
  };


  console.log(
    "PERF actualizacion completa: " +
    (
      Date.now() -
      inicioMedicion
    ) +
    " ms"
  );


  return respuesta;
}


/************************************************************
 * ACTUALIZACION RAPIDA
 * Tarjetas se incluyen solo tras registrar un pago.
 ************************************************************/

function obtenerActualizacionRapidaMobile(
  opciones
) {

  const inicioMedicion =
    Date.now();


  try {

    const ss =
      SpreadsheetApp.openById(
        MOBILE_SPREADSHEET_ID
      );


    const gastos =
      obtenerGastos_(ss);


    const ingresos =
      obtenerIngresos_(ss);


    const pagosTarjetas =
      obtenerPagosTarjetas_(ss);

    const transferencias =
      obtenerTransferenciasMobile_(ss);


    const respuesta = {
      actualizado:
        Utilities.formatDate(
          new Date(),
          MOBILE_TZ,
          "dd/MM/yyyy HH:mm"
        ),

      movimientos:
        obtenerMovimientos_(
          gastos,
          ingresos,
          pagosTarjetas
        ).concat(
          obtenerMovimientosTransferenciasMobile_(
            transferencias
          )
        ).sort(
          (a, b) =>
            b.timestamp - a.timestamp
        ),

      transferencias:
        transferencias
    };


    if (
      opciones &&
      opciones.incluirTarjetas ===
        true
    ) {

      respuesta.pagosTarjetas =
        pagosTarjetas;


      respuesta.tarjetas =
        obtenerTarjetas_(ss);
    }


    return respuesta;

  } finally {

    console.log(
      "PERF actualizacion rapida: " +
      (
        Date.now() -
        inicioMedicion
      ) +
      " ms"
    );
  }
}

/************************************************************
 * SALDOS
 *
 * A Cuenta
 * B Saldo base
 * C Nuevos ingresos
 * D Gastos
 * E Pagos tarjetas
 * F Disponible
 *
 * Filas desde la 3; V1.16 permite añadir cuentas sin
 * modificar las filas históricas 3 a 8.
 ************************************************************/

function obtenerSaldos_(
  ss,
  transferencias,
  cuentasCatalogo
) {

  const hoja =
    ss.getSheetByName("Saldos");

  if (!hoja) {
    throw new Error(
      "No existe la hoja Saldos"
    );
  }

  const ultimaFila =
    hoja.getLastRow();

  const datos =
    ultimaFila >= 3
      ? hoja
          .getRange(
            3,
            1,
            ultimaFila - 2,
            6
          )
          .getValues()
      : [];


  let totalHoja =
    null;


  const cuentas = [];


  datos.forEach(
    fila => {

      const nombre =
        String(
          fila[0] || ""
        ).trim();


      if (!nombre) {
        return;
      }


      if (
        normalizar_(nombre) ===
        "total"
      ) {

        totalHoja =
          numero_(fila[5]);

        return;
      }


      cuentas.push({

        cuenta:
          nombre,

        base:
          numero_(fila[1]),

        ingresos:
          numero_(fila[2]),

        gastos:
          numero_(fila[3]),

        pagosTarjetas:
          numero_(fila[4]),

        saldo:
          numero_(fila[5])
      });
    }
  );


  const cuentasAjustadas =
    aplicarTransferenciasMobileASaldos_(
      cuentas,
      transferencias
    );

  const catalogoCuentas =
    cuentasCatalogo ||
    obtenerCuentasCatalogoMobile_(
      ss
    );

  cuentasAjustadas.forEach(
    cuenta => {
      const catalogo =
        catalogoCuentas.find(
          item =>
            normalizar_(
              item.nombreSaldos
            ) ===
            normalizar_(
              cuenta.cuenta
            )
        );

      if (catalogo) {
        cuenta.cuenta =
          catalogo.nombre;
      }
    }
  );

  const total =
    totalHoja !== null
      ? totalHoja
      : cuentasAjustadas.reduce(
          (suma, cuenta) =>
            suma + cuenta.saldo,
          0
        );


  return {
    cuentas: cuentasAjustadas,
    total: total
  };
}


/************************************************************
 * GASTOS
 ************************************************************/

function obtenerGastos_(ss) {

  const hoja =
    ss.getSheetByName("Gastos");

  if (!hoja) {
    return [];
  }

  const ultimaFila =
    hoja.getLastRow();

  if (ultimaFila < 2) {
    return [];
  }

  const datos =
    hoja
      .getRange(
        2,
        1,
        ultimaFila - 1,
        8
      )
      .getValues();


  return datos
    .map(
      (fila, indice) => ({
        fila: fila,
        ordenFila: indice + 2
      })
    )
    .filter(
      registro =>
        registro.fila[0]
    )
    .map(
      (registro, indice) => {

        const fila =
          registro.fila;

        const fecha =
          fechaInfo_(fila[0]);

        return {

          id:
            "gasto-" + indice,

          tipo:
            "gasto",

          fecha:
            fecha.texto,

          fechaISO:
            fecha.iso,

          timestamp:
            fecha.timestamp,

          ordenFila:
            registro.ordenFila,

          categoria:
            String(
              fila[1] || ""
            ),

          subcategoria:
            String(
              fila[2] || ""
            ),

          descripcion:
            String(
              fila[3] || ""
            ),

          monto:
            numero_(fila[4]),

          medio:
            String(
              fila[5] || ""
            ),

          observacion:
            String(
              fila[6] || ""
            ),

          origen:
            String(
              fila[7] || ""
            )
        };
      }
    )
    .sort(
      (a, b) =>
        b.timestamp -
        a.timestamp
    );
}


/************************************************************
 * INGRESOS
 ************************************************************/

function obtenerIngresos_(ss) {

  const hoja =
    ss.getSheetByName(
      "Ingresos"
    );

  if (!hoja) {
    return [];
  }

  const ultimaFila =
    hoja.getLastRow();

  if (ultimaFila < 2) {
    return [];
  }

  const datos =
    hoja
      .getRange(
        2,
        1,
        ultimaFila - 1,
        7
      )
      .getValues();


  return datos
    .map(
      (fila, indice) => ({
        fila: fila,
        ordenFila: indice + 2
      })
    )
    .filter(
      registro =>
        registro.fila[0]
    )
    .map(
      (registro, indice) => {

        const fila =
          registro.fila;

        const fecha =
          fechaInfo_(fila[0]);

        return {

          id:
            "ingreso-" + indice,

          tipo:
            "ingreso",

          fecha:
            fecha.texto,

          fechaISO:
            fecha.iso,

          timestamp:
            fecha.timestamp,

          ordenFila:
            registro.ordenFila,

          tipoIngreso:
            String(
              fila[1] || ""
            ),

          descripcion:
            String(
              fila[2] || ""
            ),

          monto:
            numero_(fila[3]),

          cuenta:
            String(
              fila[4] || ""
            ),

          observacion:
            String(
              fila[5] || ""
            ),

          origen:
            String(
              fila[6] || ""
            )
        };
      }
    )
    .sort(
      (a, b) =>
        b.timestamp -
        a.timestamp
    );
}


/************************************************************
 * PAGOS DE TARJETAS
 ************************************************************/

function obtenerPagosTarjetas_(ss) {

  const hoja =
    ss.getSheetByName(
      "Pagos tarjetas"
    );

  if (!hoja) {
    return [];
  }

  const ultimaFila =
    hoja.getLastRow();

  if (ultimaFila < 2) {
    return [];
  }

  const datos =
    hoja
      .getRange(
        2,
        1,
        ultimaFila - 1,
        6
      )
      .getValues();


  return datos
    .filter(
      fila =>
        fila[0]
    )
    .map(
      (fila, indice) => {

        const fecha =
          fechaInfo_(fila[0]);

        return {

          id:
            "pago-tarjeta-" +
            indice,

          tipo:
            "pago_tarjeta",

          fecha:
            fecha.texto,

          fechaISO:
            fecha.iso,

          timestamp:
            fecha.timestamp,

          tarjeta:
            String(
              fila[1] || ""
            ),

          monto:
            numero_(fila[2]),

          cuenta:
            String(
              fila[3] || ""
            ),

          observacion:
            String(
              fila[4] || ""
            ),

          origen:
            String(
              fila[5] || ""
            )
        };
      }
    )
    .sort(
      (a, b) =>
        b.timestamp -
        a.timestamp
    );
}


/************************************************************
 * MOVIMIENTOS COMBINADOS
 ************************************************************/

function obtenerMovimientos_(
  gastos,
  ingresos,
  pagosTarjetas
) {

  const resultado =
    [];


  gastos.forEach(
    g => {

      resultado.push({

        id:
          g.id,

        tipo:
          "gasto",

        fecha:
          g.fecha,

        fechaISO:
          g.fechaISO,

        timestamp:
          g.timestamp,

        ordenFila:
          g.ordenFila,

        titulo:
          g.descripcion ||
          g.categoria ||
          "Gasto",

        subtitulo:
          g.categoria,

        categoria:
          g.categoria,

        cuenta:
          g.medio,

        monto:
          g.monto,

        observacion:
          g.observacion
      });
    }
  );


  ingresos.forEach(
    i => {

      resultado.push({

        id:
          i.id,

        tipo:
          "ingreso",

        fecha:
          i.fecha,

        fechaISO:
          i.fechaISO,

        timestamp:
          i.timestamp,

        ordenFila:
          i.ordenFila,

        titulo:
          i.descripcion ||
          i.tipoIngreso ||
          "Ingreso",

        subtitulo:
          i.tipoIngreso,

        categoria:
          i.tipoIngreso,

        cuenta:
          i.cuenta,

        monto:
          i.monto,

        observacion:
          i.observacion
      });
    }
  );


  pagosTarjetas.forEach(
    p => {

      resultado.push({

        id:
          p.id,

        tipo:
          "pago_tarjeta",

        fecha:
          p.fecha,

        fechaISO:
          p.fechaISO,

        timestamp:
          p.timestamp,

        titulo:
          "Pago " +
          p.tarjeta,

        subtitulo:
          "Pago de tarjeta",

        categoria:
          "Pago de tarjeta",

        cuenta:
          p.cuenta,

        monto:
          p.monto,

        observacion:
          p.observacion
      });
    }
  );


  return resultado
    .sort(
      (a, b) =>
        b.timestamp -
          a.timestamp ||
        (
          Number(
            b.ordenFila
          ) || 0
        ) -
        (
          Number(
            a.ordenFila
          ) || 0
        )
    )
    .map(
      movimiento => {

        const salida =
          Object.assign(
            {},
            movimiento
          );


        delete salida.ordenFila;


        return salida;
      }
    );
}


/************************************************************
 * TARJETAS
 ************************************************************/

function obtenerTarjetas_(ss) {

  const hoja =
    ss.getSheetByName(
      "Tarjetas"
    );

  if (!hoja) {
    return [];
  }

  const ultimaFila =
    hoja.getLastRow();

  if (ultimaFila < 2) {
    return [];
  }

  const datos =
    hoja
      .getRange(
        2,
        1,
        ultimaFila - 1,
        12
      )
      .getValues();


  return datos
    .filter(
      fila => {

        const tipo =
          normalizar_(
            fila[1]
          );

        return (
          String(
            fila[0] || ""
          ).trim() !== "" &&
          tipo ===
            "tarjetadecredito"
        );
      }
    )
    .map(
      fila => {

        const limite =
          numero_(fila[2]);

        const deuda =
          numero_(fila[3]);

        const porcentaje =
          limite > 0
            ? deuda /
              limite *
              100
            : 0;

        return {

          nombre:
            String(
              fila[0] || ""
            ),

          tipo:
            String(
              fila[1] || ""
            ),

          limite:
            limite,

          deuda:
            deuda,

          disponible:
            numero_(fila[4]),

          cierre:
            valorTexto_(
              fila[5]
            ),

          vencimiento:
            valorTexto_(
              fila[6]
            ),

          estado:
            String(
              fila[7] || ""
            ),

          nota:
            String(
              fila[8] || ""
            ),

          deudaBase:
            numero_(fila[9]),

          minimo:
            numero_(fila[10]),

          estadoMinimo:
            String(
              fila[11] || ""
            ),

          porcentajeUso:
            porcentaje,

          porcentajeBarra:
            Math.min(
              100,
              Math.max(
                0,
                porcentaje
              )
            )
        };
      }
    );
}


/************************************************************
 * CUOTAS
 *
 * NO INFIERE PAGOS PARCIALES.
 * Usa los valores existentes de Mis cuotas.
 ************************************************************/

function obtenerCuotas_(ss) {

  const hoja =
    ss.getSheetByName(
      "Mis cuotas"
    );

  if (!hoja) {
    return [];
  }

  const ultimaFila =
    hoja.getLastRow();

  if (ultimaFila < 8) {
    return [];
  }

  const datos =
    hoja
      .getRange(
        8,
        1,
        ultimaFila - 7,
        8
      )
      .getValues();


  return datos
    .filter(
      fila =>
        String(
          fila[0] || ""
        ).trim() !== ""
    )
    .map(
      fila => {

        const vence =
          fechaInfo_(fila[2]);

        const fechaPago =
          fechaInfo_(fila[5]);

        return {

          entidad:
            String(
              fila[0] || ""
            ),

          cuota:
            numero_(fila[1]),

          vence:
            vence.texto,

          venceISO:
            vence.iso,

          fechaOrden:
            vence.timestamp,

          monto:
            numero_(fila[3]),

          estado:
            String(
              fila[4] ||
              "Pendiente"
            ),

          fechaPago:
            fechaPago.texto,

          pagado:
            numero_(fila[6]),

          saldo:
            numero_(fila[7])
        };
      }
    )
    .sort(
      (a, b) => {

        const fechaA =
          a.fechaOrden > 0
            ? a.fechaOrden
            : Number.MAX_SAFE_INTEGER;

        const fechaB =
          b.fechaOrden > 0
            ? b.fechaOrden
            : Number.MAX_SAFE_INTEGER;

        return fechaA -
          fechaB;
      }
    );
}


/************************************************************
 * RESUMEN DE PRÉSTAMOS
 ************************************************************/

function obtenerResumenPrestamos_(
  cuotas
) {

  const grupos =
    {};


  cuotas.forEach(
    cuota => {

      const entidad =
        cuota.entidad;


      if (!grupos[entidad]) {

        grupos[entidad] = {

          entidad:
            entidad,

          cuotas:
            [],

          totalCuotas:
            0,

          pagadas:
            0,

          pendientes:
            0,

          parciales:
            0,

          totalProgramado:
            0,

          totalPagado:
            0,

          saldoPendiente:
            0,

          proxima:
            null
        };
      }


      const g =
        grupos[entidad];


      g.cuotas.push(
        cuota
      );


      g.totalCuotas++;


      g.totalProgramado +=
        cuota.monto;


      g.totalPagado +=
        cuota.pagado;


      g.saldoPendiente +=
        cuota.saldo;


      const estado =
        normalizar_(
          cuota.estado
        );


      if (
        estado ===
        "pagado"
      ) {

        g.pagadas++;

      } else if (
        estado ===
        "parcial" ||
        estado ===
        "pagoparcial"
      ) {

        g.parciales++;
        g.pendientes++;

      } else {

        g.pendientes++;
      }


      if (
        cuota.saldo > 0 &&
        cuota.fechaOrden > 0 &&
        cuota.venceISO
      ) {

        if (
          !g.proxima ||
          cuota.fechaOrden <
            g.proxima.fechaOrden
        ) {

          g.proxima =
            cuota;
        }
      }
    }
  );


  return Object
    .values(
      grupos
    )
    .map(
      g => {

        const porcentaje =
          g.totalCuotas > 0
            ? (
                g.pagadas /
                g.totalCuotas *
                100
              )
            : 0;


        return {

          entidad:
            g.entidad,

          totalCuotas:
            g.totalCuotas,

          pagadas:
            g.pagadas,

          pendientes:
            g.pendientes,

          parciales:
            g.parciales,

          totalProgramado:
            g.totalProgramado,

          totalPagado:
            g.totalPagado,

          saldoPendiente:
            g.saldoPendiente,

          porcentajePagado:
            Math.min(
              100,
              Math.max(
                0,
                porcentaje
              )
            ),

          proxima:
            g.proxima,

          cuotas:
            g.cuotas
        };
      }
    )
    .sort(
      (a, b) => {

        const ta =
          a.proxima
            ? a.proxima.fechaOrden
            : Number.MAX_SAFE_INTEGER;

        const tb =
          b.proxima
            ? b.proxima.fechaOrden
            : Number.MAX_SAFE_INTEGER;

        return ta - tb;
      }
    );
}


/************************************************************
 * RESUMEN MES ACTUAL
 ************************************************************/

function obtenerResumenMes_(
  gastos,
  ingresos
) {

  const ahora =
    new Date();

  const mes =
    Utilities.formatDate(
      ahora,
      MOBILE_TZ,
      "yyyy-MM"
    );


  const totalIngresos =
    ingresos
      .filter(
        i =>
          i.fechaISO &&
          i.fechaISO.substring(
            0,
            7
          ) === mes
      )
      .reduce(
        (suma, i) =>
          suma + i.monto,
        0
      );


  const totalGastos =
    gastos
      .filter(
        g =>
          g.fechaISO &&
          g.fechaISO.substring(
            0,
            7
          ) === mes
      )
      .reduce(
        (suma, g) =>
          suma + g.monto,
        0
      );


  return {

    ingresos:
      totalIngresos,

    gastos:
      totalGastos,

    balance:
      totalIngresos -
      totalGastos,

    mes:
      nombreMes_(
        ahora.getMonth(),
        ahora.getFullYear()
      )
  };
}


/************************************************************
 * GASTOS POR CATEGORÍA
 ************************************************************/

function obtenerGastosCategorias_(
  gastos
) {

  const mesActual =
    Utilities.formatDate(
      new Date(),
      MOBILE_TZ,
      "yyyy-MM"
    );


  const totales =
    {};


  gastos
    .filter(
      g =>
        g.fechaISO &&
        g.fechaISO.substring(
          0,
          7
        ) === mesActual
    )
    .forEach(
      g => {

        const categoria =
          g.categoria ||
          "Otros";

        totales[categoria] =
          (
            totales[categoria] ||
            0
          ) +
          g.monto;
      }
    );


  return Object
    .keys(
      totales
    )
    .map(
      categoria => ({

        categoria:
          categoria,

        monto:
          totales[
            categoria
          ]
      })
    )
    .sort(
      (a, b) =>
        b.monto -
        a.monto
    );
}


/************************************************************
 * GASTOS POR MEDIO
 ************************************************************/

function obtenerGastosMedios_(
  gastos
) {

  const mesActual =
    Utilities.formatDate(
      new Date(),
      MOBILE_TZ,
      "yyyy-MM"
    );


  const totales =
    {};


  gastos
    .filter(
      g =>
        g.fechaISO &&
        g.fechaISO.substring(
          0,
          7
        ) === mesActual
    )
    .forEach(
      g => {

        const medio =
          g.medio ||
          "Otro";

        totales[medio] =
          (
            totales[medio] ||
            0
          ) +
          g.monto;
      }
    );


  return Object
    .keys(
      totales
    )
    .map(
      medio => ({

        medio:
          medio,

        monto:
          totales[medio]
      })
    )
    .sort(
      (a, b) =>
        b.monto -
        a.monto
    );
}


/************************************************************
 * ESTADÍSTICAS ÚLTIMOS MESES
 ************************************************************/

function obtenerEstadisticasMensuales_(
  gastos,
  ingresos,
  cantidad
) {

  const ahora =
    new Date();

  const resultado =
    [];


  for (
    let i =
      cantidad - 1;
    i >= 0;
    i--
  ) {

    const fecha =
      new Date(
        ahora.getFullYear(),
        ahora.getMonth() - i,
        1
      );


    const clave =
      Utilities.formatDate(
        fecha,
        MOBILE_TZ,
        "yyyy-MM"
      );


    const ingresosMes =
      ingresos
        .filter(
          item =>
            item.fechaISO &&
            item.fechaISO.substring(
              0,
              7
            ) === clave
        )
        .reduce(
          (suma, item) =>
            suma +
            item.monto,
          0
        );


    const gastosMes =
      gastos
        .filter(
          item =>
            item.fechaISO &&
            item.fechaISO.substring(
              0,
              7
            ) === clave
        )
        .reduce(
          (suma, item) =>
            suma +
            item.monto,
          0
        );


    resultado.push({

      mes:
        nombreMesCorto_(
          fecha.getMonth()
        ),

      anio:
        fecha.getFullYear(),

      ingresos:
        ingresosMes,

      gastos:
        gastosMes,

      balance:
        ingresosMes -
        gastosMes
    });
  }


  return resultado;
}


/************************************************************
 * FECHAS
 ************************************************************/

function fechaInfo_(valor) {

  let fecha = null;


  if (
    Object.prototype.toString.call(
      valor
    ) === "[object Date]" &&
    !isNaN(
      valor.getTime()
    )
  ) {
    fecha = valor;
  } else {
    const texto =
      normalizarFechaMobile_(
        valor
      );


    const partes =
      texto
        ? texto.split("/")
        : [];


    if (partes.length === 3) {
      fecha =
        new Date(
          Number(partes[2]),
          Number(partes[1]) - 1,
          Number(partes[0]),
          12,
          0,
          0
        );
    }
  }


  if (!fecha) {

    return {
      texto: "",
      iso: "",
      timestamp: 0
    };
  }


  return {

    texto:
      Utilities.formatDate(
        fecha,
        MOBILE_TZ,
        "dd/MM/yyyy"
      ),

    iso:
      Utilities.formatDate(
        fecha,
        MOBILE_TZ,
        "yyyy-MM-dd"
      ),

    timestamp:
      fecha.getTime()
  };
}


/************************************************************
 * UTILIDADES
 ************************************************************/

function numero_(valor) {

  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return 0;
  }

  if (
    typeof valor ===
    "number"
  ) {
    return valor;
  }

  const n =
    Number(valor);

  return isNaN(n)
    ? 0
    : n;
}


function normalizar_(valor) {

  return String(
    valor || ""
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /_/g,
      ""
    )
    .replace(
      /-/g,
      ""
    )
    .trim();
}


function valorTexto_(valor) {

  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }

  if (
    valor instanceof Date
  ) {

    return Utilities.formatDate(
      valor,
      MOBILE_TZ,
      "dd/MM/yyyy"
    );
  }

  return String(valor);
}


function nombreMes_(
  mes,
  anio
) {

  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"
  ];

  return (
    meses[mes] +
    " " +
    anio
  );
}


function nombreMesCorto_(mes) {

  return [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic"
  ][mes];
}


/************************************************************
 * REGISTRAR INGRESO DESDE EL DASHBOARD
 ************************************************************/

function registrarIngresoMobile(
  datos
) {

  let solicitud;


  try {

    solicitud =
      validarIngresoMobile_(
        datos
      );

  } catch (error) {

    return {
      ok: false,
      error:
        error.message ||
        "Los datos del ingreso no son válidos."
    };
  }


  const propiedades =
    PropertiesService
      .getScriptProperties();


  const backendUrl =
    String(
      propiedades.getProperty(
        "BACKEND_V2_URL"
      ) ||
      ""
    ).trim();


  const backendToken =
    String(
      propiedades.getProperty(
        "BACKEND_V2_TOKEN"
      ) ||
      ""
    );


  if (
    !backendUrl ||
    !backendToken
  ) {

    return {
      ok: false,
      error:
        "El registro de ingresos todavía no está configurado."
    };
  }


  if (
    !/^https:\/\//i.test(
      backendUrl
    )
  ) {

    return {
      ok: false,
      error:
        "La configuración del registro no es válida."
    };
  }


  const cache =
    CacheService
      .getScriptCache();


  const cacheKey =
    "ingreso_mobile_" +
    solicitud.requestId;


  const lock =
    LockService
      .getScriptLock();


  try {

    lock.waitLock(
      10000
    );


    const guardado =
      cache.get(
        cacheKey
      );


    if (guardado) {

      if (
        guardado.indexOf(
          "completado:"
        ) === 0
      ) {

        return JSON.parse(
          guardado.substring(
            11
          )
        );
      }


      return {
        ok: false,
        incierto: true,
        duplicado: true,
        error:
          "Esta solicitud ya fue enviada. Verifica Movimientos antes de intentar registrarla nuevamente."
      };
    }


    cache.put(
      cacheKey,
      "procesando",
      MOBILE_CACHE_INGRESO_SEGUNDOS
    );

  } catch (error) {

    return {
      ok: false,
      error:
        "No fue posible asegurar el envío. Intenta nuevamente antes de confirmar el ingreso."
    };

  } finally {

    if (
      lock.hasLock()
    ) {
      lock.releaseLock();
    }
  }


  const payload = {
    token:
      backendToken,
    tipo:
      "ingreso",
    tipoIngreso:
      solicitud.tipoIngreso,
    descripcion:
      solicitud.descripcion,
    monto:
      solicitud.monto,
    cuentaDestino:
      solicitud.cuentaDestino,
    fecha:
      solicitud.fecha,
    observacion:
      solicitud.observacion
  };


  try {

    const respuestaHttp =
      ejecutarSolicitudBackendMobile_(
        backendUrl,
        payload
      );


    const analisis =
      analizarRespuestaBackendMobile_(
        respuestaHttp,
        backendUrl,
        backendToken,
        esRechazoDefinitivoIngreso_
      );


    if (!analisis.ok) {

      if (analisis.incierto) {

        guardarCacheGastoSilencioso_(
          cache,
          cacheKey,
          "incierto",
          MOBILE_CACHE_INGRESO_SEGUNDOS
        );


        return respuestaInciertaIngreso_(
          analisis.codigo,
          analisis.error
        );
      }

      eliminarCacheGastoSilencioso_(
        cache,
        cacheKey
      );


      return {
        ok: false,
        estadoEscritura:
          analisis.estadoEscritura,
        codigo:
          analisis.codigo,
        error:
          analisis.error ||
          "El backend rechazó el ingreso."
      };
    }


    const resultado = {
      ok: true,
      estadoEscritura:
        "WRITE_CONFIRMED",
      mensaje:
        "Ingreso registrado",
      monto:
        solicitud.monto,
      cuentaDestino:
        solicitud.cuentaDestino,
      fecha:
        solicitud.fecha
    };


    guardarCacheGastoSilencioso_(
      cache,
      cacheKey,
      "completado:" +
        JSON.stringify(
          resultado
        ),
      MOBILE_CACHE_INGRESO_SEGUNDOS
    );


    return resultado;

  } catch (error) {

    guardarCacheGastoSilencioso_(
      cache,
      cacheKey,
      "incierto",
      MOBILE_CACHE_INGRESO_SEGUNDOS
    );


    return respuestaInciertaIngreso_(
      "BACKEND_TRANSPORT_ERROR",
      "No se pudo comunicar con el Backend. El resultado del ingreso no puede confirmarse."
    );
  }
}


function validarIngresoMobile_(
  datos
) {

  if (
    !datos ||
    typeof datos !==
      "object" ||
    Array.isArray(
      datos
    )
  ) {
    throw new Error(
      "Los datos del ingreso no son válidos."
    );
  }


  const requestId =
    String(
      datos.requestId ||
      ""
    ).trim();


  if (
    !/^[A-Za-z0-9-]{16,80}$/.test(
      requestId
    )
  ) {
    throw new Error(
      "La identificación de la solicitud no es válida."
    );
  }


  const monto =
    numeroGastoMobile_(
      datos.monto
    );


  if (
    !Number.isFinite(
      monto
    ) ||
    monto <= 0
  ) {
    throw new Error(
      "El monto debe ser mayor que cero."
    );
  }


  const cuentaDestino =
    String(
      datos.cuentaDestino ||
      ""
    ).trim();


  if (
    !cuentaRegistroValidaMobileV116_(
      cuentaDestino
    )
  ) {
    throw new Error(
      "La cuenta destino no es válida."
    );
  }


  return {
    requestId:
      requestId,
    tipoIngreso:
      textoGastoMobile_(
        datos.tipoIngreso,
        "El tipo de ingreso es obligatorio.",
        80,
        true
      ),
    descripcion:
      textoGastoMobile_(
        datos.descripcion,
        "La descripción es obligatoria.",
        160,
        true
      ),
    monto:
      monto,
    cuentaDestino:
      cuentaDestino,
    fecha:
      validarFechaGastoMobile_(
        datos.fecha
      ),
    observacion:
      textoGastoMobile_(
        datos.observacion,
        "",
        300,
        false
      )
  };
}


/************************************************************
 * CATÁLOGOS DE REGISTRO
 *
 * Se generan únicamente desde valores ya existentes en las
 * hojas. No agregan ni modifican datos contables.
 ************************************************************/

function obtenerCatalogosRegistro_(
  ss,
  cuentasCatalogo
) {

  const datos =
    leerDatosCatalogosRegistro_(
      ss
    );


  return {
    categoriasGasto:
      obtenerCategoriasRegistro_(
        datos
      ),

    tiposIngreso:
      obtenerTiposIngresoRegistro_(
        datos
      ),

    cuentas:
      (cuentasCatalogo ||
        obtenerCuentasCatalogoMobile_(
          ss
        ))
        .filter(cuenta => cuenta.activa)
        .map(cuenta => cuenta.nombre),

    categoriasAdministrables:
      obtenerCategoriasAdministrablesMobile_(
        datos
      )
  };
}


function leerDatosCatalogosRegistro_(
  ss
) {

  let hoja;
  let datos;


  try {

    hoja =
      ss.getSheetByName(
        "Categorías"
      );


    if (!hoja) {
      return [];
    }


    const ultimaFila =
      hoja.getLastRow();


    if (ultimaFila < 2) {
      return [];
    }


    datos =
      hoja
        .getRange(
          1,
          1,
          ultimaFila,
          14
        )
        .getDisplayValues();

  } catch (error) {
    return [];
  }


  return datos;
}


function obtenerCategoriasRegistro_(
  datos
) {


  const encabezados =
    datos[0] ||
    [];


  if (
    normalizar_(
      encabezados[0]
    ) !== "categoria" ||
    normalizar_(
      encabezados[1]
    ) !== "subcategoria" ||
    normalizar_(
      encabezados[7]
    ) !== "categoriapadre"
  ) {
    return [];
  }


  const filas =
    datos.slice(1);

  const categoriasPorClave =
    Object.create(
      null
    );

  const categorias =
    [];


  filas.forEach(
    fila => {

      const nombre =
        String(
          fila[0] ||
          ""
        ).trim();

      const clave =
        normalizar_(
          nombre
        );


      if (
        !clave ||
        !valorActivoCatalogoMobileV116_(fila[9]) ||
        categoriasPorClave[clave]
      ) {
        return;
      }


      const categoria = {
        nombre:
          nombre,
        subcategorias:
          [],
        subcategoriasPorClave:
          Object.create(
            null
          )
      };


      categoriasPorClave[clave] =
        categoria;

      categorias.push(
        categoria
      );
    }
  );


  filas.forEach(
    fila => {

      const subcategoria =
        String(
          fila[1] ||
          ""
        ).trim();

      const categoriaPadre =
        String(
          fila[7] ||
          ""
        ).trim();

      const claveSubcategoria =
        normalizar_(
          subcategoria
        );

      const categoria =
        categoriasPorClave[
          normalizar_(
            categoriaPadre
          )
        ];


      if (
        !claveSubcategoria ||
        !valorActivoCatalogoMobileV116_(fila[11]) ||
        !categoria ||
        categoria
          .subcategoriasPorClave[
            claveSubcategoria
          ]
      ) {
        return;
      }


      categoria
        .subcategoriasPorClave[
          claveSubcategoria
        ] =
        true;

      categoria.subcategorias.push(
        subcategoria
      );
    }
  );


  return categorias.map(
    categoria => ({
      nombre:
        categoria.nombre,
      subcategorias:
        categoria.subcategorias
    })
  );
}


function obtenerTiposIngresoRegistro_(
  datos
) {

  const encabezados =
    datos[0] ||
    [];


  if (
    normalizar_(
      encabezados[5]
    ) !== "tiposdeingreso"
  ) {
    return [];
  }


  const tiposPorClave =
    Object.create(
      null
    );

  const tipos =
    [];


  datos
    .slice(1)
    .forEach(
      fila => {

        const tipo =
          String(
            fila[5] ||
            ""
          ).trim();

        const clave =
          normalizar_(
            tipo
          );


        if (
          !clave ||
          tiposPorClave[clave]
        ) {
          return;
        }


        tiposPorClave[clave] =
          true;

        tipos.push(
          tipo
        );
      }
  );


  return tipos;
}


function esRechazoDefinitivoIngreso_(
  mensaje
) {

  const normalizado =
    String(
      mensaje ||
      ""
    )
      .toLowerCase()
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );


  return [
    "monto invalido",
    "cuenta destino invalida",
    "token invalido",
    "tipo de operacion no reconocido"
  ].some(
    texto =>
      normalizado.includes(
        texto
      )
  );
}


function respuestaInciertaIngreso_(
  codigo,
  mensaje
) {

  return {
    ok: false,
    incierto: true,
    estadoEscritura:
      "WRITE_UNCERTAIN",
    codigo:
      codigo ||
      "BACKEND_TRANSPORT_ERROR",
    error:
      mensaje ||
      "No se pudo confirmar el resultado. El ingreso podría haberse registrado. Verifica Movimientos antes de volver a registrarlo."
  };
}


/************************************************************
 * PAGO DE TARJETA DESDE EL DASHBOARD
 ************************************************************/

function registrarPagoTarjetaMobile(
  datos
) {

  let solicitud;


  try {

    solicitud =
      validarPagoTarjetaMobile_(
        datos
      );

  } catch (error) {

    return {
      ok: false,
      error:
        error.message ||
        "Los datos del pago no son válidos."
    };
  }


  return enviarOperacionBackendMobile_(
    solicitud,
    {
      cachePrefix:
        "tarjeta_mobile_",
      cacheSegundos:
        MOBILE_CACHE_TARJETA_SEGUNDOS,
      payload: {
        tipo:
          "pagotarjeta",
        tarjeta:
          solicitud.tarjeta,
        monto:
          solicitud.monto,
        cuentaOrigen:
          solicitud.cuentaOrigen,
        fecha:
          solicitud.fecha,
        observacion:
          solicitud.observacion
      },
      configuracionError:
        "El pago de tarjetas todavía no está configurado.",
      reservaError:
        "No fue posible asegurar el envío. Intenta nuevamente antes de confirmar el pago.",
      rechazoError:
        "El backend rechazó el pago de tarjeta.",
      inciertoError:
        "No se pudo confirmar el resultado. El pago podría haberse registrado. Verifica Movimientos antes de volver a registrarlo.",
      esRechazoDefinitivo:
        esRechazoDefinitivoTarjeta_,
      crearResultado:
        function() {
          return {
            ok: true,
            mensaje:
              "Pago de tarjeta registrado",
            tarjeta:
              solicitud.tarjeta,
            monto:
              solicitud.monto,
            cuentaOrigen:
              solicitud.cuentaOrigen,
            fecha:
              solicitud.fecha
          };
        }
    }
  );
}


function validarPagoTarjetaMobile_(
  datos
) {

  validarObjetoRegistroMobile_(
    datos,
    "pago de tarjeta"
  );


  const requestId =
    validarRequestIdMobile_(
      datos.requestId
    );


  const monto =
    numeroGastoMobile_(
      datos.monto
    );


  if (
    !Number.isFinite(
      monto
    ) ||
    monto <= 0
  ) {
    throw new Error(
      "El monto debe ser mayor que cero."
    );
  }


  const tarjeta =
    String(
      datos.tarjeta ||
      ""
    ).trim();


  if (
    !MOBILE_TARJETAS_PAGO.includes(
      tarjeta
    )
  ) {
    throw new Error(
      "La tarjeta no es válida."
    );
  }


  const cuentaOrigen =
    validarCuentaRegistroMobile_(
      datos.cuentaOrigen,
      "La cuenta de origen no es válida."
    );


  return {
    requestId:
      requestId,
    tarjeta:
      tarjeta,
    monto:
      monto,
    cuentaOrigen:
      cuentaOrigen,
    fecha:
      validarFechaGastoMobile_(
        datos.fecha
      ),
    observacion:
      textoGastoMobile_(
        datos.observacion,
        "",
        300,
        false
      )
  };
}


function esRechazoDefinitivoTarjeta_(
  mensaje
) {

  return mensajeBackendIncluye_(
    mensaje,
    [
      "monto invalido",
      "tarjeta invalida",
      "cuenta de origen invalida",
      "token invalido",
      "tipo de operacion no reconocido"
    ]
  );
}


/************************************************************
 * PAGO DE CUOTA DESDE EL DASHBOARD
 ************************************************************/

function registrarPagoCuotaMobile(
  datos
) {

  let solicitud;


  try {

    solicitud =
      validarPagoCuotaMobile_(
        datos
      );


    const cuotaDisponible =
      obtenerCuotaDisponibleMobile_(
        solicitud.entidad,
        solicitud.cuota
      );


    if (
      solicitud.monto !==
        cuotaDisponible.monto
    ) {
      throw new Error(
        "El monto debe coincidir con el monto completo de la cuota."
      );
    }


    solicitud.monto =
      cuotaDisponible.monto;

  } catch (error) {

    return {
      ok: false,
      error:
        error.message ||
        "Los datos del pago de cuota no son válidos."
    };
  }


  return enviarOperacionBackendMobile_(
    solicitud,
    {
      cachePrefix:
        "cuota_mobile_",
      cacheSegundos:
        MOBILE_CACHE_CUOTA_SEGUNDOS,
      payload: {
        tipo:
          "pagocuota",
        requestId:
          solicitud.requestId,
        entidad:
          solicitud.entidad,
        cuota:
          solicitud.cuota,
        monto:
          solicitud.monto,
        cuentaOrigen:
          solicitud.cuentaOrigen,
        fecha:
          solicitud.fecha
      },
      configuracionError:
        "El pago de cuotas todavía no está configurado.",
      reservaError:
        "No fue posible asegurar el envío. Intenta nuevamente antes de confirmar el pago.",
      rechazoError:
        "El backend rechazó el pago de cuota.",
      inciertoError:
        "No se pudo confirmar el resultado. La cuota podría haberse pagado. Verifica Cuotas antes de volver a registrarla.",
      esRechazoDefinitivo:
        esRechazoDefinitivoCuota_,
      crearResultado:
        function(respuesta) {
          return {
            ok: true,
            yaPagada:
              respuesta.yaPagada ===
                true,
            mensaje:
              String(
                respuesta.mensaje ||
                (
                  respuesta.yaPagada
                    ? "La cuota ya estaba pagada"
                    : "Pago de cuota registrado"
                )
              ).substring(
                0,
                160
              ),
            entidad:
              solicitud.entidad,
            cuota:
              solicitud.cuota,
            monto:
              solicitud.monto,
            cuentaOrigen:
              solicitud.cuentaOrigen,
            fecha:
              solicitud.fecha,
            saldoDescontado:
              respuesta.saldoDescontado ===
                true,
            reconciliada:
              respuesta.reconciliada ===
                true,
            advertencia:
              String(
                respuesta.advertencia ||
                ""
              ).substring(
                0,
                200
              )
          };
        }
    }
  );
}


function validarPagoCuotaMobile_(
  datos
) {

  validarObjetoRegistroMobile_(
    datos,
    "pago de cuota"
  );


  const requestId =
    validarRequestIdMobile_(
      datos.requestId
    );


  const entidad =
    String(
      datos.entidad ||
      ""
    ).trim();


  if (
    !MOBILE_ENTIDADES_CUOTA.includes(
      entidad
    )
  ) {
    throw new Error(
      "La entidad no es válida."
    );
  }


  const cuota =
    numeroGastoMobile_(
      datos.cuota
    );


  if (
    !Number.isInteger(
      cuota
    ) ||
    cuota <= 0
  ) {
    throw new Error(
      "El número de cuota no es válido."
    );
  }


  const monto =
    numeroGastoMobile_(
      datos.monto
    );


  if (
    !Number.isFinite(
      monto
    ) ||
    monto <= 0
  ) {
    throw new Error(
      "El monto debe ser mayor que cero."
    );
  }


  const cuentaOrigen =
    validarCuentaRegistroMobile_(
      datos.cuentaOrigen,
      "La cuenta de origen no existe o está inactiva."
    );


  return {
    requestId:
      requestId,
    entidad:
      entidad,
    cuota:
      cuota,
    monto:
      monto,
    cuentaOrigen:
      cuentaOrigen,
    fecha:
      validarFechaGastoMobile_(
        datos.fecha
      )
  };
}


function obtenerCuotaDisponibleMobile_(
  entidad,
  numeroCuota
) {

  const ss =
    SpreadsheetApp.openById(
      MOBILE_SPREADSHEET_ID
    );


  const cuota =
    obtenerCuotas_(
      ss
    ).find(
      item =>
        canonEntidadCuotaMobile_(
          item.entidad
        ) === entidad &&
        Number(
          item.cuota
        ) === numeroCuota &&
        normalizar_(
          item.estado
        ) === "pendiente"
    );


  if (
    !cuota ||
    !Number.isFinite(
      Number(
        cuota.monto
      )
    ) ||
    Number(
      cuota.monto
    ) <= 0
  ) {
    throw new Error(
      "La cuota pendiente ya no está disponible. Actualiza el Dashboard antes de continuar."
    );
  }


  return {
    monto:
      Number(
        cuota.monto
      )
  };
}


function canonEntidadCuotaMobile_(
  valor
) {

  const clave =
    normalizar_(
      valor
    );


  if (
    clave.includes(
      "atlas"
    )
  ) {
    return "Banco Atlas";
  }


  if (
    clave.includes(
      "medalla"
    )
  ) {
    return "Medalla Milagrosa";
  }


  if (
    clave.includes(
      "sancristobal"
    )
  ) {
    return "Cooperativa San Cristóbal";
  }


  return "";
}


function esRechazoDefinitivoCuota_(
  mensaje
) {

  return mensajeBackendIncluye_(
    mensaje,
    [
      "entidad no reconocida",
      "numero de cuota invalido",
      "monto de pago invalido",
      "no se encontro",
      "no tiene registros",
      "la cuota no tiene un monto valido",
      "la cuenta de origen no existe o esta inactiva",
      "el monto debe coincidir con el monto completo de la cuota",
      "el monto de la cuota no coincide entre las hojas",
      "la salida financiera existente no coincide con la cuota",
      "token invalido",
      "tipo de operacion no reconocido"
    ]
  );
}


/************************************************************
 * ENVÍO SEGURO COMPARTIDO PARA NUEVAS OPERACIONES
 ************************************************************/

function enviarOperacionBackendMobile_(
  solicitud,
  opciones
) {

  const propiedades =
    PropertiesService
      .getScriptProperties();


  const backendUrl =
    String(
      propiedades.getProperty(
        "BACKEND_V2_URL"
      ) ||
      ""
    ).trim();


  const backendToken =
    String(
      propiedades.getProperty(
        "BACKEND_V2_TOKEN"
      ) ||
      ""
    );


  if (
    !backendUrl ||
    !backendToken
  ) {
    return {
      ok: false,
      error:
        opciones.configuracionError
    };
  }


  if (
    !/^https:\/\//i.test(
      backendUrl
    )
  ) {
    return {
      ok: false,
      error:
        "La configuración del registro no es válida."
    };
  }


  const cache =
    CacheService
      .getScriptCache();


  const cacheKey =
    opciones.cachePrefix +
    solicitud.requestId;


  const lock =
    LockService
      .getScriptLock();


  try {

    lock.waitLock(
      10000
    );


    const guardado =
      cache.get(
        cacheKey
      );


    if (guardado) {

      if (
        guardado.indexOf(
          "completado:"
        ) === 0
      ) {
        return JSON.parse(
          guardado.substring(
            11
          )
        );
      }


      return {
        ok: false,
        incierto: true,
        duplicado: true,
        error:
          "Esta solicitud ya fue enviada. Verifica los datos antes de intentar registrarla nuevamente."
      };
    }


    cache.put(
      cacheKey,
      "procesando",
      opciones.cacheSegundos
    );

  } catch (error) {

    return {
      ok: false,
      error:
        opciones.reservaError
    };

  } finally {

    if (
      lock.hasLock()
    ) {
      lock.releaseLock();
    }
  }


  const payload = {
    token:
      backendToken
  };


  Object.keys(
    opciones.payload
  ).forEach(
    clave => {
      payload[clave] =
        opciones.payload[clave];
    }
  );


  try {

    const respuestaHttp =
      ejecutarSolicitudBackendMobile_(
        backendUrl,
        payload
      );


    const analisis =
      analizarRespuestaBackendMobile_(
        respuestaHttp,
        backendUrl,
        backendToken,
        opciones.esRechazoDefinitivo
      );


    if (!analisis.ok) {

      if (analisis.incierto) {

        guardarCacheGastoSilencioso_(
          cache,
          cacheKey,
          "incierto",
          opciones.cacheSegundos
        );


        return respuestaInciertaOperacionMobile_(
          analisis.error ||
          opciones.inciertoError,
          analisis.codigo
        );
      }


      eliminarCacheGastoSilencioso_(
        cache,
        cacheKey
      );


      return {
        ok: false,
        estadoEscritura:
          analisis.estadoEscritura,
        codigo:
          analisis.codigo,
        error:
          analisis.error ||
          opciones.rechazoError
      };
    }


    const respuesta =
      analisis.respuesta;


    const resultado =
      opciones.crearResultado(
        respuesta
      );


    resultado.estadoEscritura =
      "WRITE_CONFIRMED";


    guardarCacheGastoSilencioso_(
      cache,
      cacheKey,
      "completado:" +
        JSON.stringify(
          resultado
        ),
      opciones.cacheSegundos
    );


    return resultado;

  } catch (error) {

    guardarCacheGastoSilencioso_(
      cache,
      cacheKey,
      "incierto",
      opciones.cacheSegundos
    );


    return respuestaInciertaOperacionMobile_(
      "No se pudo comunicar con el Backend. " +
      opciones.inciertoError,
      "BACKEND_TRANSPORT_ERROR"
    );
  }
}


function validarObjetoRegistroMobile_(
  datos,
  nombre
) {

  if (
    !datos ||
    typeof datos !==
      "object" ||
    Array.isArray(
      datos
    )
  ) {
    throw new Error(
      "Los datos del " +
      nombre +
      " no son válidos."
    );
  }
}


function validarRequestIdMobile_(
  valor
) {

  const requestId =
    String(
      valor ||
      ""
    ).trim();


  if (
    !/^[A-Za-z0-9-]{16,80}$/.test(
      requestId
    )
  ) {
    throw new Error(
      "La identificación de la solicitud no es válida."
    );
  }


  return requestId;
}


function validarCuentaRegistroMobile_(
  valor,
  mensaje
) {

  const cuenta =
    String(
      valor ||
      ""
    ).trim();


  if (
    !cuentaRegistroValidaMobileV116_(
      cuenta
    )
  ) {
    throw new Error(
      mensaje
    );
  }


  return cuenta;
}


function mensajeBackendIncluye_(
  mensaje,
  textos
) {

  const normalizado =
    String(
      mensaje ||
      ""
    )
      .toLowerCase()
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );


  return textos.some(
    texto =>
      normalizado.includes(
        texto
      )
  );
}


function respuestaInciertaOperacionMobile_(
  mensaje,
  codigo
) {

  return {
    ok: false,
    incierto: true,
    estadoEscritura:
      "WRITE_UNCERTAIN",
    codigo:
      codigo ||
      "BACKEND_TRANSPORT_ERROR",
    error:
      mensaje
  };
}
