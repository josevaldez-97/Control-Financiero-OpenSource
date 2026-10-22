/************************************************************
 * CONTROL FINANCIERO PERSONAL
 * BACKEND-ATAJOS-UNIFICADO-V2
 * FECHA / HORA CORREGIDA
 *
 * Google Sheets + Atajos iPhone
 ************************************************************/

const SPREADSHEET_ID =
  "REEMPLAZAR_CON_ID_DE_TU_HOJA";

const TZ =
  "America/Asuncion";


/************************************************************
 * CONFIGURACIÓN
 ************************************************************/

const MEDIOS_GASTO = [

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


const CUENTAS = [

  "Efectivo",

  "Cuenta Ueno",
  "Cuenta Continental",
  "Cuenta Atlas",
  "Cuenta GNB",

  "Otro"
];


/************************************************************
 * GET
 ************************************************************/

function doGet() {

  return responder({

    ok: true,

    sistema:
      "Control Financiero Personal",

    version:
      "V2 UNIFICADO",

    fecha:
      Utilities.formatDate(
        new Date(),
        TZ,
        "dd/MM/yyyy HH:mm:ss"
      )
  });
}


/************************************************************
 * POST PRINCIPAL
 ************************************************************/

function doPost(e) {

  try {

    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {

      return responder({
        ok: false,
        error:
          "No se recibió contenido JSON"
      });
    }


    const datos =
      JSON.parse(
        e.postData.contents
      );


    /******************************************************
     * TOKEN
     ******************************************************/

    const tokenConfigurado =
      obtenerTokenBackend_();


    if (!tokenConfigurado) {

      return responder({
        ok: false,
        error:
          "Backend no configurado"
      });
    }


    if (
      datos.token !== tokenConfigurado
    ) {

      return responder({
        ok: false,
        error:
          "Token inválido"
      });
    }


    /******************************************************
     * TIPO DE OPERACIÓN
     ******************************************************/

    const tipoOriginal =
      datos.tipo || "";

    const tipo =
      normalizar(
        tipoOriginal
      );


    /******************************************************
     * OPERACIONES
     ******************************************************/

    switch (tipo) {

      case "gasto":

        return registrarGasto(
          datos
        );


      case "ingreso":

        return registrarIngreso(
          datos
        );


      case "pagotarjeta":

        return registrarPagoTarjeta(
          datos
        );


      case "guardarpresupuesto":

        return registrarPresupuesto(
          datos
        );


      case "guardarobligacion":

        return guardarObligacion(
          datos
        );


      case "pagarobligacion":

        return pagarObligacion(
          datos
        );


      case "transferencia":

        return registrarTransferencia(
          datos
        );


      case "guardarcuenta":

        return guardarCuentaV116(
          datos
        );


      case "guardarcategoria":

        return guardarCategoriaV116(
          datos
        );


      case "guardarsubcategoria":

        return guardarSubcategoriaV116(
          datos
        );


      case "guardarmeta":

        return guardarMetaV117(
          datos
        );


      case "aportemeta":

        return registrarAporteMetaV117(
          datos
        );


      case "consultasaldos":

        return consultarSaldos();


      case "consultatarjetas":

        return consultarTarjetas();


      case "consultacuotas":

        return consultarCuotas();


      case "cuotasatlas":

        return consultarCuotas(
          "Banco Atlas"
        );


      case "cuotasmedalla":

        return consultarCuotas(
          "Medalla Milagrosa"
        );


      case "cuotassancristobal":

        return consultarCuotas(
          "Cooperativa San Cristóbal"
        );


      /****************************************************
       * REGISTRAR PAGO DE CUOTA
       ****************************************************/

      case "cuotapagov1":

      case "pagocuota":

      case "pagoprestamo":

      case "registrarcuota":

        return registrarPagoCuotaV1(
          datos
        );


      default:

        return responder({

          ok: false,

          error:
            "Tipo de operación no reconocido",

          tipoRecibido:
            tipoOriginal,

          tipoNormalizado:
            tipo
        });
    }


  } catch (error) {

    return responder({

      ok: false,

      error:
        error.message
    });
  }
}


function obtenerTokenBackend_() {

  return String(
    PropertiesService
      .getScriptProperties()
      .getProperty(
        "BACKEND_V2_TOKEN"
      ) ||
      ""
  );
}


/************************************************************
 * REGISTRAR GASTO
 ************************************************************/

function registrarGasto(datos) {

  const monto =
    numero(
      datos.monto
    );


  if (
    monto <= 0
  ) {

    return responder({

      ok: false,

      error:
        "Monto inválido"
    });
  }


  const medio =
    String(
      datos.medioPago || ""
    ).trim();


  if (
    !medioGastoValidoV116_(
      medio
    )
  ) {

    return responder({

      ok: false,

      error:
        "Medio de pago inválido",

      recibido:
        medio
    });
  }


  const fecha =
    convertirFecha(
      datos.fecha
    );

  const categoriaCatalogo =
    resolverCategoriaV116_(
      SpreadsheetApp.openById(
        SPREADSHEET_ID
      ),
      datos.categoria || "Otros",
      datos.subcategoria || ""
    );

  if (!categoriaCatalogo) {
    return responder({
      ok: false,
      error:
        "Categoría o subcategoría inválida"
    });
  }


  obtenerHoja(
    "Gastos"
  ).appendRow([

    fecha,

    categoriaCatalogo.categoria,

    categoriaCatalogo.subcategoria ||
      "Otros",

    datos.descripcion ||
      "",

    monto,

    medioParaHojaV116_(
      medio
    ),

    datos.observacion ||
      "",

    "Atajo iPhone V1"
  ]);


  SpreadsheetApp.flush();


  return responder({

    ok: true,

    mensaje:
      "Gasto registrado",

    monto:
      monto,

    medioPago:
      medio,

    fecha:
      Utilities.formatDate(
        fecha,
        TZ,
        "dd/MM/yyyy"
      )
  });
}


/************************************************************
 * REGISTRAR INGRESO
 ************************************************************/

function registrarIngreso(datos) {

  const monto =
    numero(
      datos.monto
    );


  if (
    monto <= 0
  ) {

    return responder({

      ok: false,

      error:
        "Monto inválido"
    });
  }


  const cuenta =
    String(
      datos.cuentaDestino ||
      datos.medioPago ||
      ""
    ).trim();


  if (
    !cuentaValidaV116_(
      cuenta
    )
  ) {

    return responder({

      ok: false,

      error:
        "Cuenta destino inválida",

      recibido:
        cuenta
    });
  }


  const fecha =
    convertirFecha(
      datos.fecha
    );


  obtenerHoja(
    "Ingresos"
  ).appendRow([

    fecha,

    datos.tipoIngreso ||
      "Otro",

    datos.descripcion ||
      "",

    monto,

    cuentaParaHoja(
      cuenta
    ),

    datos.observacion ||
      "",

    "Atajo iPhone V1"
  ]);


  SpreadsheetApp.flush();


  return responder({

    ok: true,

    mensaje:
      "Ingreso registrado",

    monto:
      monto,

    cuentaDestino:
      cuenta,

    fecha:
      Utilities.formatDate(
        fecha,
        TZ,
        "dd/MM/yyyy"
      )
  });
}


/************************************************************
 * REGISTRAR PAGO DE TARJETA
 ************************************************************/

function registrarPagoTarjeta(
  datos
) {

  const monto =
    numero(
      datos.monto
    );


  if (
    monto <= 0
  ) {

    return responder({

      ok: false,

      error:
        "Monto inválido"
    });
  }


  const tarjeta =
    String(
      datos.tarjeta || ""
    ).trim();


  const cuenta =
    String(
      datos.cuentaOrigen || ""
    ).trim();


  const tarjetas = [

    "Tarjeta Ueno",
    "Tarjeta Continental",
    "Tarjeta GNB"
  ];


  if (
    !tarjetas.includes(
      tarjeta
    )
  ) {

    return responder({

      ok: false,

      error:
        "Tarjeta inválida"
    });
  }


  if (
    !cuentaValidaV116_(
      cuenta
    )
  ) {

    return responder({

      ok: false,

      error:
        "Cuenta de origen inválida"
    });
  }


  const fecha =
    convertirFecha(
      datos.fecha
    );


  obtenerHoja(
    "Pagos tarjetas"
  ).appendRow([

    fecha,

    tarjetaParaHoja(
      tarjeta
    ),

    monto,

    cuentaParaHoja(
      cuenta
    ),

    datos.observacion ||
      "",

    "Atajo iPhone V1"
  ]);


  SpreadsheetApp.flush();


  return responder({

    ok: true,

    mensaje:
      "Pago de tarjeta registrado",

    tarjeta:
      tarjeta,

    monto:
      monto,

    cuentaOrigen:
      cuenta,

    fecha:
      Utilities.formatDate(
        fecha,
        TZ,
        "dd/MM/yyyy"
      )
  });
}


/************************************************************
 * CONSULTAR SALDOS
 ************************************************************/

function consultarSaldos() {

  const hojaSaldos =
    obtenerHoja(
      "Saldos"
    );

  const ultimaFilaSaldos =
    hojaSaldos.getLastRow();

  const valores =
    ultimaFilaSaldos >= 3
      ? hojaSaldos
          .getRange(
            3,
            1,
            ultimaFilaSaldos - 2,
            6
          )
          .getValues()
      : [];


  const saldos = [];


  let totalHoja =
    null;


  valores.forEach(
    fila => {

      const cuenta =
        String(
          fila[0] || ""
        );


      if (!cuenta) {
        return;
      }


      if (
        normalizar(cuenta) ===
        "total"
      ) {

        totalHoja =
          numero(
            fila[5]
          );

        return;
      }


      const saldo =
        numero(
          fila[5]
        );


      saldos.push({

        cuenta:
          cuenta,

        saldo:
          saldo
      });

    }
  );


  aplicarTransferenciasV115ASaldos_(
    saldos
  );


  let texto =
    "💰 SALDOS DISPONIBLES\n\n";


  saldos.forEach(
    item => {
      texto +=
        item.cuenta +
        "\nGs. " +
        formatearMonto(
          item.saldo
        ) +
        "\n\n";
    }
  );


  const total =
    totalHoja !== null
      ? totalHoja
      : saldos.reduce(
          (suma, item) =>
            suma +
            item.saldo,
          0
        );


  texto +=
    "TOTAL DISPONIBLE\nGs. " +
    formatearMonto(
      total
    );


  return responder({

    ok: true,

    tipo:
      "saldos",

    saldos:
      saldos,

    total:
      total,

    texto:
      texto
  });
}


/************************************************************
 * CONSULTAR TARJETAS
 ************************************************************/

function consultarTarjetas() {

  const hoja =
    obtenerHoja(
      "Tarjetas"
    );


  const ultimaFila =
    hoja.getLastRow();


  const valores =
    ultimaFila < 2
      ? []
      : hoja
          .getRange(
            2,
            1,
            ultimaFila - 1,
            12
          )
          .getValues()
          .filter(
            fila =>
              String(
                fila[0] || ""
              ).trim()
          );


  const tarjetas = [];


  let texto =
    "💳 TARJETAS DE CRÉDITO\n\n";


  valores.forEach(
    fila => {

      const tarjeta = {

        nombre:
          fila[0],

        limite:
          numero(
            fila[2]
          ),

        deuda:
          numero(
            fila[3]
          ),

        disponible:
          numero(
            fila[4]
          ),

        pagoMinimo:
          numero(
            fila[10]
          ),

        estadoMinimo:
          fila[11] || ""
      };


      tarjetas.push(
        tarjeta
      );


      texto +=
        tarjeta.nombre +
        "\n";


      texto +=
        "Línea: Gs. " +
        formatearMonto(
          tarjeta.limite
        ) +
        "\n";


      texto +=
        "Deuda: Gs. " +
        formatearMonto(
          tarjeta.deuda
        ) +
        "\n";


      texto +=
        "Disponible: Gs. " +
        formatearMonto(
          tarjeta.disponible
        ) +
        "\n";


      texto +=
        "Pago mínimo: Gs. " +
        formatearMonto(
          tarjeta.pagoMinimo
        ) +
        "\n";


      texto +=
        "Mínimo: " +
        tarjeta.estadoMinimo +
        "\n\n";
    }
  );


  return responder({

    ok: true,

    tipo:
      "tarjetas",

    tarjetas:
      tarjetas,

    texto:
      texto
  });
}


/************************************************************
 * CONSULTAR CUOTAS
 ************************************************************/

function consultarCuotas(
  entidadFiltro
) {

  const hoja =
    obtenerHoja(
      "Mis cuotas"
    );


  const ultimaFila =
    hoja.getLastRow();


  if (
    ultimaFila < 8
  ) {

    return responder({

      ok: true,

      cuotas:
        [],

      texto:
        "No hay cuotas registradas."
    });
  }


  const valores =
    hoja
      .getRange(
        8,
        1,
        ultimaFila - 7,
        8
      )
      .getValues();


  const cuotas = [];


  valores.forEach(
    fila => {

      const entidad =
        String(
          fila[0] || ""
        );


      const cuota =
        numero(
          fila[1]
        );


      const vence =
        fila[2];


      const monto =
        numero(
          fila[3]
        );


      const estado =
        String(
          fila[4] || ""
        );


      const pagado =
        numero(
          fila[6]
        );


      const saldo =
        numero(
          fila[7]
        );


      if (
        !entidad ||
        cuota <= 0
      ) {
        return;
      }


      if (
        entidadFiltro &&
        normalizar(
          entidad
        ) !==
        normalizar(
          entidadFiltro
        )
      ) {
        return;
      }


      if (
        saldo <= 0
      ) {
        return;
      }


      cuotas.push({

        entidad:
          entidad,

        cuota:
          cuota,

        vence:
          vence,

        monto:
          monto,

        pagado:
          pagado,

        saldo:
          saldo,

        estado:
          estado
      });
    }
  );


  cuotas.sort(
    (a, b) =>
      fechaTimestamp(
        a.vence
      ) -
      fechaTimestamp(
        b.vence
      )
  );


  let texto =
    "📅 PRÓXIMAS CUOTAS\n\n";


  cuotas
    .slice(
      0,
      10
    )
    .forEach(
      c => {

        texto +=
          c.entidad +
          "\n";


        texto +=
          "Cuota " +
          c.cuota +
          "\n";


        texto +=
          "Vence: " +
          formatearFecha(
            c.vence
          ) +
          "\n";


        texto +=
          "Saldo: Gs. " +
          formatearMonto(
            c.saldo
          ) +
          "\n\n";
      }
    );


  if (
    cuotas.length === 0
  ) {

    texto +=
      "No hay cuotas pendientes.";
  }


  return responder({

    ok: true,

    tipo:
      "cuotas",

    cantidad:
      cuotas.length,

    cuotas:
      cuotas,

    texto:
      texto
  });
}


/************************************************************
 * REGISTRAR PAGO DE CUOTA
 ************************************************************/

function registrarPagoCuotaV1(
  datos
) {

  const lock =
    LockService.getScriptLock();


  try {

    const entidadRecibida =
      campoJSON_(
        datos,
        [
          "entidad",
          "entidadPago",
          "empresa"
        ]
      );


    const entidad =
      identificarEntidad(
        String(
          entidadRecibida ?? ""
        )
          .replace(
            /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,
            ""
          )
      );


    const cuota =
      numero(
        campoJSON_(
          datos,
          "cuota"
        )
      );


    const monto =
      numero(
        campoJSON_(
          datos,
          "monto"
        ) ||
        campoJSON_(
          datos,
          "montoPagado"
        )
      );


    const fecha =
      convertirFecha(
        campoJSON_(
          datos,
          "fecha"
        ) ||
        campoJSON_(
          datos,
          "fechaPago"
        )
      );


    const cuentaOrigenRecibida =
      campoJSON_(
        datos,
        [
          "cuentaOrigen",
          "cuenta",
          "medioPago"
        ]
      );


    const cuentaOrigenTexto =
      String(
        cuentaOrigenRecibida ?? ""
      ).trim();


    if (!entidad) {

      return responder({

        ok: false,

        error:
          "Entidad no reconocida",

        recibido:
          entidadRecibida ?? "",

        clavesRecibidas:
          Object.keys(
            datos || {}
          )
      });
    }


    if (
      cuota <= 0
    ) {

      return responder({

        ok: false,

        error:
          "Número de cuota inválido"
      });
    }


    if (
      monto <= 0
    ) {

      return responder({

        ok: false,

        error:
          "Monto de pago inválido"
      });
    }


    lock.waitLock(
      30000
    );


    const registroEntidad =
      localizarCuotaEntidad(
        entidad,
        cuota
      );


    const registroMisCuotas =
      localizarCuotaMisCuotas(
        entidad,
        cuota
      );


    const entidadPagada =
      normalizar(
        registroEntidad.estado
      ) === "pagado";


    const misCuotasPagada =
      normalizar(
        registroMisCuotas.estado
      ) === "pagado";


    let salidaFinanciera =
      localizarSalidaPagoCuota_(
        entidad,
        cuota
      );


    let cuentaOrigen =
      null;


    if (
      salidaFinanciera &&
      salidaFinanciera.monto !==
        registroEntidad.total
    ) {
      return responder({
        ok: false,
        error:
          "La salida financiera existente no coincide con la cuota"
      });
    }


    if (
      cuentaOrigenTexto
    ) {

      cuentaOrigen =
        resolverCuentaV116_(
          cuentaOrigenTexto,
          true
        );


      if (!cuentaOrigen) {
        return responder({
          ok: false,
          error:
            "La cuenta de origen no existe o está inactiva"
        });
      }


      if (
        monto !==
        registroEntidad.total
      ) {
        return responder({
          ok: false,
          error:
            "El monto debe coincidir con el monto completo de la cuota"
        });
      }


      if (
        registroMisCuotas.total > 0 &&
        registroMisCuotas.total !==
          registroEntidad.total
      ) {
        return responder({
          ok: false,
          error:
            "El monto de la cuota no coincide entre las hojas"
        });
      }


      if (
        salidaFinanciera &&
        (
          normalizar(
            salidaFinanciera.cuenta
          ) !==
            normalizar(
              cuentaOrigen.nombreSaldos
            )
        )
      ) {
        return responder({
          ok: false,
          error:
            "La salida financiera existente no coincide con la cuota"
        });
      }
    }


    const faltabaSalida =
      Boolean(
        cuentaOrigen &&
        !salidaFinanciera
      );


    const yaPagada =
      entidadPagada &&
      misCuotasPagada &&
      (
        !cuentaOrigen ||
        !faltabaSalida
      );


    const reconciliada =
      !yaPagada &&
      (
        entidadPagada ||
        misCuotasPagada ||
        Boolean(
          salidaFinanciera
        )
      );


    const fechaEfectiva =
      fechaPagoExistenteCuota_(
        registroEntidad,
        registroMisCuotas,
        salidaFinanciera,
        fecha
      );


    const montoEfectivo =
      cuentaOrigen ||
      salidaFinanciera
        ? registroEntidad.total
        : monto;


    if (
      cuentaOrigen &&
      !salidaFinanciera
    ) {
      salidaFinanciera =
        registrarSalidaPagoCuota_(
          entidad,
          cuota,
          registroEntidad.total,
          cuentaOrigen.nombreSaldos,
          fechaEfectiva
        );
    }


    let resultado = {
      total:
        registroEntidad.total,
      pagadoAnterior:
        registroEntidad.pagado,
      pagado:
        montoEfectivo,
      saldo:
        0,
      estado:
        "Pagado",
      fecha:
        fechaEfectiva
    };


    if (!entidadPagada) {

      if (
        entidad ===
        "Banco Atlas"
      ) {
        resultado =
          registrarPagoAtlas(
            registroEntidad,
            montoEfectivo,
            fechaEfectiva
          );

      } else if (
        entidad ===
        "Medalla Milagrosa"
      ) {
        resultado =
          registrarPagoMedalla(
            registroEntidad,
            montoEfectivo,
            fechaEfectiva
          );

      } else if (
        entidad ===
        "Cooperativa San Cristóbal"
      ) {
        resultado =
          registrarPagoSanCristobal(
            registroEntidad,
            montoEfectivo,
            fechaEfectiva
          );
      }
    }


    if (!misCuotasPagada) {
      sincronizarMisCuotas(
        registroMisCuotas,
        montoEfectivo,
        fechaEfectiva
      );
    }


    SpreadsheetApp.flush();


    const advertencia =
      !cuentaOrigen &&
      !salidaFinanciera
        ? "No se descontó ninguna cuenta porque no se recibió cuentaOrigen."
        : "";


    return responder({

      ok: true,

      yaPagada:
        yaPagada,

      reconciliada:
        reconciliada,

      mensaje:
        reconciliada
          ? "Pago reconciliado correctamente"
          : yaPagada
            ? "La cuota ya estaba pagada"
            : "Pago registrado correctamente",

      advertencia:
        advertencia,

      saldoDescontado:
        Boolean(
          salidaFinanciera
        ),

      cuentaOrigen:
        salidaFinanciera
          ? salidaFinanciera.cuenta
          : "",

      referencia:
        salidaFinanciera
          ? salidaFinanciera.referencia
          : "",

      entidad:
        entidad,

      cuota:
        cuota,

      pagoRealizado:
        montoEfectivo,

      totalCuota:
        resultado.total,

      pagadoAnterior:
        resultado.pagadoAnterior,

      pagadoAcumulado:
        resultado.pagado,

      saldo:
        resultado.saldo,

      estado:
        resultado.estado,

      fechaPago:
        Utilities.formatDate(
          fechaEfectiva,
          TZ,
          "dd/MM/yyyy"
        )
    });


  } catch (error) {

    return responder({

      ok: false,

      error:
        error.message
    });

  } finally {

    if (
      lock.hasLock()
    ) {

      lock.releaseLock();
    }
  }
}


/************************************************************
 * SALIDA FINANCIERA DE PAGO DE CUOTA
 ************************************************************/

function referenciaPagoCuota_(
  entidad,
  cuota
) {

  return (
    "PAGO-CUOTA|" +
    normalizar(
      entidad
    ) +
    "|" +
    cuota
  );
}


function localizarSalidaPagoCuota_(
  entidad,
  cuota
) {

  const hoja =
    obtenerHoja(
      "Gastos"
    );


  const ultimaFila =
    hoja.getLastRow();


  if (
    ultimaFila < 2
  ) {
    return null;
  }


  const referencia =
    referenciaPagoCuota_(
      entidad,
      cuota
    );


  const valores =
    hoja
      .getRange(
        2,
        1,
        ultimaFila - 1,
        8
      )
      .getValues();


  for (
    let i = 0;
    i < valores.length;
    i++
  ) {

    if (
      String(
        valores[i][6] || ""
      ).trim() === referencia &&
      normalizar(
        valores[i][7]
      ) === "pagodecuota"
    ) {
      return {
        hoja:
          hoja,
        fila:
          i + 2,
        fecha:
          valores[i][0],
        monto:
          numero(
            valores[i][4]
          ),
        cuenta:
          String(
            valores[i][5] || ""
          ).trim(),
        referencia:
          referencia
      };
    }
  }


  return null;
}


function registrarSalidaPagoCuota_(
  entidad,
  cuota,
  monto,
  cuentaOrigen,
  fecha
) {

  const hoja =
    obtenerHoja(
      "Gastos"
    );


  const referencia =
    referenciaPagoCuota_(
      entidad,
      cuota
    );


  hoja.appendRow([
    fecha,
    "Otros",
    "Otros",
    "Pago cuota " +
      entidad +
      " #" +
      cuota,
    monto,
    cuentaOrigen,
    referencia,
    "Pago de cuota"
  ]);


  return {
    hoja:
      hoja,
    fila:
      hoja.getLastRow(),
    fecha:
      fecha,
    monto:
      monto,
    cuenta:
      cuentaOrigen,
    referencia:
      referencia
  };
}


function fechaPagoExistenteCuota_(
  registroEntidad,
  registroMisCuotas,
  salidaFinanciera,
  fechaSolicitada
) {

  const candidatas = [
    registroEntidad.fecha,
    registroMisCuotas.fecha,
    salidaFinanciera
      ? salidaFinanciera.fecha
      : null
  ];


  for (
    let i = 0;
    i < candidatas.length;
    i++
  ) {
    if (
      candidatas[i] instanceof Date &&
      !isNaN(
        candidatas[i].getTime()
      )
    ) {
      return candidatas[i];
    }
  }


  return fechaSolicitada;
}


/************************************************************
 * LOCALIZAR CUOTA EN LA HOJA DE LA ENTIDAD
 ************************************************************/

function localizarCuotaEntidad(
  entidad,
  cuota
) {

  let configuracion;


  if (
    entidad ===
    "Banco Atlas"
  ) {

    configuracion = {
      hoja: "Banco Atlas",
      filaInicio: 8,
      columnaTotal: 3,
      columnaEstado: 4,
      columnaFecha: 5,
      columnaPagado: 6
    };

  } else if (
    entidad ===
    "Medalla Milagrosa"
  ) {

    configuracion = {
      hoja: "Medalla Milagrosa",
      filaInicio: 9,
      columnaTotal: 11,
      columnaEstado: 12,
      columnaFecha: 13,
      columnaPagado: 14
    };

  } else if (
    entidad ===
    "Cooperativa San Cristóbal"
  ) {

    configuracion = {
      hoja: "San Cristobal",
      filaInicio: 8,
      columnaTotal: 7,
      columnaEstado: 8,
      columnaFecha: 9,
      columnaPagado: 10
    };
  }


  if (!configuracion) {

    throw new Error(
      "Entidad no reconocida"
    );
  }


  const hoja =
    obtenerHoja(
      configuracion.hoja
    );


  const fila =
    buscarFilaCuota(
      hoja,
      cuota,
      configuracion.filaInicio
    );


  if (!fila) {

    throw new Error(
      "No se encontró la cuota " +
      cuota +
      " en " +
      entidad
    );
  }


  const total =
    numero(
      hoja
        .getRange(
          fila,
          configuracion.columnaTotal
        )
        .getValue()
    );


  if (
    total <= 0
  ) {

    throw new Error(
      "La cuota no tiene un monto válido"
    );
  }


  return {

    hoja:
      hoja,

    fila:
      fila,

    total:
      total,

    estado:
      hoja
        .getRange(
          fila,
          configuracion.columnaEstado
        )
        .getValue(),

    fecha:
      hoja
        .getRange(
          fila,
          configuracion.columnaFecha
        )
        .getValue(),

    pagado:
      numero(
        hoja
          .getRange(
            fila,
            configuracion.columnaPagado
          )
          .getValue()
      )
  };
}


/************************************************************
 * BANCO ATLAS
 *
 * A Nro.
 * B Vencimiento
 * C Total
 * D Estado
 * E Fecha pago
 * F Pagado
 * G Saldo
 ************************************************************/

function registrarPagoAtlas(
  registro,
  monto,
  fecha
) {

  registro.hoja
    .getRange(
      registro.fila,
      4,
      1,
      4
    )
    .setValues([
      [
        "Pagado",
        fecha,
        monto,
        0
      ]
    ]
    );


  return {

    total:
      registro.total,

    pagadoAnterior:
      registro.pagado,

    pagado:
      monto,

    saldo:
      0,

    estado:
      "Pagado",

    fecha:
      fecha
  };
}


/************************************************************
 * MEDALLA MILAGROSA
 *
 * A Cuota
 * B Vencimiento
 * K Importe cuota
 * L Estado
 * M Fecha pago
 * N Monto pagado
 ************************************************************/

function registrarPagoMedalla(
  registro,
  monto,
  fecha
) {

  registro.hoja
    .getRange(
      registro.fila,
      12,
      1,
      3
    )
    .setValues([
      [
        "Pagado",
        fecha,
        monto
      ]
    ]
    );


  return {

    total:
      registro.total,

    pagadoAnterior:
      registro.pagado,

    pagado:
      monto,

    saldo:
      0,

    estado:
      "Pagado",

    fecha:
      fecha
  };
}


/************************************************************
 * SAN CRISTÓBAL
 *
 * A Nro.
 * B Vencimiento
 * G Total
 * H Estado
 * I Fecha pago
 * J Pagado
 * K Saldo
 ************************************************************/

function registrarPagoSanCristobal(
  registro,
  monto,
  fecha
) {

  registro.hoja
    .getRange(
      registro.fila,
      8,
      1,
      4
    )
    .setValues([
      [
        "Pagado",
        fecha,
        monto,
        0
      ]
    ]
    );


  return {

    total:
      registro.total,

    pagadoAnterior:
      registro.pagado,

    pagado:
      monto,

    saldo:
      0,

    estado:
      "Pagado",

    fecha:
      fecha
  };
}


/************************************************************
 * LOCALIZAR CUOTA EN MIS CUOTAS
 ************************************************************/

function localizarCuotaMisCuotas(
  entidad,
  cuota
) {

  const hoja =
    obtenerHoja(
      "Mis cuotas"
    );


  const ultimaFila =
    hoja.getLastRow();


  if (
    ultimaFila < 8
  ) {

    throw new Error(
      "Mis cuotas no tiene registros"
    );
  }


  const valores =
    hoja
      .getRange(
        8,
        1,
        ultimaFila - 7,
        8
      )
      .getValues();


  for (
    let i = 0;
    i < valores.length;
    i++
  ) {

    const entidadFila =
      normalizar(
        valores[i][0]
      );


    const cuotaFila =
      numero(
        valores[i][1]
      );


    if (
      entidadFila ===
        normalizar(
          entidad
        ) &&
      cuotaFila ===
        cuota
    ) {

      return {

        hoja:
          hoja,

        fila:
          i + 8,

        total:
          numero(
            valores[i][3]
          ),

        estado:
          valores[i][4],

        fecha:
          valores[i][5],

        pagado:
          numero(
            valores[i][6]
          )
      };
    }
  }


  throw new Error(
    "No se encontró " +
    entidad +
    " cuota " +
    cuota +
    " en Mis cuotas"
  );
}


/************************************************************
 * SINCRONIZAR MIS CUOTAS
 ************************************************************/

function sincronizarMisCuotas(
  registro,
  monto,
  fecha
) {

  registro.hoja
    .getRange(
      registro.fila,
      5,
      1,
      4
    )
    .setValues([
      [
        "Pagado",
        fecha,
        monto,
        0
      ]
    ]
    );
}


/************************************************************
 * BUSCAR FILA DE CUOTA
 ************************************************************/

function buscarFilaCuota(
  hoja,
  cuota,
  filaInicio
) {

  const ultimaFila =
    hoja.getLastRow();


  if (
    ultimaFila <
    filaInicio
  ) {

    return null;
  }


  const valores =
    hoja
      .getRange(
        filaInicio,
        1,
        ultimaFila -
          filaInicio +
          1,
        1
      )
      .getValues();


  for (
    let i = 0;
    i < valores.length;
    i++
  ) {

    if (
      numero(
        valores[i][0]
      ) ===
      cuota
    ) {

      return (
        filaInicio +
        i
      );
    }
  }


  return null;
}


/************************************************************
 * IDENTIFICAR ENTIDAD
 ************************************************************/

function identificarEntidad(
  valor
) {

  const texto =
    normalizar(
      valor
    );


  if (
    texto.includes(
      "atlas"
    )
  ) {

    return "Banco Atlas";
  }


  if (
    texto.includes(
      "medalla"
    )
  ) {

    return "Medalla Milagrosa";
  }


  if (
    texto.includes(
      "sancristobal"
    )
  ) {

    return "Cooperativa San Cristóbal";
  }


  return null;
}


/************************************************************
 * MAPEO DE CUENTAS
 ************************************************************/

function cuentaParaHoja(
  cuenta
) {

  const cuentaCatalogo =
    resolverCuentaV116_(
      cuenta,
      false
    );


  if (cuentaCatalogo) {
    return cuentaCatalogo.nombreSaldos;
  }

  const mapa = {

    "Efectivo":
      "Efectivo",

    "Cuenta Ueno":
      "Ueno",

    "Cuenta Continental":
      "Banco Continental",

    "Cuenta Atlas":
      "Banco Atlas",

    "Cuenta GNB":
      "Banco GNB",

    "Otro":
      "Otro"
  };


  return (
    mapa[cuenta] ||
    cuenta
  );
}


/************************************************************
 * MAPEO DE TARJETAS
 ************************************************************/

function tarjetaParaHoja(
  tarjeta
) {

  const mapa = {

    "Tarjeta Ueno":
      "Ueno",

    "Tarjeta Continental":
      "Continental",

    "Tarjeta GNB":
      "Banco GNB"
  };


  return (
    mapa[tarjeta] ||
    tarjeta
  );
}


/************************************************************
 * CONVERTIR FECHA
 *
 * CORRECCIÓN IMPORTANTE PARA IPHONE
 *
 * Evita que:
 *
 * 2026-09-08T00:00:00Z
 *
 * termine como:
 *
 * 07/09/2026 21:00
 *
 * Conservamos la fecha enviada por el Atajo.
 ************************************************************/

function convertirFecha(
  valor
) {

  if (!valor) {

    return new Date();
  }


  if (
    valor instanceof Date
  ) {

    if (
      isNaN(
        valor.getTime()
      )
    ) {
      throw new Error(
        "Fecha inválida"
      );
    }


    return valor;
  }


  const texto =
    String(
      valor
    ).trim();


  let m;


  /********************************************************
   * DD/MM/YYYY
   * DD/MM/YYYY HH:mm
   * DD/MM/YYYY HH:mm:ss
   ********************************************************/

  m =
    texto.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );


  if (m) {

    return crearFechaCalendarioValida_(
      Number(
        m[3]
      ),

      Number(
        m[2]
      ) - 1,

      Number(
        m[1]
      ),

      Number(
        m[4] || 12
      ),

      Number(
        m[5] || 0
      ),

      Number(
        m[6] || 0
      )
    );
  }


  /********************************************************
   * YYYY-MM-DD
   ********************************************************/

  m =
    texto.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );


  if (m) {

    return crearFechaCalendarioValida_(
      Number(
        m[1]
      ),

      Number(
        m[2]
      ) - 1,

      Number(
        m[3]
      ),

      12,
      0,
      0
    );
  }


  /********************************************************
   * ISO DE IPHONE
   *
   * 2026-09-08T00:00:00Z
   * 2026-09-08T00:00:00.000Z
   * 2026-09-08T00:00:00-03:00
   *
   * Nos interesa la fecha enviada:
   * 2026-09-08
   *
   * La guardamos a las 12:00 para evitar
   * desplazamientos de zona horaria.
   ********************************************************/

  m =
    texto.match(
      /^(\d{4})-(\d{2})-(\d{2})T/
    );


  if (m) {

    return crearFechaCalendarioValida_(
      Number(
        m[1]
      ),

      Number(
        m[2]
      ) - 1,

      Number(
        m[3]
      ),

      12,
      0,
      0
    );
  }


  /********************************************************
   * ÚLTIMO INTENTO
   ********************************************************/

  const fecha =
    new Date(
      texto
    );


  if (
    !isNaN(
      fecha.getTime()
    )
  ) {

    return fecha;
  }


  throw new Error(
    "Fecha inválida: " +
    texto
  );
}


