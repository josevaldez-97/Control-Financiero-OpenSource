const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.resolve(__dirname, "..");
const backend = fs.readFileSync(path.join(raiz, "backend-atajos-v1", "V116Catalogos.js"), "utf8");
const dashboard = fs.readFileSync(path.join(raiz, "dashboard-mobile", "V116Catalogos.js"), "utf8");
const principalMobile = fs.readFileSync(path.join(raiz, "dashboard-mobile", "MobileDashboard.js"), "utf8");
const principalBackend = fs.readFileSync(path.join(raiz, "backend-atajos-v1", "Código.js"), "utf8");
const html = fs.readFileSync(path.join(raiz, "dashboard-mobile", "index.html"), "utf8");

const contexto = {
  normalizar: valor => String(valor || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_-]+/g, ""),
  numero: valor => Number(valor),
  SpreadsheetApp: {}, LockService: {}, Utilities: {}, responder: valor => valor,
  asegurarHojaV113_: () => {}
};
vm.createContext(contexto);
vm.runInContext(backend, contexto);

assert.strictEqual(contexto.nombreVisibleCuentaV116_("Banco Continental"), "Cuenta Continental");
assert.strictEqual(
  contexto.unirAliasesV116_(["Cuenta Continental", " Banco Continental ", "cuenta continental"]),
  "Cuenta Continental | Banco Continental"
);

