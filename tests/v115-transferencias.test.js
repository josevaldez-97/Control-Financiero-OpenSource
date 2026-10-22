const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

let filas = [];
let liberados = 0;
const hoja = {
  getLastRow: () => filas.length + 1,
  getRange: () => ({ getValues: () => filas.map(fila => fila.slice()) }),
  appendRow: fila => filas.push(fila)
};
const backend = {
  Date, Number,
  responder: valor => valor,
  numero: valor => Number(valor) || 0,
  normalizar: valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, ""),
  fechaEstrictaV114_: valor => /^\d{4}-\d{2}-\d{2}$/.test(String(valor)) ? new Date(String(valor) + "T12:00:00") : null,
  cuentaParaHoja: valor => ({ "Cuenta Ueno": "Ueno", "Cuenta GNB": "Banco GNB" }[valor] || valor),
  CUENTAS: ["Efectivo", "Cuenta Ueno", "Cuenta GNB", "Otro"],
  SPREADSHEET_ID: "test", TZ: "America/Asuncion",
  Utilities: { formatDate: () => "12/09/2026" },
  SpreadsheetApp: { openById: () => ({ getSheetByName: () => hoja }), flush() {} },
  LockService: { getScriptLock: () => ({ waitLock() {}, hasLock: () => true, releaseLock: () => liberados++ }) }
};
vm.createContext(backend);
vm.runInContext(fs.readFileSync("backend-atajos-v1/V115Transferencias.js", "utf8"), backend);

const datos = { requestId: "1234567890abcdef", cuentaOrigen: "Cuenta Ueno", cuentaDestino: "Cuenta GNB", monto: 250000, fecha: "2026-09-12" };
assert.strictEqual(backend.registrarTransferencia(datos).ok, true);
assert.strictEqual(backend.registrarTransferencia(datos).duplicado, true);
assert.strictEqual(filas.length, 1, "Un requestId no puede crear dos transferencias");
assert.strictEqual(liberados, 2);

const saldos = [{ cuenta: "Ueno", saldo: 1000000 }, { cuenta: "Banco GNB", saldo: 100000 }];
backend.aplicarTransferenciasV115ASaldos_(saldos);
assert.deepStrictEqual(saldos.map(item => item.saldo), [750000, 350000]);
assert.strictEqual(saldos.reduce((suma, item) => suma + item.saldo, 0), 1100000, "Una transferencia no cambia el saldo total");

const dashboard = {
  Object, Math, Date, Number,
  console: { log() {}, time() {}, timeEnd() {} },
  normalizar_: backend.normalizar,
  numero_: backend.numero,
  fechaInfo_: () => ({ texto: "12/09/2026", iso: "2026-09-12", timestamp: 1 })
};
vm.createContext(dashboard);
vm.runInContext(fs.readFileSync("dashboard-mobile/MobileDashboard.js", "utf8"), dashboard);
vm.runInContext(fs.readFileSync("dashboard-mobile/V115Transferencias.js", "utf8"), dashboard);
const movimientos = dashboard.obtenerMovimientosTransferenciasMobile_([{
  requestId: "x", fecha: "12/09/2026", fechaISO: "2026-09-12", timestamp: 1,
  cuentaOrigen: "Ueno", cuentaDestino: "Banco GNB", monto: 250000, observacion: ""
}]);
assert.strictEqual(movimientos[0].tipo, "transferencia");
assert.strictEqual(movimientos[0].categoria, "Transferencia interna");

dashboard.cuentaRegistroValidaMobileV116_ = () => true;
dashboard.enviarOperacionBackendMobile_ = solicitud => ({ ok: true, solicitud });
const transferenciaBase = {
  requestId: "1234567890abcdef",
  cuentaOrigen: "Cuenta Ueno",
  cuentaDestino: "Cuenta GNB",
  monto: 250000,
  fecha: "12/09/2026"
};
assert.strictEqual(
  dashboard.registrarTransferenciaMobile({ ...transferenciaBase, observacion: "" }).solicitud.observacion,
  "",
  "la observación vacía debe continuar siendo válida"
);
assert.strictEqual(
  dashboard.registrarTransferenciaMobile({ ...transferenciaBase, observacion: "Transferencia ahorro" }).solicitud.observacion,
  "Transferencia ahorro",
  "una observación normal debe ser válida"
);
assert.strictEqual(
  dashboard.registrarTransferenciaMobile({ ...transferenciaBase, observacion: "a".repeat(240) }).solicitud.observacion.length,
  240,
  "se aceptan exactamente 240 caracteres"
);
assert.match(
  dashboard.registrarTransferenciaMobile({ ...transferenciaBase, observacion: "a".repeat(241) }).error,
  /longitud/i,
  "más de 240 caracteres debe rechazarse"
);

const archivoPrincipal = fs.readdirSync("backend-atajos-v1")
  .find(nombre => nombre.startsWith("C") && nombre.endsWith(".js"));
const principal = fs.readFileSync("backend-atajos-v1/" + archivoPrincipal, "utf8");
const inicioConsulta = principal.indexOf("function consultarSaldos()");
const bloqueConsulta = principal.slice(inicioConsulta, principal.indexOf("function consultarTarjetas", inicioConsulta));
assert.ok(
  bloqueConsulta.indexOf("aplicarTransferenciasV115ASaldos_") < bloqueConsulta.indexOf("saldos.forEach"),
  "el texto por cuenta se construye después de aplicar transferencias"
);

console.log("V1.15 transferencias: OK");
