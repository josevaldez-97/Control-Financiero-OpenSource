const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.resolve(__dirname, "..");
const backendDir = path.join(raiz, "backend-atajos-v1");
const backendNombre = fs.readdirSync(backendDir)
  .find(nombre => nombre.startsWith("C") && nombre.endsWith(".js"));
const backendCodigo = fs.readFileSync(path.join(backendDir, backendNombre), "utf8");
const dashboardCodigo = fs.readFileSync(
  path.join(raiz, "dashboard-mobile", "MobileDashboard.js"),
  "utf8"
);
const html = fs.readFileSync(
  path.join(raiz, "dashboard-mobile", "index.html"),
  "utf8"
);

class HojaSimulada {
  constructor(filas) {
    this.filas = filas.map(fila => fila.slice());
  }

  getLastRow() {
    return this.filas.length;
  }

  getRange(fila, columna, alto, ancho) {
    alto = alto || 1;
    ancho = ancho || 1;
    const hoja = this;

    function leer() {
      return Array.from({ length: alto }, (_, i) =>
        Array.from({ length: ancho }, (_, j) =>
          (hoja.filas[fila - 1 + i] || [])[columna - 1 + j] ?? ""
        )
      );
    }

    return {
      getValue: () => leer()[0][0],
      getValues: () => leer(),
      setValues: valores => {
        valores.forEach((valoresFila, i) => {
          const indiceFila = fila - 1 + i;
          while (hoja.filas.length <= indiceFila) hoja.filas.push([]);
          valoresFila.forEach((valor, j) => {
            hoja.filas[indiceFila][columna - 1 + j] = valor;
          });
        });
      }
    };
  }

  appendRow(valores) {
    this.filas.push(valores.slice());
  }
}

function filasVacias(cantidad, columnas) {
  return Array.from({ length: cantidad }, () => Array(columnas).fill(""));
}

function escenario(entidad, opciones) {
  opciones = opciones || {};
  const cuota = opciones.cuota || 1;
  const monto = opciones.monto || 250000;
  const entidadPagada = opciones.entidadPagada === true;
  const misPagada = opciones.misPagada === true;
  let hojaEntidad;
  let nombreHoja;

  if (entidad === "Medalla Milagrosa") {
    const filas = filasVacias(9, 14);
    filas[8][0] = cuota;
    filas[8][10] = monto;
    filas[8][11] = entidadPagada ? "Pagado" : "Pendiente";
    filas[8][12] = entidadPagada ? new Date(2026, 8, 15) : "";
    filas[8][13] = entidadPagada ? monto : 0;
    hojaEntidad = new HojaSimulada(filas);
    nombreHoja = "Medalla Milagrosa";
  } else {
    const filas = filasVacias(8, 11);
    filas[7][0] = cuota;
    filas[7][6] = monto;
    filas[7][7] = entidadPagada ? "Pagado" : "Pendiente";
    filas[7][8] = entidadPagada ? new Date(2026, 8, 15) : "";
    filas[7][9] = entidadPagada ? monto : 0;
    filas[7][10] = entidadPagada ? 0 : monto;
    hojaEntidad = new HojaSimulada(filas);
    nombreHoja = "San Cristobal";
  }

  const filasMisCuotas = filasVacias(8, 8);
  filasMisCuotas[7] = [
    entidad,
    cuota,
    "",
    monto,
    misPagada ? "Pagado" : "Pendiente",
    misPagada ? new Date(2026, 8, 15) : "",
    misPagada ? monto : 0,
    misPagada ? 0 : monto
  ];

  const gastos = new HojaSimulada([
    ["Fecha", "Categoría", "Subcategoría", "Descripción", "Monto", "Medio", "Observación", "Origen"]
  ]);

  if (opciones.salida) {
    gastos.appendRow([
      new Date(2026, 8, 15),
      "Otros",
      "Otros",
      "Pago cuota " + entidad + " #" + cuota,
      opciones.salida.monto || monto,
      opciones.salida.cuenta,
      "PAGO-CUOTA|" + normalizarPrueba(entidad) + "|" + cuota,
      "Pago de cuota"
    ]);
  }

  return {
    hojas: {
      [nombreHoja]: hojaEntidad,
      "Mis cuotas": new HojaSimulada(filasMisCuotas),
      Gastos: gastos
    },
    hojaEntidad,
    gastos,
    monto,
    cuota
  };
}

