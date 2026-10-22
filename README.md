# Control Financiero

Aplicación de finanzas personales en español construida con Google Apps Script y Google Sheets, con un dashboard para móviles e integración por JSON para Atajos de iOS.

## Funciones

- Registro de gastos e ingresos.
- Consulta de saldos, tarjetas y cuotas; registro de pagos completos de cuotas.
- Presupuestos, obligaciones, transferencias entre cuentas, catálogos y metas de ahorro.
- Dashboard con filtros y formularios.
- Validación del lado del servidor, autenticación por token y controles contra envíos duplicados.

## Estado del proyecto

Esta es una distribución pública inicial del proyecto personal de `josevaldez-97`. Tiene historial independiente y conserva el código del backend activo, el dashboard y sus pruebas. No incluye datos financieros, la hoja privada, credenciales, identificadores de proyectos ni el backend histórico.

La instalación requiere configurar una hoja propia y dos proyectos de Apps Script. Todavía no se incluye una plantilla de Sheets ni un instalador automático. Las pruebas locales usan servicios simulados; no sustituyen la validación de una instalación propia.

## Arquitectura

```text
Atajos iOS ── HTTPS/JSON ──> Backend Apps Script ──> Google Sheets
Dashboard ── google.script.run ──> Apps Script del Dashboard
                                 ├── lectura de Sheets
                                 └── solicitudes autenticadas al Backend
```

| Carpeta | Contenido |
| --- | --- |
| `backend-atajos-v1/` | Backend activo y módulos financieros. |
| `dashboard-mobile/` | Interfaz HTML y funciones del servidor del Dashboard. |
| `tests/` | Pruebas locales sin conexión a la hoja privada. |
| `docs/` | Reglas contables, contratos y preparación de la instalación. |

## Empezar

1. Revisar [la guía de instalación](docs/INSTALACION.md).
2. Preparar una hoja vacía propia según [los contratos de datos](docs/CONTRATOS.md) y [las reglas contables](docs/CONTABILIDAD.md).
3. Crear dos proyectos propios de Apps Script y configurar sus propiedades.
4. Probar con datos ficticios antes de registrar movimientos reales.

Los nombres de entidades financieras presentes en el código son opciones del catálogo inicial. No implican conexión con bancos ni acceso a sus servicios.

## Pruebas

Requiere Node.js 20 o posterior. No requiere instalar dependencias.

```sh
npm test
```

## Contribuciones

Se aceptan reportes y propuestas mediante Issues y Pull Requests. Describir el problema, los pasos para reproducirlo y las pruebas realizadas. Usar únicamente datos ficticios en ejemplos.

## Seguridad

No publicar tokens, URLs de instalaciones privadas, archivos `.clasp.json` ni datos financieros. El token se configura en Script Properties y nunca en el navegador. Cada instalación debe usar su propio token.

## Licencia

[MIT](LICENSE).