function crearFechaCalendarioValida_(
  anio,
  mesIndice,
  dia,
  hora,
  minuto,
  segundo
) {

  if (
    !Number.isInteger(anio) ||
    !Number.isInteger(mesIndice) ||
    !Number.isInteger(dia) ||
    !Number.isInteger(hora) ||
    !Number.isInteger(minuto) ||
    !Number.isInteger(segundo) ||
    mesIndice < 0 ||
    mesIndice > 11 ||
    dia < 1 ||
    hora < 0 ||
    hora > 23 ||
    minuto < 0 ||
    minuto > 59 ||
    segundo < 0 ||
    segundo > 59
  ) {
    throw new Error(
      "Fecha inválida"
    );
  }


  const fecha =
    new Date(
      anio,
      mesIndice,
      dia,
      hora,
      minuto,
      segundo
    );


  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mesIndice ||
    fecha.getDate() !== dia ||
    fecha.getHours() !== hora ||
    fecha.getMinutes() !== minuto ||
    fecha.getSeconds() !== segundo
  ) {
    throw new Error(
      "Fecha inválida"
    );
  }


  return fecha;
}


/************************************************************
 * FORMATEAR FECHA
 ************************************************************/

function formatearFecha(
  valor
) {

  if (!valor) {

    return "";
  }


  const fecha =
    valor instanceof Date
      ? valor
      : new Date(
          valor
        );


  if (
    isNaN(
      fecha.getTime()
    )
  ) {

    return String(
      valor
    );
  }


  return Utilities.formatDate(

    fecha,

    TZ,

    "dd/MM/yyyy"
  );
}