function normalizarPrueba(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

let lockActivo = false;
let esperasLock = 0;
let liberacionesLock = 0;
let escenarioActual;
const cuentas = {
  "cuentacontinental": {
    nombre: "Cuenta Continental",
    nombreSaldos: "Banco Continental",
    activa: true
  },
  "cuentagnb": {
    nombre: "Cuenta GNB",
    nombreSaldos: "Banco GNB",
    activa: true
  },
  "cuentainactiva": {
    nombre: "Cuenta inactiva",
    nombreSaldos: "Cuenta inactiva",
    activa: false
  }
};

const backend = {
  Date,
  Number,
  String,
  Object,
  Array,
  Math,
  JSON,
  console,
  LockService: {
    getScriptLock: () => ({
      waitLock: () => {
        assert.strictEqual(lockActivo, false, "no debe iniciar dos pagos simultáneos");
        lockActivo = true;
        esperasLock++;
      },
      hasLock: () => lockActivo,
      releaseLock: () => {
        lockActivo = false;
        liberacionesLock++;
      }
    })
  },
  SpreadsheetApp: { flush() {} },
  Utilities: {
    formatDate: fecha => [
      String(fecha.getDate()).padStart(2, "0"),
      String(fecha.getMonth() + 1).padStart(2, "0"),
      fecha.getFullYear()
    ].join("/")
  }
};

vm.createContext(backend);
vm.runInContext(backendCodigo, backend);
backend.responder = valor => valor;
backend.obtenerHoja = nombre => {
  const hoja = escenarioActual.hojas[nombre];
  if (!hoja) throw new Error("Hoja inesperada: " + nombre);
  return hoja;
};
backend.resolverCuentaV116_ = (valor, exigirActiva) => {
  const cuenta = cuentas[normalizarPrueba(valor)] || null;
  return cuenta && (!exigirActiva || cuenta.activa) ? cuenta : null;
};

function pagar(datos) {
  return backend.registrarPagoCuotaV1(datos);
}

escenarioActual = escenario("Medalla Milagrosa");
const pagoMedalla = pagar({
  entidad: "Medalla Milagrosa",
  cuota: 1,
  montoPagado: escenarioActual.monto,
  fechaPago: "15/09/2026",
  cuenta: "Cuenta Continental",
  requestId: "cuota-medalla-0001"
});
assert.strictEqual(pagoMedalla.ok, true);
assert.strictEqual(pagoMedalla.saldoDescontado, true);
assert.strictEqual(pagoMedalla.cuentaOrigen, "Banco Continental");
assert.strictEqual(escenarioActual.hojaEntidad.filas[8][11], "Pagado");
assert.strictEqual(escenarioActual.hojas["Mis cuotas"].filas[7][4], "Pagado");
assert.strictEqual(escenarioActual.gastos.filas.length, 2);
assert.deepStrictEqual(
  Array.from(escenarioActual.gastos.filas[1].slice(1)),
  [
    "Otros",
    "Otros",
    "Pago cuota Medalla Milagrosa #1",
    escenarioActual.monto,
    "Banco Continental",
    "PAGO-CUOTA|medallamilagrosa|1",
    "Pago de cuota"
  ]
);

const pagoMedallaDuplicado = pagar({
  entidad: "Medalla Milagrosa",
  cuota: 1,
  monto: escenarioActual.monto,
  fecha: "15/09/2026",
  cuentaOrigen: "Cuenta Continental",
  requestId: "cuota-medalla-0001"
});
assert.strictEqual(pagoMedallaDuplicado.ok, true);
assert.strictEqual(pagoMedallaDuplicado.yaPagada, true);
assert.strictEqual(escenarioActual.gastos.filas.length, 2, "un reintento no duplica el gasto");

escenarioActual = escenario("Cooperativa San Cristóbal", { cuota: 3, monto: 180000 });
const pagoSanCristobal = pagar({
  empresa: "Cooperativa San Cristóbal",
  cuota: 3,
  monto: 180000,
  fecha: "16/09/2026",
  medioPago: "Cuenta GNB"
});
assert.strictEqual(pagoSanCristobal.ok, true);
assert.strictEqual(pagoSanCristobal.cuentaOrigen, "Banco GNB");
assert.strictEqual(escenarioActual.hojaEntidad.filas[7][7], "Pagado");
assert.strictEqual(escenarioActual.hojaEntidad.filas[7][10], 0);

for (const cuentaInvalida of ["Cuenta inexistente", "Cuenta inactiva"]) {
  escenarioActual = escenario("Medalla Milagrosa");
  const rechazo = pagar({
    entidad: "Medalla Milagrosa",
    cuota: 1,
    monto: escenarioActual.monto,
    fecha: "15/09/2026",
    cuentaOrigen: cuentaInvalida
  });
  assert.strictEqual(rechazo.ok, false);
  assert.match(rechazo.error, /no existe o está inactiva/i);
  assert.strictEqual(escenarioActual.hojaEntidad.filas[8][11], "Pendiente");
  assert.strictEqual(escenarioActual.gastos.filas.length, 1);
}

escenarioActual = escenario("Medalla Milagrosa");
const pagoParcial = pagar({
  entidad: "Medalla Milagrosa",
  cuota: 1,
  monto: escenarioActual.monto - 1,
  fecha: "15/09/2026",
  cuentaOrigen: "Cuenta Continental"
});
assert.strictEqual(pagoParcial.ok, false);
assert.match(pagoParcial.error, /monto completo/i);
assert.strictEqual(escenarioActual.hojaEntidad.filas[8][11], "Pendiente");
assert.strictEqual(escenarioActual.gastos.filas.length, 1);

escenarioActual = escenario("Medalla Milagrosa", {
  entidadPagada: true,
  misPagada: false,
  salida: { cuenta: "Banco Continental" }
});
const reconciliado = pagar({
  entidad: "Medalla Milagrosa",
  cuota: 1,
  monto: escenarioActual.monto,
  fecha: "16/09/2026",
  cuentaOrigen: "Cuenta Continental"
});
assert.strictEqual(reconciliado.ok, true);
assert.strictEqual(reconciliado.reconciliada, true);
assert.strictEqual(escenarioActual.hojas["Mis cuotas"].filas[7][4], "Pagado");
assert.strictEqual(escenarioActual.gastos.filas.length, 2, "la reconciliación conserva la salida existente");

escenarioActual = escenario("Cooperativa San Cristóbal", {
  entidadPagada: false,
  misPagada: true,
  cuota: 2,
  monto: 190000
});
const reparadoConSalida = pagar({
  entidad: "Cooperativa San Cristóbal",
  cuota: 2,
  monto: 190000,
  fecha: "16/09/2026",
  cuentaOrigen: "Cuenta GNB"
});
assert.strictEqual(reparadoConSalida.ok, true);
assert.strictEqual(reparadoConSalida.reconciliada, true);
assert.strictEqual(escenarioActual.hojaEntidad.filas[7][7], "Pagado");
assert.strictEqual(escenarioActual.gastos.filas.length, 2);

escenarioActual = escenario("Medalla Milagrosa");
const legado = pagar({
  entidadPago: "Medalla Milagrosa",
  cuota: 1,
  montoPagado: escenarioActual.monto,
  fechaPago: "15/09/2026"
});
assert.strictEqual(legado.ok, true);
assert.strictEqual(legado.saldoDescontado, false);
assert.match(legado.advertencia, /no se descontó ninguna cuenta/i);
assert.strictEqual(escenarioActual.gastos.filas.length, 1, "el contrato histórico no infiere cuenta");

for (const alias of ["cuotapagov1", "pagocuota", "pagoprestamo", "registrarcuota"]) {
  assert.match(backendCodigo, new RegExp('case\\s+"' + alias + '"'));
}
assert.strictEqual(esperasLock, liberacionesLock, "cada ScriptLock adquirido debe liberarse");
assert.strictEqual(lockActivo, false);

const dashboard = { Date, Number, String, Object, Array, Math, JSON, console };
vm.createContext(dashboard);
vm.runInContext(dashboardCodigo, dashboard);
dashboard.cuentaRegistroValidaMobileV116_ = valor => valor === "Cuenta Continental";
const solicitudDashboard = dashboard.validarPagoCuotaMobile_({
  requestId: "cuota-dashboard-001",
  entidad: "Medalla Milagrosa",
  cuota: 1,
  monto: 250000,
  cuentaOrigen: "Cuenta Continental",
  fecha: "15/09/2026"
});
assert.strictEqual(solicitudDashboard.cuentaOrigen, "Cuenta Continental");
assert.throws(
  () => dashboard.validarPagoCuotaMobile_({
    requestId: "cuota-dashboard-002",
    entidad: "Medalla Milagrosa",
    cuota: 1,
    monto: 250000,
    cuentaOrigen: "Cuenta inactiva",
    fecha: "15/09/2026"
  }),
  /no existe o está inactiva/i
);

assert.match(html, /id="pago-cuota-cuenta"/);
assert.match(html, /"Cuenta de origen",\s*pagoCuotaPendiente\.cuentaOrigen/);
assert.match(dashboardCodigo, /requestId:\s*solicitud\.requestId,[\s\S]*?cuentaOrigen:\s*solicitud\.cuentaOrigen/);
assert.match(dashboardCodigo, /solicitud\.monto\s*!==\s*cuotaDisponible\.monto/);

console.log("OK pago-cuotas-cuenta-origen");
