const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.resolve(__dirname, "..");
const mobile = fs.readFileSync(
  path.join(raiz, "dashboard-mobile", "MobileDashboard.js"),
  "utf8"
);
const manifiesto = JSON.parse(fs.readFileSync(
  path.join(raiz, "backend-atajos-v1", "appsscript.json"),
  "utf8"
));
const backend = fs.readFileSync(
  path.join(raiz, "backend-atajos-v1", "Código.js"),
  "utf8"
);

const contexto = {};
vm.createContext(contexto);
vm.runInContext(mobile, contexto);

function respuestaHttp(codigo, contenido, encabezados) {
  return {
    getResponseCode: () => codigo,
    getContentText: () => contenido,
    getHeaders: () => encabezados || {}
  };
}

const urlSecreta = "https://script.google.com/macros/s/ID_PRIVADO/exec";
const tokenSecreto = "TOKEN_PRIVADO_DE_PRUEBA";
const analizar = (codigo, contenido) =>
  contexto.analizarRespuestaBackendMobile_(
    respuestaHttp(codigo, contenido),
    urlSecreta,
    tokenSecreto
  );

assert.strictEqual(manifiesto.webapp.access, "ANYONE_ANONYMOUS");
assert.strictEqual(manifiesto.webapp.executeAs, "USER_DEPLOYING");

const authHtml = analizar(200, "<!doctype html><html><form action='ServiceLogin'></form></html>");
assert.strictEqual(authHtml.codigo, "BACKEND_AUTH_HTML");
assert.strictEqual(authHtml.incierto, true);

const httpError = analizar(503, "Servicio temporalmente no disponible");
assert.strictEqual(httpError.codigo, "BACKEND_HTTP_ERROR");
assert.strictEqual(httpError.estadoHttp, 503);

const jsonInvalido = analizar(200, "{no-es-json");
assert.strictEqual(jsonInvalido.codigo, "BACKEND_INVALID_JSON");

const estructuraInvalida = analizar(200, JSON.stringify({ mensaje: "sin indicador ok" }));
assert.strictEqual(estructuraInvalida.codigo, "BACKEND_INVALID_JSON");

const rechazo = analizar(200, JSON.stringify({
  ok: false,
  error: `Token inválido ${urlSecreta} ${tokenSecreto}`
}));
assert.strictEqual(rechazo.codigo, "BACKEND_REJECTED");
assert.strictEqual(rechazo.incierto, false);
assert.doesNotMatch(JSON.stringify(rechazo), /ID_PRIVADO|TOKEN_PRIVADO_DE_PRUEBA/);

const exito = analizar(200, JSON.stringify({ ok: true, datos: [1] }));
assert.strictEqual(exito.ok, true);
assert.strictEqual(exito.estadoEscritura, "WRITE_CONFIRMED");
assert.strictEqual(exito.respuesta.datos[0], 1);
assert.strictEqual(rechazo.estadoEscritura, "WRITE_REJECTED");
assert.strictEqual(authHtml.estadoEscritura, "WRITE_UNCERTAIN");

const llamadas = [];
contexto.UrlFetchApp = {
  fetch: (url, opciones) => {
    llamadas.push({ url, opciones });
    if (llamadas.length === 1) {
      return respuestaHttp(302, "", {
        Location: "https://script.googleusercontent.com/macros/echo?firma=segura"
      });
    }
    return respuestaHttp(200, JSON.stringify({ ok: true, mensaje: "guardado" }));
  }
};
const respuestaRedirigida = contexto.ejecutarSolicitudBackendMobile_(
  urlSecreta,
  { token: tokenSecreto, tipo: "guardarpresupuesto" }
);
assert.strictEqual(llamadas.length, 2);
assert.strictEqual(llamadas[0].opciones.followRedirects, false);
assert.strictEqual(llamadas[1].opciones.method, "get");
assert.strictEqual(llamadas[1].opciones.payload, undefined);
assert.strictEqual(
  contexto.analizarRespuestaBackendMobile_(respuestaRedirigida, urlSecreta, tokenSecreto).estadoEscritura,
  "WRITE_CONFIRMED"
);

