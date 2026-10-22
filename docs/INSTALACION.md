# Preparar una instalación propia

Esta guía describe una configuración manual. La distribución no incluye una copia de la hoja original ni automatiza su construcción completa.

## Hoja de cálculo

Crear una hoja de Google Sheets propia. Revisar los nombres, columnas, filas iniciales y fórmulas requeridas en `CONTRATOS.md`, `CONTABILIDAD.md` y el código antes de utilizarla. Las migraciones V1.13–V1.17 agregan módulos, pero no sustituyen la preparación de las hojas base.

Reemplazar `REEMPLAZAR_CON_ID_DE_TU_HOJA` en `backend-atajos-v1/Código.js` y `dashboard-mobile/MobileDashboard.js` por el ID de esa hoja. El ID de la distribución pública es un marcador y no apunta a ningún recurso real.

## Backend

1. Crear un proyecto independiente en Google Apps Script.
2. Copiar los archivos de `backend-atajos-v1/`, incluido el manifiesto `appsscript.json`.
3. Configurar la propiedad de script `BACKEND_V2_TOKEN` con un token nuevo generado por el propietario de la instalación.
4. Revisar permisos y publicar una aplicación web que se ejecute como el propietario. El manifiesto contempla acceso anónimo: las operaciones se protegen mediante el token del backend.
5. Guardar la URL de esa instalación para configurar el Dashboard y los Atajos propios.

## Dashboard

1. Crear otro proyecto de Apps Script con los archivos de `dashboard-mobile/`.
2. Configurar `BACKEND_V2_URL` con la URL del backend propio y `BACKEND_V2_TOKEN` con el mismo token del backend.
3. Publicar el Dashboard con acceso exclusivo del propietario (`MYSELF`), como indica su manifiesto.

La zona horaria inicial es `America/Asuncion`. Revisar su adecuación antes de adaptar el proyecto.

## Validación

- Ejecutar `npm test` localmente.
- Confirmar que las solicitudes sin token o con token incorrecto se rechacen.
- Probar consultas y luego registros con datos ficticios en una hoja de prueba.
- Verificar las fórmulas, saldos y reglas contables antes de usar datos reales.

Las migraciones escriben en la hoja. Ejecutarlas solo sobre una hoja propia, con respaldo y después de revisar sus efectos. Esta distribución no configura despliegues automáticos.
