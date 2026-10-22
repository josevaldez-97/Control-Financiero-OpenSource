const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const dir = "backend-atajos-v1";
const principalNombre = fs.readdirSync(dir).find(nombre => nombre.startsWith("C") && nombre.endsWith(".js"));
const principal = fs.readFileSync(path.join(dir, principalNombre), "utf8");
const todos = fs.readdirSync(dir).filter(nombre => nombre.endsWith(".js"))
  .map(nombre => fs.readFileSync(path.join(dir, nombre), "utf8")).join("\n");

assert.doesNotMatch(principal, /\bconst\s+TOKEN\s*=/, "el token no puede ser una constante de código");
assert.match(principal, /getScriptProperties\(\)[\s\S]*?getProperty\([\s\S]*?"BACKEND_V2_TOKEN"/);
assert.match(principal, /if \(!tokenConfigurado\)[\s\S]*?"Backend no configurado"/);
assert.match(principal, /datos\.token !== tokenConfigurado/);
assert.doesNotMatch(todos, /console\.(?:log|error)|Logger\.log/, "el Backend no registra secretos ni payloads");
assert.doesNotMatch(todos, /https?:\/\//, "no hay URLs hardcodeadas en el Backend");

[
  "gasto",
  "ingreso",
  "pagotarjeta",
  "consultasaldos",
  "consultatarjetas",
  "consultacuotas",
  "cuotapagov1",
  "pagocuota",
  "pagoprestamo",
  "registrarcuota"
].forEach(tipo => {
  assert.match(principal, new RegExp(`case\\s+"${tipo}"`), `se conserva la operación ${tipo}`);
});

let tokenConfigurado = "";
const contexto = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: nombre => nombre === "BACKEND_V2_TOKEN" ? tokenConfigurado : null }) },
  ContentService: {
    MimeType: { JSON: "json" },
    createTextOutput: texto => ({ texto, setMimeType() { return this; } })
  },
  Utilities: { formatDate: () => "", getUuid: () => "uuid" },
  SpreadsheetApp: {}, LockService: {}, CacheService: {}, UrlFetchApp: {}
};
vm.createContext(contexto);
vm.runInContext(principal, contexto);
const post = datos => JSON.parse(contexto.doPost({ postData: { contents: JSON.stringify(datos) } }).texto);

assert.deepStrictEqual(post({ token: "cualquiera", tipo: "consulta" }), { ok: false, error: "Backend no configurado" });
tokenConfigurado = "token-de-prueba-no-real";
assert.deepStrictEqual(post({ token: "incorrecto", tipo: "consulta" }), { ok: false, error: "Token inválido" });
const aceptada = post({ token: tokenConfigurado, tipo: "operacion-inexistente" });
assert.strictEqual(aceptada.ok, false);
assert.match(aceptada.error, /no reconocido/i);
assert.ok(!JSON.stringify(aceptada).includes(tokenConfigurado), "las respuestas no incluyen el token");


console.log("Seguridad Backend V2: OK");
