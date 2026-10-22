const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.resolve(__dirname, "..");
const backendDir = path.join(raiz, "backend-atajos-v1");
const backendNombre = fs.readdirSync(backendDir)
  .find(nombre => nombre.startsWith("C") && nombre.endsWith(".js"));
const backendCodigo = fs.readFileSync(path.join(backendDir, backendNombre), "utf8");
const dashboardCodigo = fs.readFileSync(path.join(raiz, "dashboard-mobile", "MobileDashboard.js"), "utf8");
const html = fs.readFileSync(path.join(raiz, "dashboard-mobile", "index.html"), "utf8");

const backend = { Date, Number, String, Object, Array, Math, JSON, console };
vm.createContext(backend);
vm.runInContext(backendCodigo, backend);

function partesFecha(fecha) {
  return [fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate()];
}

assert.deepStrictEqual(partesFecha(backend.convertirFecha("15/09/2026")), [2026, 9, 15]);
assert.deepStrictEqual(partesFecha(backend.convertirFecha("15/09/2026 08:05:03")), [2026, 9, 15]);
assert.deepStrictEqual(partesFecha(backend.convertirFecha("2026-09-15")), [2026, 9, 15]);
assert.deepStrictEqual(partesFecha(backend.convertirFecha("2026-09-15T00:00:00Z")), [2026, 9, 15]);
assert.deepStrictEqual(partesFecha(backend.convertirFecha("2026-09-15T00:00:00.000Z")), [2026, 9, 15]);
assert.deepStrictEqual(partesFecha(backend.convertirFecha("2026-09-15T00:00:00-03:00")), [2026, 9, 15]);
assert.doesNotThrow(() => backend.convertirFecha("September 15, 2026"));
assert.throws(() => backend.convertirFecha("31/02/2026"), /Fecha inválida/);
assert.throws(() => backend.convertirFecha("2026-02-31"), /Fecha inválida/);
assert.throws(() => backend.convertirFecha("2026-02-31T00:00:00Z"), /Fecha inválida/);

const filasTarjetas = Array.from({ length: 4 }, (_, indice) => {
  const fila = Array(12).fill("");
  fila[0] = "Tarjeta " + (indice + 1);
  fila[2] = 1000000;
  fila[3] = 100000;
  fila[4] = 900000;
  fila[10] = 50000;
  fila[11] = "Pendiente";
  return fila;
});
let rangoTarjetas;
backend.obtenerHoja = () => ({
  getLastRow: () => 5,
  getRange: (...argumentos) => {
    rangoTarjetas = argumentos;
    return { getValues: () => filasTarjetas };
  }
});
backend.responder = valor => valor;
const consultaTarjetas = backend.consultarTarjetas();
assert.deepStrictEqual(rangoTarjetas, [2, 1, 4, 12]);
assert.strictEqual(consultaTarjetas.ok, true);
assert.strictEqual(consultaTarjetas.tarjetas.length, 4, "consultatarjetas debe incluir una cuarta tarjeta");

function formatearEnZona(fecha, zonaHoraria, patron) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(fecha);
  const valor = tipo => partes.find(parte => parte.type === tipo).value;
  return patron === "dd/MM/yyyy"
    ? [valor("day"), valor("month"), valor("year")].join("/")
    : [valor("year"), valor("month"), valor("day")].join("-");
}

const dashboard = {
  Date, Number, String, Object, Array, Math, JSON,
  console: { log() {}, time() {}, timeEnd() {} },
  Utilities: { formatDate: formatearEnZona }
};
vm.createContext(dashboard);
vm.runInContext(dashboardCodigo, dashboard);

assert.strictEqual(dashboard.fechaInfo_("15/09/2026").iso, "2026-09-15");
assert.strictEqual(dashboard.fechaInfo_("2026-09-15").texto, "15/09/2026");
assert.strictEqual(dashboard.fechaInfo_("").timestamp, 0);
assert.strictEqual(dashboard.fechaInfo_("31/02/2026").iso, "");
assert.strictEqual(dashboard.fechaInfo_(new Date(2026, 8, 15, 12)).iso, "2026-09-15");

const respuestaHttp = cuerpo => ({
  getResponseCode: () => 200,
  getContentText: () => JSON.stringify(cuerpo)
});
const incierto = dashboard.analizarRespuestaBackendMobile_(
  respuestaHttp({ ok: false, incierto: true, error: "Operación procesando" }),
  "https://backend.invalid",
  "secreto-de-prueba",
  () => true
);
assert.strictEqual(incierto.estadoEscritura, "WRITE_UNCERTAIN");
assert.strictEqual(incierto.incierto, true);

const rechazo = dashboard.analizarRespuestaBackendMobile_(
  respuestaHttp({ ok: false, error: "Monto inválido" }),
  "https://backend.invalid",
  "secreto-de-prueba",
  mensaje => /monto inválido/i.test(mensaje)
);
assert.strictEqual(rechazo.estadoEscritura, "WRITE_REJECTED");
assert.strictEqual(rechazo.incierto, false);

const desconocido = dashboard.analizarRespuestaBackendMobile_(
  respuestaHttp({ ok: false, error: "Operación todavía procesando" }),
  "https://backend.invalid",
  "secreto-de-prueba",
  () => false
);
assert.strictEqual(desconocido.estadoEscritura, "WRITE_UNCERTAIN");

assert.doesNotMatch(html, /var\(--acento\)/);
assert.match(html, /23,\s*59,\s*59,\s*999\s*\)\.getTime\(\)/);
const antesDelMediodia = new Date(2026, 8, 15, 8, 0, 0);
const finDelDia = new Date(
  antesDelMediodia.getFullYear(),
  antesDelMediodia.getMonth(),
  antesDelMediodia.getDate(),
  23, 59, 59, 999
);
assert.ok(new Date(2026, 8, 15, 12).getTime() <= finDelDia.getTime());

assert.strictEqual(fs.existsSync(path.join(raiz, "backend-atajos-jose")), false, "la distribución pública excluye el backend histórico");

console.log("V1.18.5 estabilización: OK");