let llamadas307 = 0;
contexto.UrlFetchApp = {
  fetch: () => {
    llamadas307++;
    return respuestaHttp(307, "", {
      Location: "https://script.googleusercontent.com/macros/echo?firma=segura"
    });
  }
};
assert.strictEqual(
  contexto.ejecutarSolicitudBackendMobile_(urlSecreta, { token: tokenSecreto }).getResponseCode(),
  307
);
assert.strictEqual(llamadas307, 1, "un 307 nunca repite el POST");

let llamadasHostInvalido = 0;
contexto.UrlFetchApp = {
  fetch: () => {
    llamadasHostInvalido++;
    return respuestaHttp(302, "", {
      Location: "https://script.googleusercontent.com.ejemplo.invalid/engaño"
    });
  }
};
contexto.ejecutarSolicitudBackendMobile_(urlSecreta, { token: tokenSecreto });
assert.strictEqual(llamadasHostInvalido, 1, "no se sigue un host parecido al permitido");

let llamadasHttp = 0;
contexto.UrlFetchApp = {
  fetch: () => {
    llamadasHttp++;
    return respuestaHttp(302, "", {
      Location: "http://script.googleusercontent.com/macros/echo?firma=insegura"
    });
  }
};
contexto.ejecutarSolicitudBackendMobile_(urlSecreta, { token: tokenSecreto });
assert.strictEqual(llamadasHttp, 1, "Location debe usar HTTPS");

function probarOperacionRedirigida(tipo, estadoRedireccion, respuestaFinal) {
  const llamadasOperacion = [];
  contexto.UrlFetchApp = {
    fetch: (url, opciones) => {
      llamadasOperacion.push({ url, opciones });
      return llamadasOperacion.length === 1
        ? respuestaHttp(estadoRedireccion, "", {
          Location: "https://script.googleusercontent.com/macros/echo?firma=segura"
        })
        : respuestaFinal;
    }
  };
  const respuesta = contexto.ejecutarSolicitudBackendMobile_(
    urlSecreta,
    { token: tokenSecreto, tipo }
  );
  assert.strictEqual(
    llamadasOperacion.filter(item => item.opciones.method === "post").length,
    1,
    `${tipo}: POST count = 1`
  );
  assert.strictEqual(llamadasOperacion[1].opciones.method, "get");
  assert.strictEqual(llamadasOperacion[1].opciones.payload, undefined);
  return contexto.analizarRespuestaBackendMobile_(respuesta, urlSecreta, tokenSecreto);
}

[
  "gasto", "ingreso", "pagotarjeta", "pagocuota", "guardarpresupuesto",
  "guardarobligacion", "pagarobligacion", "transferencia", "guardarcuenta",
  "guardarcategoria", "guardarsubcategoria", "guardarmeta", "aportemeta"
].forEach(tipo => {
  assert.strictEqual(
    probarOperacionRedirigida(
      tipo,
      302,
      respuestaHttp(200, JSON.stringify({ ok: true }))
    ).estadoEscritura,
    "WRITE_CONFIRMED"
  );
});

assert.strictEqual(
  probarOperacionRedirigida(
    "guardarpresupuesto",
    303,
    respuestaHttp(200, JSON.stringify({ ok: true }))
  ).estadoEscritura,
  "WRITE_CONFIRMED"
);
assert.strictEqual(
  probarOperacionRedirigida(
    "guardarpresupuesto",
    302,
    respuestaHttp(200, JSON.stringify({ ok: false, error: "Monto inválido" }))
  ).estadoEscritura,
  "WRITE_REJECTED"
);
assert.strictEqual(
  probarOperacionRedirigida(
    "guardarpresupuesto",
    302,
    respuestaHttp(200, "<!doctype html><html><body>ServiceLogin</body></html>")
  ).estadoEscritura,
  "WRITE_UNCERTAIN"
);
assert.strictEqual(
  probarOperacionRedirigida(
    "guardarpresupuesto",
    302,
    respuestaHttp(200, "{json-inválido")
  ).estadoEscritura,
  "WRITE_UNCERTAIN"
);

