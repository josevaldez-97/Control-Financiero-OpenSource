const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function formatMonthInTimezone(fecha, zonaHoraria) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(fecha);
  const valor = tipo => partes.find(parte => parte.type === tipo).value;
  return valor("year") + "-" + valor("month");
}

function load(files, context) {
  vm.createContext(context);
  files.forEach(file => vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file }));
  return context;
}

const dashboard = load([
  "dashboard-mobile/MobileDashboard.js",
  "dashboard-mobile/V113Presupuestos.js"
], {
  console: { log() {} },
  Utilities: { formatDate: formatMonthInTimezone }
});

const septiembreComoFecha = new Date("2026-09-15T12:00:00-03:00");
assert.strictEqual(dashboard.normalizarMesPresupuesto(septiembreComoFecha), "2026-09");
assert.strictEqual(dashboard.normalizarMesPresupuesto("2026-09"), "2026-09");
assert.strictEqual(dashboard.normalizarMesPresupuesto("2026-09-15"), "2026-09");
assert.strictEqual(dashboard.normalizarMesPresupuesto("15/09/2026"), "2026-09");
assert.strictEqual(dashboard.normalizarMesPresupuesto("10/2026"), "2026-10");
assert.strictEqual(dashboard.normalizarMesPresupuesto("2026-13"), "");

const presupuestos = [
  ["1", septiembreComoFecha, "Comida", 2000000, true, "", ""],
  ["1-duplicado", "2026-09", "Comida", 2000000, true, "", ""],
  ["2", "2026-09", "Salud", 100, true, "", ""],
  ["3", "2026-09", "Transporte", 100, true, "", ""],
  ["4", "2026-10", "Comida", 100, true, "", ""]
];
const ssLectura = {
  getSheetByName(nombre) {
    assert.strictEqual(nombre, "Presupuestos");
    return {
      getLastRow: () => presupuestos.length + 1,
      getRange: () => ({ getValues: () => presupuestos })
    };
  }
};
const resultado = dashboard.obtenerPresupuestosMobile_(ssLectura, [
  { fechaISO: "2026-09-01", categoria: "Comida", monto: 50 },
  { fechaISO: "2026-09-02", categoria: "SALUD", monto: 90 },
  { fechaISO: "2026-09-03", categoria: "Transpórte", monto: 110 },
  { fechaISO: "2026-08-03", categoria: "Comida", monto: 999 }
]);
const septiembre = resultado.filter(item => item.mes === "2026-09");
const octubre = resultado.find(item => item.mes === "2026-10");
assert.strictEqual(septiembre.length, 3, "el duplicado natural debe producir una sola entrada lógica");
assert.deepStrictEqual(Array.from(septiembre, item => item.gastado), [50, 90, 110]);
assert.ok(Math.abs(septiembre[2].porcentaje - 110) < 0.000001);
assert.strictEqual(septiembre[2].porcentajeBarra, 100);
assert.strictEqual(septiembre[0].duplicadosDetectados, 1);
assert.strictEqual(septiembre[0].monto, 2000000, "los duplicados no deben sumar Gs. 4.000.000");
assert.strictEqual(octubre.gastado, 0, "octubre no debe mezclar gastos de septiembre");
assert.ok(resultado.every(item => /^\d{4}-\d{2}$/.test(item.mes)), "la UI solo recibe meses canónicos");

let liberado = 0;
let filas = [["original", septiembreComoFecha, "Comida", 1500000, true, "creado", "actualizado"]];
const hojaPresupuestos = {
  getLastRow: () => filas.length + 1,
  getRange(fila, columna, alto, ancho) {
    return {
      getValues: () => filas.map(item => item.slice()),
      setValues(valores) {
        if (fila === 1) return;
        const actual = filas[fila - 2];
        for (let i = 0; i < ancho; i++) actual[columna - 1 + i] = valores[0][i];
      },
      getDisplayValues: () => [["ID", "Mes", "Categoría", "Monto", "Activo", "Creado", "Actualizado"]]
    };
  },
  appendRow(fila) { filas.push(fila); },
  setFrozenRows() {}
};
const hojaCategorias = {
  getLastRow: () => 2,
  getRange: () => ({ getDisplayValues: () => [["Comida"]] })
};
const backend = load(["backend-atajos-v1/V113Presupuestos.js"], {
  Date,
  Number,
  responder: valor => valor,
  numero: valor => Number(valor) || 0,
  normalizar: valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, ""),
  SPREADSHEET_ID: "test",
  Utilities: {
    getUuid: () => "uuid",
    formatDate: formatMonthInTimezone
  },
  SpreadsheetApp: {
    openById: () => ({ getSheetByName: nombre => nombre === "Presupuestos" ? hojaPresupuestos : hojaCategorias }),
    flush() {}
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, hasLock: () => true, releaseLock: () => { liberado++; } }) }
});

const solicitud = { requestId: "1234567890abcdef", mes: "2026-09", categoria: "Comida", monto: 2000000 };
assert.strictEqual(backend.registrarPresupuesto(solicitud).ok, true);
assert.strictEqual(filas.length, 1);
assert.strictEqual(filas[0][3], 2000000, "el presupuesto de 2.000.000 pasa validación y conserva el monto");
assert.strictEqual(backend.registrarPresupuesto({ ...solicitud, monto: 600000 }).ok, true);
assert.strictEqual(filas.length, 1, "El presupuesto debe actualizarse, no duplicarse");
assert.strictEqual(filas[0][3], 600000);
assert.strictEqual(liberado, 2, "El lock debe liberarse siempre");

filas = [
  ["original", septiembreComoFecha, "Comida", 2000000, true, "creado", "actualizado"],
  ["duplicado", "2026-09", "Comida", 2000000, true, "creado2", "actualizado2"]
];
const respuestaDuplicado = backend.registrarPresupuesto({ ...solicitud, monto: 700000 });
assert.strictEqual(respuestaDuplicado.ok, true);
assert.strictEqual(respuestaDuplicado.duplicadosDetectados, 1);
assert.strictEqual(filas.length, 2, "la corrección local no limpia datos reales sin autorización");
assert.strictEqual(filas[0][3], 700000, "debe actualizar determinísticamente la fila original");
assert.strictEqual(filas[1][3], 2000000, "la fila duplicada no se suma ni se modifica");

const html = fs.readFileSync("dashboard-mobile/index.html", "utf8");
const fuenteNormalizadorCliente = html.match(/function normalizarMesPresupuestoCliente\(valor\) \{[\s\S]*?\n\}/)[0];
const inicioRender = html.indexOf("function renderPresupuestos() {");
const finRender = html.indexOf("\nfunction guardarPresupuestoDesdeDashboard", inicioRender);
const contextoCliente = {
  appData: { presupuestos: resultado },
  document: {
    lista: { innerHTML: "" },
    getElementById(id) {
      if (id === "presupuesto-mes") return { value: "2026-09" };
      if (id === "presupuestos-lista") return this.lista;
      return {};
    }
  },
  prepararFormularioPresupuesto() {},
  htmlEstadoVacio: () => "VACIO",
  esc: valor => String(valor),
  dinero: valor => "Gs. " + valor
};
vm.createContext(contextoCliente);
vm.runInContext(fuenteNormalizadorCliente + "\n" + html.slice(inicioRender, finRender), contextoCliente);
contextoCliente.renderPresupuestos();
assert.notStrictEqual(contextoCliente.document.lista.innerHTML, "VACIO", "Planificación debe mostrar septiembre");
assert.match(contextoCliente.document.lista.innerHTML, /Gs\. 2000000/);

console.log("V1.13 presupuestos: OK");
