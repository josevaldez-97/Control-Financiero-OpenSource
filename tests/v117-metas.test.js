const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const codigo = fs.readFileSync("backend-atajos-v1/V117Metas.js", "utf8");
const codigoDashboard = fs.readFileSync("dashboard-mobile/V117Metas.js", "utf8");
const filasAportes = [];
const metas = {
  getLastRow: () => 2,
  getRange: () => ({ getValues: () => [["META-1", "Reserva", 1000000, "Ueno", new Date(2026, 11, 1), true, new Date(), new Date()]] })
};
const aportes = {
  getLastRow: () => filasAportes.length + 1,
  getRange: () => ({ getValues: () => filasAportes.slice() }),
  appendRow: fila => filasAportes.push(fila)
};
const ss = { getSheetByName: nombre => nombre === "Metas ahorro" ? metas : nombre === "Aportes metas" ? aportes : null };
const contexto = {
  numero: Number,
  fechaEstrictaV114_: valor => /^\d{4}-\d{2}-\d{2}$/.test(String(valor)) ? new Date(2026, 8, 12) : null,
  valorActivoV116_: valor => valor !== false,
  responder: valor => valor,
  SpreadsheetApp: { openById: () => ss, flush: () => {} },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, hasLock: () => true, releaseLock: () => {} }) },
  Utilities: { getUuid: () => "uuid" }, SPREADSHEET_ID: "test",
  asegurarHojaV113_: () => ({ setFrozenRows: () => {} })
};
vm.createContext(contexto);
vm.runInContext(codigo, contexto);

const datos = { requestId: "abcdefghijklmnop", metaId: "META-1", monto: 100000, fecha: "2026-09-12", nota: "Aporte" };
assert.strictEqual(contexto.registrarAporteMetaV117(datos).ok, true);
assert.strictEqual(contexto.registrarAporteMetaV117(datos).duplicado, true);
assert.strictEqual(filasAportes.length, 1, "el mismo requestId no genera un segundo aporte");
assert.doesNotMatch(codigo, /getSheetByName\("(?:Saldos|Gastos|Ingresos|Transferencias)"\)/);
assert.match(codigo, /No mueven fondos/);
assert.match(codigoDashboard, /fecha:\s*validarFechaGastoMobile_\(datos\.fecha\)/);
assert.match(codigoDashboard, /fechaObjetivo:\s*validarFechaGastoMobile_\(datos\.fechaObjetivo\)/);

console.log("V1.17 metas: OK");