let llamadas308 = 0;
contexto.UrlFetchApp = {
  fetch: () => {
    llamadas308++;
    return respuestaHttp(308, "");
  }
};
contexto.ejecutarSolicitudBackendMobile_(urlSecreta, { token: tokenSecreto });
assert.strictEqual(llamadas308, 1, "un 308 nunca repite el POST");

contexto.UrlFetchApp = { fetch: () => { throw new Error("timeout simulado"); } };
assert.throws(
  () => contexto.ejecutarSolicitudBackendMobile_(urlSecreta, { token: tokenSecreto }),
  /timeout simulado/
);
assert.strictEqual(
  contexto.respuestaInciertaOperacionMobile_("timeout", "BACKEND_TRANSPORT_ERROR").estadoEscritura,
  "WRITE_UNCERTAIN"
);

contexto.cuentaRegistroValidaMobileV116_ = valor => valor === "Banco Atlas";
const ingreso = contexto.validarIngresoMobile_({
  requestId: "1234567890abcdef",
  tipoIngreso: "Ingreso extra",
  descripcion: "Prueba local",
  monto: 73000,
  cuentaDestino: "Banco Atlas",
  fecha: "14/09/2026",
  observacion: ""
});
assert.strictEqual(ingreso.monto, 73000);
assert.strictEqual(ingreso.cuentaDestino, "Banco Atlas");

assert.match(
  mobile,
  /tipo:\s*"ingreso",[\s\S]*?monto:\s*solicitud\.monto,[\s\S]*?cuentaDestino:\s*solicitud\.cuentaDestino/,
  "el contrato de ingreso conserva tipo, monto y cuentaDestino"
);

assert.match(backend, /const tokenConfigurado\s*=\s*obtenerTokenBackend_\(\)/);
assert.ok(
  backend.indexOf("datos.token !== tokenConfigurado") < backend.indexOf("switch (tipo)"),
  "el token se valida antes del dispatcher"
);
assert.doesNotMatch(mobile, /BACKEND_V2_TOKEN\s*=\s*["']/);
assert.doesNotMatch(mobile, /script\.google\.com\/macros\/s\//);

const html = fs.readFileSync(path.join(raiz, "dashboard-mobile", "index.html"), "utf8");
assert.match(mobile, /V1\.18\.5/);
assert.match(html, /Control Financiero V1\.18\.5/);
assert.match(html, /POST_WRITE_REFRESH_FAILED/);
assert.match(html, /cargarDatos\(\{ postWriteConfirmed: true \}\)/);
assert.match(html, /requestIdsEscrituraPendientes/);
assert.match(html, /escrituraInciertaPendiente/);
assert.match(
  html,
  /Guardado correctamente, pero no se pudo actualizar la vista\. Actualiza para ver los cambios\./
);
[
  "gasto", "ingreso", "pagotarjeta", "pagocuota", "guardarpresupuesto",
  "guardarobligacion", "pagarobligacion", "transferencia"
].forEach(clave => {
  assert.match(html.toLowerCase(), new RegExp(`resolverrequestidescritura\\(\\s*["']${clave}`));
});
assert.match(html, /const claveEscritura = funcion\.toLowerCase\(\)/);
assert.match(html, /const claveEscritura = esAporte \? "aportemeta" : "guardarmeta"/);
assert.match(html, /resolverRequestIdEscritura\(claveEscritura, resultado\)/);
assert.doesNotMatch(mobile, /followRedirects:\s*true/);

console.log("V1.18.3 confirmación segura de escrituras: OK");
