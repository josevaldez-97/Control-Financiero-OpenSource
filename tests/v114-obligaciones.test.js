const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

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

const source = fs.readFileSync("backend-atajos-v1/V114Obligaciones.js", "utf8");
const context = {
  Date,
  Number,
  console,
  TZ: "America/Asuncion",
  Utilities: { formatDate: formatearEnZona },
  numero: valor => Number(valor) || 0,
  normalizar: valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, ""),
  MEDIOS_GASTO: ["Efectivo"]
};
vm.createContext(context);
vm.runInContext(source, context);

assert.strictEqual(context.formatearFechaV114_(context.siguienteVencimientoV114_("2026-01-31", "Mensual")), "2026-02-28");
assert.strictEqual(context.formatearFechaV114_(context.siguienteVencimientoV114_("2024-02-29", "Anual")), "2025-02-28");
assert.strictEqual(context.formatearFechaV114_(context.siguienteVencimientoV114_("2026-09-12", "Semanal")), "2026-09-19");
assert.strictEqual(context.siguienteVencimientoV114_("2026-09-12", "Única"), null);
assert.strictEqual(context.fechaEstrictaV114_("2026-02-31"), null);
assert.strictEqual(context.fechaEstrictaV114_("fecha inválida"), null);
assert.strictEqual(context.formatearFechaV114_(context.fechaEstrictaV114_("2026-12-31")), "2026-12-31");
assert.strictEqual(context.formatearFechaV114_(context.fechaEstrictaV114_("31/12/2026")), "2026-12-31");
const fechaCercaDeUTC = new Date("2027-01-01T02:30:00.000Z");
assert.strictEqual(
  context.formatearFechaV114_(context.fechaEstrictaV114_(fechaCercaDeUTC)),
  "2026-12-31",
  "un Date debe conservar el día de America/Asuncion, no el día UTC"
);

const dashboard = {
  console: { log() {} },
  Date,
  Number,
  Utilities: { formatDate: formatearEnZona }
};
vm.createContext(dashboard);
vm.runInContext(fs.readFileSync("dashboard-mobile/MobileDashboard.js", "utf8"), dashboard);
assert.strictEqual(dashboard.validarFechaGastoMobile_("2026-12-31"), "31/12/2026");
assert.strictEqual(dashboard.validarFechaGastoMobile_("31/12/2026"), "31/12/2026");
assert.strictEqual(dashboard.validarFechaGastoMobile_(fechaCercaDeUTC), "31/12/2026");
assert.throws(() => dashboard.validarFechaGastoMobile_("fecha inválida"), /formato/);
assert.throws(() => dashboard.validarFechaGastoMobile_("31/02/2026"), /no existe/);

const reserva = source.indexOf("pagos.appendRow");
const gasto = source.indexOf("gastos.appendRow");
const completar = source.indexOf("pagos.getRange", gasto);
assert.ok(reserva >= 0 && gasto > reserva && completar > gasto, "El pago debe reservarse antes de crear el gasto y completarse después");
assert.ok(source.includes('String(fila[1]) === id && formatearFechaV114_(fila[2]) === vence'), "Debe deduplicar por obligación y vencimiento");
assert.ok(source.includes('"Procesando"'), "Debe conservar una reserva durable ante fallos intermedios");

console.log("V1.14 obligaciones: OK");