/************************************************************
 * TIMESTAMP DE FECHA
 ************************************************************/

function fechaTimestamp(
  valor
) {

  if (
    valor instanceof Date
  ) {

    return valor.getTime();
  }


  const fecha =
    new Date(
      valor
    );


  return isNaN(
    fecha.getTime()
  )
    ? Number.MAX_SAFE_INTEGER
    : fecha.getTime();
}


/************************************************************
 * CONVERTIR NÚMERO
 ************************************************************/

function numero(
  valor
) {

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


  let texto =
    String(
      valor
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


  /********************************************************
   * 1.000.000
   ********************************************************/

  if (
    /^-?\d{1,3}(\.\d{3})+$/
      .test(
        texto
      )
  ) {

    texto =
      texto.replace(
        /\./g,
        ""
      );
  }


  /********************************************************
   * 1,000,000
   ********************************************************/

  if (
    /^-?\d{1,3}(,\d{3})+$/
      .test(
        texto
      )
  ) {

    texto =
      texto.replace(
        /,/g,
        ""
      );
  }


  const resultado =
    Number(
      texto
    );


  return isNaN(
    resultado
  )
    ? 0
    : resultado;
}


/************************************************************
 * FORMATEAR MONTO
 ************************************************************/

function formatearMonto(
  valor
) {

  const n =
    Math.round(
      numero(
        valor
      )
    );


  const signo =
    n < 0
      ? "-"
      : "";


  return (
    signo +
    String(
      Math.abs(
        n
      )
    ).replace(
      /\B(?=(\d{3})+(?!\d))/g,
      "."
    )
  );
}


/************************************************************
 * NORMALIZAR CLAVE JSON
 ************************************************************/

function normalizarClaveJSON_(
  valor
) {

  return String(
    valor ?? ""
  )
    .replace(
      /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,
      ""
    )
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /[_-]/g,
      ""
    )
    .trim();
}


