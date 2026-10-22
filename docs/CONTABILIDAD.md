# Contabilidad operativa

Esta guía describe las reglas financieras vigentes. El historial y las razones de cada decisión permanecen en `DOCUMENTACION_MAESTRA.md`.

## Fuentes oficiales

- `Saldos` es la fuente financiera oficial del disponible por cuenta.
- `Cuentas` administra identidad, nombre visible, nombre canónico, aliases y estado; no reemplaza a `Saldos`.
- `TOTAL` es una fila agregada de `Saldos`, no una cuenta. No debe aparecer en catálogos ni formularios.
- `Tarjetas` conserva deuda, línea, disponible, pago mínimo y estado mínimo.
- `Mis cuotas` y las hojas de cada entidad conservan el estado de las cuotas.

## Efecto de cada operación

| Operación | Registro | Efecto financiero |
| --- | --- | --- |
| Gasto | `Gastos` | Reduce la cuenta indicada mediante las fórmulas de `Saldos`. |
| Ingreso | `Ingresos` | Aumenta la cuenta destino. |
| Pago de tarjeta | `Pagos tarjetas` | Reduce la cuenta origen y cancela deuda; no se contabiliza como gasto nuevo. |
| Pago de cuota con cuenta | Hojas de cuota y una fila en `Gastos` | Marca la cuota completa como pagada y descuenta una vez la cuenta origen. |
| Transferencia | `Transferencias` | Resta del origen y suma al destino sin alterar el total, ingresos ni gastos. |
| Pago de obligación | `Pagos obligaciones` y `Gastos` | Crea el gasto solo después de la confirmación explícita del pago. |
| Aporte a meta | `Aportes metas` | Es informativo; no modifica saldos, ingresos, gastos ni transferencias. |

## Saldos y cuentas

Las fórmulas existentes contienen cortes históricos intencionales:

- ingresos: cuenta en `Ingresos!E4:E`, monto en D;
- gastos: medio en `Gastos!F7:F`, monto en E;
- pagos de tarjeta: cuenta en `Pagos tarjetas!D2:D`, monto en C;
- disponible: saldo base + ingresos - gastos - pagos de tarjeta.

Las seis filas históricas `Saldos!A3:F8` y sus saldos base se preservan. Una cuenta nueva se inserta inmediatamente antes de la única fila `TOTAL`; su fila física queda registrada en `Cuentas!G`. Las fórmulas nuevas usan separador `;`, compatible con `es_PY`.

Desactivar una cuenta conserva su saldo e historial, pero la excluye de nuevos registros. Renombrarla modifica solo su nombre visible y conserva el nombre anterior como alias; no cambia el nombre canónico de las hojas.

## Cuotas y préstamos

- No existen pagos parciales.
- En el Dashboard `cuentaOrigen` es obligatorio y debe corresponder a una cuenta activa; el monto es siempre el total completo de la cuota.
- El Backend acepta `cuentaOrigen` y los aliases `cuenta` y `medioPago`, y los resuelve mediante el catálogo V1.16.
- Bajo un mismo `ScriptLock` se comprueban la hoja de la entidad, `Mis cuotas` y la salida financiera en `Gastos`.
- La salida usa categoría `Otros`, subcategoría `Otros`, descripción `Pago cuota <entidad> #<cuota>`, medio canónico y origen `Pago de cuota`.
- La observación contiene la referencia estable `PAGO-CUOTA|entidad|cuota`. Un reintento conserva las partes existentes, repara únicamente lo faltante y no crea un segundo gasto ni descuento.
- Un payload histórico sin cuenta origen sigue marcando la cuota como pagada, pero no descuenta ninguna cuenta y devuelve una advertencia explícita.

## Tarjetas

- El porcentaje utilizado es deuda/línea y puede superar 100 %.
- La barra visual se limita a 100 %, sin alterar el porcentaje real.
- `estadoMinimo` se muestra como llega desde `Tarjetas`; no se recalcula con los pagos registrados.
- Los pagos de tarjeta aparecen como movimientos, pero quedan fuera del gasto del balance filtrado.

## Presupuestos, obligaciones y metas

- Los presupuestos son únicos por mes canónico `YYYY-MM` y categoría canónica.
- El gasto presupuestario se deriva de `Gastos`; los duplicados históricos de presupuesto no se suman.
- Mostrar un vencimiento no crea un gasto. El pago de una obligación reserva primero su combinación obligación + vencimiento.
- Las metas y sus aportes no reservan ni inmovilizan dinero.

## Fechas y reportes

- La zona horaria común es `America/Asuncion`.
- La normalización evita conversiones UTC que cambien el día o el mes.
- El balance de reportes es ingresos menos gastos.
- Transferencias y pagos de tarjeta pueden aparecer en el detalle, pero no se suman como ingreso o gasto.
