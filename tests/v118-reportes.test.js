const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("dashboard-mobile/index.html", "utf8");
const script = (html.match(/<script>([\s\S]*)<\/script>/) || [])[1] || "";

function extraerFuncion(nombre) {
  const inicio = script.indexOf("function " + nombre + "(");
  assert.ok(inicio >= 0, "existe " + nombre);
  const llave = script.indexOf("{", inicio);
  let nivel = 0;
  let cadena = "";
  let escape = false;
  for (let i = llave; i < script.length; i++) {
    const c = script[i];
    if (cadena) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === cadena) cadena = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { cadena = c; continue; }
    if (c === "{") nivel++;
    if (c === "}" && --nivel === 0) return script.slice(inicio, i + 1);
  }
  throw new Error("función incompleta: " + nombre);
}

const valores = {
  "reporte-desde": "2026-09-01",
  "reporte-hasta": "2026-09-30",
  "reporte-cuenta": "",
  "reporte-categoria": ""
};
const contexto = {
  appData: { movimientos: [
    { tipo: "ingreso", fechaISO: "2026-09-10", cuenta: "Ueno", monto: 500 },
    { tipo: "gasto", fechaISO: "2026-09-11", cuenta: "Ueno", categoria: "Comida", monto: 200 },
    { tipo: "pago_tarjeta", fechaISO: "2026-09-12", cuenta: "Ueno", monto: 50 },
    { tipo: "transferencia", fechaISO: "2026-09-13", cuenta: "Ueno", cuentaDestino: "Banco Atlas", monto: 100 },
    { tipo: "gasto", fechaISO: "2026-10-01", cuenta: "Ueno", categoria: "Comida", monto: 999 }
  ] },
  document: { getElementById: id => ({ value: valores[id] }) },
  claveCuentaReporteV118: valor => String(valor || "").toLowerCase(),
  claveCategoriaReporteV118: valor => String(valor || "").toLowerCase()
};
vm.createContext(contexto);
vm.runInContext(extraerFuncion("movimientosReporteV118"), contexto);

assert.strictEqual(contexto.movimientosReporteV118().length, 4, "el período excluye octubre");
valores["reporte-cuenta"] = "banco atlas";
assert.deepStrictEqual(Array.from(contexto.movimientosReporteV118()).map(x => x.tipo), ["transferencia"], "destino de transferencia participa en filtro de cuenta");
valores["reporte-cuenta"] = "";
valores["reporte-categoria"] = "comida";
assert.deepStrictEqual(Array.from(contexto.movimientosReporteV118()).map(x => x.tipo), ["gasto"], "categoría limita el reporte a gastos relacionados");
assert.match(script, /function celdaCsvV118[\s\S]*?replace\(\/\\r\?\\n\/g, " "\)/);
assert.match(script, /\^\[=\+\\-@\]/, "neutraliza fórmulas en texto exportado");
assert.match(script, /replace\(\/"\/g, '\"\"'\)/, "escapa comillas dobles");
assert.match(script, /const csv = "\\uFEFF"/);
assert.match(script, /item\.tipo === "ingreso"/);
assert.match(script, /item\.tipo === "gasto"/);
assert.match(script, /dinero\(ingresos - gastos\)/, "el balance excluye pagos y transferencias");

console.log("V1.18 reportes: OK");