const formulaIngreso = contexto.formulaSumaCuentaV116_("Ingresos", "E", 4, "D", ["Cuenta Nueva"]);
const formulaGasto = contexto.formulaSumaCuentaV116_("Gastos", "F", 7, "E", ["Cuenta Nueva"]);
const formulaPago = contexto.formulaSumaCuentaV116_("Pagos tarjetas", "D", 2, "C", ["Cuenta Nueva"]);
assert.match(formulaIngreso, /Ingresos'!\$E\$4:\$E/);
assert.match(formulaIngreso, /Ingresos'!\$D\$4:\$D/);
assert.match(formulaGasto, /Gastos'!\$F\$7:\$F/);
assert.match(formulaGasto, /Gastos'!\$E\$7:\$E/);
assert.match(formulaPago, /Pagos tarjetas'!\$D\$2:\$D/);
assert.match(formulaPago, /Pagos tarjetas'!\$C\$2:\$C/);
assert.match(formulaIngreso, /;"Cuenta Nueva";/, "SUMIF usa el separador de argumentos de es_PY");
assert.doesNotMatch(formulaIngreso, /,"Cuenta Nueva",/, "la fórmula no usa comas como separador");

assert.match(backend, /getRange\("A3:B8"\)/, "la migración importa las seis filas existentes");
assert.match(backend, /function localizarFilaTotalSaldosV116_\(hoja\)/, "las cuentas nuevas localizan TOTAL dinámicamente");
assert.match(backend, /insertRowsBefore\(filaTotal, 1\)/, "la cuenta se inserta antes de TOTAL");
assert.match(backend, /function revertirCreacionCuentaV116_\(estado\)/, "la creación dispone de rollback");
assert.match(backend, /contiene datos sin encabezados/, "la migración no pisa columnas laterales desconocidas");
assert.doesNotMatch(backend, /deleteSheet|clearContents/, "no hay borrado destructivo general");
assert.match(backend, /function revertirCreacionCuentaV116_\(estado\)/, "deleteRow queda limitado al rollback de la creación");
assert.strictEqual(contexto.valorActivoV116_(false), false);
assert.strictEqual(contexto.valorActivoV116_("FALSE"), false);
assert.strictEqual(contexto.valorActivoV116_(true), true);

const contextoMobile = {
  normalizar_: contexto.normalizar,
  numero_: Number,
  MOBILE_CUENTAS_INGRESO: [], MOBILE_TARJETAS_PAGO: [],
  SpreadsheetApp: {}, validarObjetoRegistroMobile_: () => {}, validarRequestIdMobile_: valor => valor,
  textoGastoMobile_: valor => String(valor || ""), numeroGastoMobile_: Number,
  enviarOperacionBackendMobile_: () => ({}), mensajeBackendIncluye_: () => false
};
vm.createContext(contextoMobile);
vm.runInContext(dashboard, contextoMobile);
assert.strictEqual(contextoMobile.valorActivoCatalogoMobileV116_("FALSE"), false);
assert.strictEqual(contextoMobile.valorActivoCatalogoMobileV116_("Inactivo"), false);
assert.strictEqual(contextoMobile.valorActivoCatalogoMobileV116_("TRUE"), true);
assert.match(backend, /normalizar\(fila\[7\]\) === normalizar\(categoriaFila\[0\]\)/, "B se valida mediante el padre de H");

assert.match(principalMobile, /ultimaFila - 2,[\s\S]*?6[\s\S]*?\.getValues\(\)/, "Saldos se lee dinámicamente desde fila 3");
assert.match(principalMobile, /!valorActivoCatalogoMobileV116_\(fila\[9\]\)/, "categorías inactivas no entran al formulario");
assert.match(principalMobile, /!valorActivoCatalogoMobileV116_\(fila\[11\]\)/, "subcategorías inactivas no entran al formulario");
assert.match(dashboard, /function obtenerCuentasCatalogoMobile_\(ss\)/, "módulo de cuentas disponible");
assert.match(html, /function cuentasActivasRegistroV116\(\)/);
assert.match(html, /mediosGastoActivosV116\(\)/);
assert.match(html, /renderCatalogosV116\(\)/);
assert.doesNotMatch(html, /BACKEND_V2_TOKEN|BACKEND_V2_URL/, "no se exponen secretos en HTML");

class HojaSimulada {
  constructor(filas, formulas) {
    this.filas = filas.map(fila => fila.slice());
    this.formulas = (formulas || filas.map(() => [])).map(fila => fila.slice());
    this.fallarAppend = false;
    this.fallarSetValuesEnFila = 0;
  }
  getLastRow() { return this.filas.length; }
  getRange(fila, columna, alto, ancho) {
    if (typeof fila === "string") throw new Error("Rango A1 no esperado en esta prueba");
    alto = alto || 1; ancho = ancho || 1;
    const hoja = this;
    const matriz = origen => Array.from({ length: alto }, (_, i) =>
      Array.from({ length: ancho }, (_, j) => (origen[fila - 1 + i] || [])[columna - 1 + j] ?? "")
    );
    const escribir = (destino, valores) => valores.forEach((filaValores, i) => {
      const indiceFila = fila - 1 + i;
      while (destino.length <= indiceFila) destino.push([]);
      filaValores.forEach((valor, j) => { destino[indiceFila][columna - 1 + j] = valor; });
    });
    return {
      getValues: () => matriz(hoja.filas),
      getDisplayValues: () => matriz(hoja.filas).map(x => x.map(String)),
      getFormulas: () => matriz(hoja.formulas),
      getValue: () => matriz(hoja.filas)[0][0],
      getDisplayValue: () => String(matriz(hoja.filas)[0][0] || ""),
      setValues(valores) {
        if (hoja.fallarSetValuesEnFila === fila) {
          hoja.fallarSetValuesEnFila = 0;
          throw new Error("fallo de escritura simulado");
        }
        escribir(hoja.filas, valores); hoja.recalcular(); return this;
      },
      setFormulas(valores) { escribir(hoja.formulas, valores); hoja.recalcular(); return this; },
      setValue(valor) { escribir(hoja.filas, [[valor]]); hoja.recalcular(); return this; },
      setFormula(valor) { escribir(hoja.formulas, [[valor]]); hoja.recalcular(); return this; }
    };
  }
  insertRowsBefore(fila, cantidad) {
    for (let i = 0; i < cantidad; i++) { this.filas.splice(fila - 1, 0, []); this.formulas.splice(fila - 1, 0, []); }
  }
  deleteRow(fila) { this.filas.splice(fila - 1, 1); this.formulas.splice(fila - 1, 1); this.recalcular(); }
  appendRow(fila) {
    if (this.fallarAppend) throw new Error("fallo simulado");
    this.filas.push(fila.slice()); this.formulas.push([]); this.recalcular();
  }
  setFrozenRows() {}
  recalcular() {
    this.formulas.forEach((filaFormulas, indice) => {
      if (/^=B\d+\+C\d+-D\d+-E\d+$/.test(filaFormulas[5] || "")) {
        const fila = this.filas[indice]; fila[5] = Number(fila[1] || 0) + Number(fila[2] || 0) - Number(fila[3] || 0) - Number(fila[4] || 0);
      }
      filaFormulas.forEach((formula, columna) => {
        const match = String(formula || "").match(/^=SUM\([B-F]3:[B-F](\d+)\)$/);
        if (!match) return;
        const hasta = Number(match[1]);
        this.filas[indice][columna] = this.filas.slice(2, hasta).reduce((suma, fila) => suma + Number(fila[columna] || 0), 0);
      });
    });
  }
}

function escenarioV116() {
  const nombres = ["Efectivo", "Ueno", "Banco Atlas", "Banco Continental", "Banco GNB", "Otro"];
  const saldosCuenta = [282000, 0, 0, 66000, 0, 0];
  const filasSaldos = [["Cuenta", "Base", "Ingresos", "Gastos", "Pagos", "Disponible"], []];
  const formulasSaldos = [[], []];
  nombres.forEach((nombre, i) => {
    filasSaldos.push([nombre, saldosCuenta[i], 0, 0, 0, saldosCuenta[i]]);
    formulasSaldos.push(["", "", "=HIST-ING-" + i, "=HIST-GAS-" + i, "=HIST-PAG-" + i, "=HIST-SAL-" + i]);
  });
  filasSaldos.push(["TOTAL", 348000, 0, 0, 0, 348000]);
  formulasSaldos.push(["", "=SUM(B3:B8)", "=SUM(C3:C8)", "=SUM(D3:D8)", "=SUM(E3:E8)", "=SUM(F3:F8)"]);
  const saldos = new HojaSimulada(filasSaldos, formulasSaldos);
  const cuentas = new HojaSimulada([["ID", "Nombre", "Nombre en Saldos", "Aliases", "Saldo base", "Activa", "Fila Saldos", "Creado", "Actualizado"]]);
  nombres.forEach((nombre, i) => cuentas.appendRow(["CTA-" + i, nombre, nombre, nombre, saldosCuenta[i], true, i + 3, "", ""]));
  const vacia = new HojaSimulada([[]]);
  const ss = { getSheetByName: nombre => ({ Saldos: saldos, Cuentas: cuentas, Ingresos: vacia, Gastos: vacia, "Pagos tarjetas": vacia }[nombre] || null) };
  let uuid = 100;
  const ctx = {
    Date, Number, SPREADSHEET_ID: "test", responder: valor => valor,
    numero: valor => Number(valor) || 0, normalizar: contexto.normalizar,
    Utilities: { getUuid: () => String(uuid++) },
    SpreadsheetApp: { openById: () => ss, flush: () => { saldos.recalcular(); } },
    LockService: { getScriptLock: () => ({ waitLock() {}, hasLock: () => true, releaseLock() {} }) },
    asegurarHojaV113_: () => cuentas
  };
  vm.createContext(ctx); vm.runInContext(backend, ctx);
  return { ctx, ss, saldos, cuentas };
}

const actual = escenarioV116();
const filasOriginales = JSON.stringify(actual.saldos.filas.slice(2, 8));
const formulasOriginales = JSON.stringify(actual.saldos.formulas.slice(2, 8));
assert.strictEqual(actual.ctx.localizarFilaTotalSaldosV116_(actual.saldos), 9);
assert.strictEqual(actual.ctx.guardarCuentaV116({ nombre: "Inválida", saldoBase: "no-numérico", activa: true }).ok, false);
assert.strictEqual(actual.saldos.filas.length, 9);
assert.strictEqual(actual.ctx.guardarCuentaV116({ nombre: "Mango", saldoBase: 0, activa: true }).ok, true);
assert.strictEqual(actual.saldos.filas[8][0], "Mango");
assert.strictEqual(actual.saldos.filas[9][0], "TOTAL");
assert.strictEqual(actual.saldos.filas[9][5], 348000);
assert.deepStrictEqual(actual.saldos.formulas[9].slice(1, 6), [
  "=SUM(B3:B9)", "=SUM(C3:C9)", "=SUM(D3:D9)", "=SUM(E3:E9)", "=SUM(F3:F9)"
]);
assert.match(actual.saldos.formulas[8][2], /Ingresos'!\$E\$4:\$E/);
assert.match(actual.saldos.formulas[8][3], /Gastos'!\$F\$7:\$F/);
assert.match(actual.saldos.formulas[8][4], /Pagos tarjetas'!\$D\$2:\$D/);
assert.strictEqual(actual.cuentas.filas[7][6], 9);
assert.strictEqual(actual.cuentas.filas[7][5], true);
assert.strictEqual(JSON.stringify(actual.saldos.filas.slice(2, 8)), filasOriginales);
assert.strictEqual(JSON.stringify(actual.saldos.formulas.slice(2, 8)), formulasOriginales);
assert.strictEqual(actual.ctx.guardarCuentaV116({ nombre: "Mango", saldoBase: 0, activa: true }).ok, false);
assert.strictEqual(actual.saldos.filas.filter(fila => fila[0] === "Mango").length, 1);
assert.strictEqual(actual.ctx.guardarCuentaV116({ nombre: "Ahorro", saldoBase: 100000, activa: true }).ok, true);
assert.strictEqual(actual.saldos.filas[9][0], "Ahorro");
assert.strictEqual(actual.saldos.filas[10][0], "TOTAL");
assert.strictEqual(actual.saldos.filas[10][5], 448000);
assert.strictEqual(actual.ctx.localizarFilaTotalSaldosV116_(actual.saldos), 11);

actual.cuentas.appendRow(["CTA-TOTAL", "TOTAL", "TOTAL", "TOTAL", 448000, true, 11, "", ""]);
contextoMobile.MOBILE_SPREADSHEET_ID = "test";
contextoMobile.SpreadsheetApp.openById = () => actual.ss;
const catalogoMobile = contextoMobile.obtenerCuentasCatalogoMobile_(actual.ss);
assert.strictEqual(catalogoMobile.some(cuenta => contexto.normalizar(cuenta.nombreSaldos) === "total"), false);
assert.strictEqual(catalogoMobile.find(cuenta => cuenta.nombre === "Mango").activa, true);
const confirmacionAhorro = contextoMobile.confirmarCuentaMobileV116({ nombre: "Ahorro" });
assert.strictEqual(confirmacionAhorro.ok, true);
assert.strictEqual(confirmacionAhorro.cuenta.filaSaldos, 10);

const rollback = escenarioV116();
const saldosAntesRollback = JSON.stringify(rollback.saldos.filas);
const formulasAntesRollback = JSON.stringify(rollback.saldos.formulas);
rollback.cuentas.fallarAppend = true;
assert.strictEqual(rollback.ctx.guardarCuentaV116({ nombre: "Fallida", saldoBase: 50000, activa: true }).ok, false);
assert.strictEqual(JSON.stringify(rollback.saldos.filas), saldosAntesRollback);
assert.strictEqual(JSON.stringify(rollback.saldos.formulas), formulasAntesRollback);
assert.strictEqual(rollback.cuentas.filas.some(fila => fila[2] === "Fallida"), false);

const rollbackFilaVacia = escenarioV116();
const saldosAntesFilaVacia = JSON.stringify(rollbackFilaVacia.saldos.filas);
const formulasAntesFilaVacia = JSON.stringify(rollbackFilaVacia.saldos.formulas);
rollbackFilaVacia.saldos.fallarSetValuesEnFila = 9;
assert.strictEqual(rollbackFilaVacia.ctx.guardarCuentaV116({ nombre: "Falla temprana", saldoBase: 0, activa: true }).ok, false);
assert.strictEqual(JSON.stringify(rollbackFilaVacia.saldos.filas), saldosAntesFilaVacia);
assert.strictEqual(JSON.stringify(rollbackFilaVacia.saldos.formulas), formulasAntesFilaVacia);

const mobileSaldos = { console: { log() {} } };
vm.createContext(mobileSaldos);
vm.runInContext(principalMobile, mobileSaldos);
vm.runInContext(fs.readFileSync(path.join(raiz, "dashboard-mobile", "V115Transferencias.js"), "utf8"), mobileSaldos);
const inicial = escenarioV116();
const saldoInicialLeido = mobileSaldos.obtenerSaldos_({ getSheetByName: () => inicial.saldos }, [],
  inicial.cuentas.filas.slice(1).map(fila => ({ nombre: fila[1], nombreSaldos: fila[2] })));
assert.strictEqual(saldoInicialLeido.total, 348000);
assert.strictEqual(saldoInicialLeido.cuentas.length, 6);
assert.strictEqual(saldoInicialLeido.cuentas.some(cuenta => contexto.normalizar(cuenta.cuenta) === "total"), false);
const sinTotal = escenarioV116();
sinTotal.saldos.deleteRow(9);
const saldoFallback = mobileSaldos.obtenerSaldos_({ getSheetByName: () => sinTotal.saldos }, [],
  sinTotal.cuentas.filas.slice(1).map(fila => ({ nombre: fila[1], nombreSaldos: fila[2] })));
assert.strictEqual(saldoFallback.total, 348000, "sin TOTAL se suman solo las cuentas reales");
const saldoLeido = mobileSaldos.obtenerSaldos_({ getSheetByName: () => actual.saldos }, [],
  actual.cuentas.filas.slice(1).map(fila => ({ nombre: fila[1], nombreSaldos: fila[2] })));
assert.strictEqual(saldoLeido.total, 448000);
assert.strictEqual(saldoLeido.cuentas.some(cuenta => contexto.normalizar(cuenta.cuenta) === "total"), false);

const inicioConsulta = principalBackend.indexOf("function consultarSaldos()");
const bloqueConsulta = principalBackend.slice(inicioConsulta, principalBackend.indexOf("function consultarTarjetas", inicioConsulta));
const consultaBackend = {
  normalizar: contexto.normalizar,
  numero: valor => Number(valor) || 0,
  obtenerHoja: () => actual.saldos,
  aplicarTransferenciasV115ASaldos_: () => {},
  formatearMonto: valor => String(valor),
  responder: valor => valor
};
vm.createContext(consultaBackend);
vm.runInContext(bloqueConsulta, consultaBackend);
const saldoBackend = consultaBackend.consultarSaldos();
assert.strictEqual(saldoBackend.total, 448000);
assert.strictEqual(saldoBackend.saldos.some(cuenta => contexto.normalizar(cuenta.cuenta) === "total"), false);

console.log("V1.16 catalogos: OK");
