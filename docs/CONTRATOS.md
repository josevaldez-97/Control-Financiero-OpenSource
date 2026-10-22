# Contratos Backend, Dashboard y Sheets

Contratos de la versión pública inicial.

## Convenciones del Backend V2

- Cada solicitud incluye `token` y `tipo`.
- `tipo` se normaliza sin mayúsculas, espacios, guiones ni acentos.
- Las respuestas son JSON con `ok:true` o `ok:false`.
- El token se valida antes del dispatcher y nunca se devuelve ni se registra.
- Las fechas aceptadas por el parser vigente incluyen `DD/MM/YYYY`, fecha y hora local, `YYYY-MM-DD`, ISO de iPhone y el fallback histórico válido. Fechas imposibles se rechazan antes de escribir.
- La zona horaria es `America/Asuncion`.

## Operaciones históricas

| `tipo` | Campos de operación | Resultado principal |
| --- | --- | --- |
| `gasto` | `monto`, `medioPago`, `fecha`, `categoria`, `subcategoria`, `descripcion`, `observacion` | Añade una fila a `Gastos`. |
| `ingreso` | `monto`, `cuentaDestino` o `medioPago`, `fecha`, `tipoIngreso`, `descripcion`, `observacion` | Añade una fila a `Ingresos`. |
| `pagotarjeta` | `monto`, `tarjeta`, `cuentaOrigen`, `fecha`, `observacion` | Añade una fila a `Pagos tarjetas`; no crea un gasto. |
| `consultasaldos` | Sin campos adicionales | Devuelve cuentas reales y total disponible; excluye `TOTAL` como cuenta. |
| `consultatarjetas` | Sin campos adicionales | Devuelve filas válidas de `Tarjetas`. |
| `consultacuotas` | Filtro de entidad opcional | Devuelve cuotas pendientes de `Mis cuotas`. |
| `cuotasatlas`, `cuotasmedalla`, `cuotassancristobal` | Sin campos adicionales | Consulta cuotas de una entidad. |

## Pago de cuotas

Tipos compatibles: `cuotapagov1`, `pagocuota`, `pagoprestamo` y `registrarcuota`.

Campos:

- entidad: `entidad`, `entidadPago` o `empresa`;
- número: `cuota`;
- monto: `monto` o `montoPagado`;
- fecha: `fecha` o `fechaPago`;
- cuenta origen: `cuentaOrigen`, `cuenta` o `medioPago`;
- `requestId` cuando la operación proviene del Dashboard.

El Dashboard exige `cuentaOrigen`. Con cuenta origen, el monto debe coincidir con la cuota completa y la cuenta debe existir y estar activa. El Backend reconcilia la hoja de entidad, `Mis cuotas` y la salida de `Gastos` bajo el mismo `ScriptLock`.

La salida se identifica con `PAGO-CUOTA|entidad|cuota`. Un reintento repara únicamente el estado faltante y no crea otra fila en `Gastos`. Sin cuenta origen, el Backend mantiene la compatibilidad histórica, no infiere una cuenta y devuelve una advertencia indicando que no hubo descuento.

## Operaciones V1.13–V1.17

| `tipo` | Campos principales | Persistencia |
| --- | --- | --- |
| `guardarpresupuesto` | `requestId`, `mes`, `categoria`, `monto` | `Presupuestos`; actualiza la clave natural mes + categoría. |
| `guardarobligacion` | `requestId`, `id`, `nombre`, `categoria`, `subcategoria`, `medioPago`, `monto`, `frecuencia`, `vencimiento`, `activo` | `Obligaciones`. |
| `pagarobligacion` | `requestId`, `obligacionId`, `fecha` | Reserva en `Pagos obligaciones` y añade el gasto confirmado. |
| `transferencia` | `requestId`, `cuentaOrigen`, `cuentaDestino`, `monto`, `fecha`, `observacion` | Una fila indivisible en `Transferencias`. |
| `guardarcuenta` | ID opcional, nombre, saldo base para altas y estado | `Cuentas` y, para altas, una fila antes de `TOTAL` en `Saldos`. |
| `guardarcategoria` | ID opcional, nombre y estado | Catálogo de categorías. |
| `guardarsubcategoria` | ID opcional, nombre, categoría padre y estado | Catálogo de subcategorías; H es la relación padre. |
| `guardarmeta` | `requestId`, `id`, `nombre`, `montoObjetivo`, `cuenta`, `fechaObjetivo`, `activa` | `Metas ahorro`. |
| `aportemeta` | `requestId`, `metaId`, `monto`, `fecha`, `nota` | `Aportes metas`, deduplicado por `requestId`. |

