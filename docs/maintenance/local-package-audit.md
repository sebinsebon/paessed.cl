# Auditoría local de paquetes

El ensayo normal conserva la selección y el progreso del estudiante. Las respuestas,
explicaciones y observaciones del paquete se consultan en una vista separada:
`/app/auditoria/paquetes/[id]`, usando el identificador del paquete importado en este
navegador. La auditoría lee el paquete local y no accede al progreso del estudiante.

Para habilitarla explícitamente en PowerShell:

```powershell
$env:PAESSED_AUDIT_MODE = '1'
npm run dev
```

El servidor exige simultáneamente `NODE_ENV=development` y `PAESSED_AUDIT_MODE=1`.
Sin ambas condiciones, la ruta devuelve 404. Una compilación de producción la
bloquea aunque se configure esa variable. No hay controles del ensayo, parámetros
de URL ni preferencias del navegador que permitan habilitarla.

Los estados `verified`, `provisional` y `missing` se muestran sin cambiarlos ni
certificar contenido. Las alternativas de la auditoría no son seleccionables.

## Verificación

Con un servidor local en ejecución, ajustar `PAESSED_BASE_URL` si usa otro puerto.
Para Chrome instalado se puede usar `PAESSED_BROWSER_CHANNEL=chrome`; por defecto
Playwright utiliza su Chromium. No actualizar snapshots automáticamente.

```powershell
$env:PAESSED_BASE_URL = 'http://127.0.0.1:3104'
# Solo para la ejecución contra desarrollo con la auditoría habilitada:
$env:PAESSED_TEST_AUDIT_ENABLED = '1'
npx playwright test --config tests/paessed-visual.config.cjs tests/package-review.spec.cjs
```

Repetir sin `PAESSED_TEST_AUDIT_ENABLED` contra desarrollo sin habilitación y contra
`next build` + `next start` con `PAESSED_AUDIT_MODE=1`: esos escenarios exigen HTTP
404. La variable de pruebas solo selecciona expectativas y nunca habilita la ruta.
La suite comprueba persistencia normal, navegación y recarga; en auditoría vigila
lecturas/escrituras del progreso y escrituras en IndexedDB, y compara el paquete
completo antes y después. Incluye imágenes legadas para impedir que imágenes de
respuestas, explicaciones u observaciones aparezcan en el ensayo normal.