/************************************************************
 * OBTENER CAMPO JSON POR CLAVE NORMALIZADA
 ************************************************************/

function campoJSON_(
  datos,
  nombres
) {

  const lista =
    Array.isArray(
      nombres
    )
      ? nombres
      : [nombres];


  const buscados =
    lista.map(
      normalizarClaveJSON_
    );


  for (
    const clave of
      Object.keys(
        datos || {}
      )
  ) {

    if (
      buscados.includes(
        normalizarClaveJSON_(
          clave
        )
      )
    ) {

      return datos[clave];
    }
  }


  return undefined;
}


/************************************************************
 * NORMALIZAR TEXTO
 ************************************************************/

function normalizar(
  valor
) {

  return String(
    valor || ""
  )
    .toLowerCase()
    .normalize(
      "NFD"
    )
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


/************************************************************
 * OBTENER HOJA
 ************************************************************/

function obtenerHoja(
  nombre
) {

  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const hoja =
    ss.getSheetByName(
      nombre
    );


  if (!hoja) {

    throw new Error(
      "No existe la hoja: " +
      nombre
    );
  }


  return hoja;
}


/************************************************************
 * RESPONDER JSON
 ************************************************************/

function responder(
  objeto
) {

  return ContentService

    .createTextOutput(
      JSON.stringify(
        objeto
      )
    )

    .setMimeType(
      ContentService
        .MimeType
        .JSON
    );
}