## Resultado de escrituras desde el Dashboard

- `WRITE_CONFIRMED`: el Backend devolvió JSON `ok:true`.
- `WRITE_REJECTED`: el Backend devolvió un rechazo definitivo reconocido.
- `WRITE_UNCERTAIN`: timeout, transporte, HTML, JSON inválido o respuesta no concluyente; no se reenvía automáticamente.
- `POST_WRITE_REFRESH_FAILED`: la escritura quedó confirmada, pero falló la actualización posterior de la vista.

El `requestId` se conserva mientras el resultado sea incierto. `CacheService` es una protección auxiliar y nunca reemplaza la respuesta definitiva del Backend.

## Hojas principales

| Hoja/rango | Columnas utilizadas |
| --- | --- |
| `Gastos`, desde fila 2 | A Fecha; B Categoría; C Subcategoría; D Descripción; E Monto; F Medio; G Observación; H Origen. |
| `Ingresos`, desde fila 2 | A Fecha; B Tipo; C Descripción; D Monto; E Cuenta; F Observación; G Origen. |
| `Pagos tarjetas`, desde fila 2 | A Fecha; B Tarjeta; C Monto; D Cuenta origen; E Observación; F Origen. |
| `Saldos`, desde fila 3 | A Cuenta; B Saldo base; C Ingresos; D Gastos; E Pagos de tarjeta; F Disponible. |
| `Cuentas` | A ID; B Nombre visible; C Nombre en Saldos; D Aliases; E Saldo base; F Activa; G Fila Saldos; H Creado; I Actualizado. |
| `Tarjetas`, desde fila 2 | A Nombre; B Tipo; C Línea; D Deuda; E Disponible; F Cierre; G Vencimiento; H Estado; I Nota; J Deuda base; K Pago mínimo; L Estado mínimo. |
| `Mis cuotas`, desde fila 8 | A Entidad; B Número; C Vencimiento; D Monto; E Estado; F Fecha pago; G Pagado; H Saldo. |
| `Banco Atlas`, desde fila 8 | A Número; B Vencimiento; C Total; D Estado; E Fecha pago; F Pagado; G Saldo. |
| `Medalla Milagrosa`, desde fila 9 | A Cuota; B Vencimiento; K Importe; L Estado; M Fecha pago; N Pagado. |
| `San Cristobal`, desde fila 8 | A Número; B Vencimiento; G Total; H Estado; I Fecha pago; J Pagado; K Saldo. |
| `Categorías`, A:N | A Categoría; B Subcategoría; D medios; F tipos de ingreso; G cuentas; H categoría padre; I:N IDs, estados y aliases. |

## Hojas aditivas

- `Presupuestos`: ID, Mes, Categoría, Monto, Activo, Creado, Actualizado.
- `Obligaciones`: ID, Nombre, Categoría, Subcategoría, Medio de pago, Monto, Frecuencia, Próximo vencimiento, Activo, Creado, Actualizado.
- `Pagos obligaciones`: RequestId, Obligación ID, Vencimiento, Fecha pago, Monto, Estado, Fila gasto, Creado, Actualizado.
- `Transferencias`: RequestId, Fecha, Cuenta origen, Cuenta destino, Monto, Observación, Estado, Creado.
- `Metas ahorro`: ID, Nombre, Monto objetivo, Cuenta vinculada, Fecha objetivo, Activa, Creado, Actualizado.
- `Aportes metas`: RequestId, Meta ID, Fecha, Monto, Nota, Creado.

Las migraciones que crean estas hojas son explícitas y no se ejecutan al cargar el Dashboard ni durante un deployment.
