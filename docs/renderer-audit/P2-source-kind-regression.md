# TESLA P2: estilos ausentes en ZIP/JSON

Investigación sobre `feat/paessed-standalone-renderer`, base `ccf6f99`. Fetch inicial: rama local y remota idénticas. No se hizo merge a main.

## Causa confirmada

El visor declaraba KaTeX y `block-renderer.css` únicamente si `record.summary.sourceKind === "paessed"`, pero enunciados y opciones con bloques se renderizaban también para `zip` y `json`. En contextos nuevos, esto producía matemáticas sin sus estilos: `.katex-mathml` permanecía visible junto a `.katex-html`. Reproduje exactamente `mm`, `nn`, `-9-9`, `-4-4` y `-2-2` en producción local.

| Entrada, mismo JSON | `sourceKind` guardado | Antes | Después |
| --- | --- | --- | --- |
| `.paessed` | `paessed` | Ambas hojas, MathML recortado 1×1 | Correcto |
| Mismo ZIP renombrado `.zip` | `zip` | Sin ambas hojas, 11 MathML visibles | Correcto |
| Bytes exactos de `final.json` | `json` | Sin ambas hojas, 11 MathML visibles | Correcto |
| ZIP genérico con `legacy/final.json` y archivo extra | `zip` | Sin ambas hojas, 11 MathML visibles | Correcto |

La matriz se capturó en cuatro contextos de navegador separados para evitar que estilos previamente cargados ocultaran la diferencia de origen. No fue necesario retrasar ni bloquear ninguna petición para reproducir este defecto.

## Contenido e integridad

Los cuatro flujos guardaron en IndexedDB un JSON exactamente igual al de la fixture TESLA. El standalone recibió los mismos bytes del paquete y muestra 11 fórmulas y cuatro alternativas sin duplicación. Los datos de la fixture coinciden con el JSON Gold original.

- Paquete compartido: SHA-256 `1abd9ef269c9e5fe730346d7319fd704fff2d5df52424c1822d6290002266dc4`.
- `final.json`: SHA-256 `9186ec0950ffd5bbcb278a145f67fac5dda32b2e8d63bacfde1e0eb5739a5d97`.
- Enunciado P2: tokens LaTeX `m`, `n`, `m`, `n`, `-9`, `m`, `n`.
- Alternativas: `-4`, `-2`, `2`, `4`.

El ZIP genérico de la prueba se construye con esos mismos bytes JSON y es rechazado por el lector estricto, como corresponde. No se modificó el JSON, la fixture, Gold, lector, validadores, integridad ni reglas de importación.

## Corrección

Las declaraciones de ambas hojas, con `precedence`, pertenecen ahora a `PaessedBlocks`. Cada uso del motor declara sus recursos, independientemente de extensión, metadata o ubicación en enunciados/opciones. React espera su carga y deduplica los links: cinco hosts de P2 producen exactamente un link por hoja.

Se eliminó el condicional de estilos del visor. No cambió el motor JS ni ningún archivo CSS. El papel, controles, colores, tipografías de la interfaz, badges de origen, herramientas y transiciones conservan su código y estilos. No se añadió una regla para ocultar los síntomas ni se eliminó el MathML accesible.

## Evidencia visual y pruebas

- [Antes, ZIP](evidence/p2-before-zip.png) / [antes, JSON](evidence/p2-before-json.png).
- [Standalone con el mismo contenido](evidence/p2-standalone.png).
- [Después, móvil claro ZIP/JSON](../../tests/paessed-navigation.spec.cjs-snapshots/tesla-p2-generic-mobile-light-chromium-win32.png).
- [Después, móvil oscuro ZIP/JSON](../../tests/paessed-navigation.spec.cjs-snapshots/tesla-p2-generic-mobile-dark-chromium-win32.png).
- [Después, escritorio claro ZIP/JSON](../../tests/paessed-navigation.spec.cjs-snapshots/tesla-p2-generic-desktop-light-chromium-win32.png).
- [Métricas antes](evidence/p2-before-matrix.json) / [después](evidence/p2-after-matrix.json).

La regresión P2 ZIP falló con el código anterior al comprobar que MathML estaba visible. Después de corregir:

- **29/29 tests Playwright PASS en el build de producción local**, sin actualizar los snapshots durante la ejecución de verificación.
- P2: 16 combinaciones = cuatro modos × escritorio/móvil × claro/oscuro. Enunciado y cuatro opciones completos; 11 fórmulas, representación visual única, MathML accesible recortado y links deduplicados.
- ZIP, JSON y ZIP genérico comparan contra los mismos snapshots, demostrando igualdad visual entre esos flujos.
- Navegación fría con CSS pendiente, salida/reentrada y reload en los cuatro modos.
- P6 y P19 con matemáticas inline en los cuatro modos.
- Los cuatro snapshots anteriores de P3 pasaron sin modificación; P15/P19/P20/P50 conservan la regresión anterior.
- Motor 9/9 PASS, contratos 0.1.0/0.2.0 PASS, curriculum 6/6 PASS, progreso 4/4 PASS.
- TypeScript y build PASS. Lint sin findings nuevos; permanecen los mismos imports sin usar y directiva innecesaria del visor que en la base.

Capturas inspeccionadas en Chrome/Windows. No se afirma haber probado Safari/iPhone físicos. Para repetir se usa `npm run test:renderer-visual` contra un build de producción, según las instrucciones de [P3](P3-regression.md).

Corrección publicada en `5f53cd2`, en esta misma rama. Vercel informó `success / Deployment has completed`, deployment `dpl_HXrfNdwVnbZxRUC5enekYyuWM4X2`. [Preview de Ensayos](https://paesseduiux-git-feat-pae-47bc3d-sebinsebonzb-gmailcoms-projects.vercel.app/app/ensayos).

El fetch autenticado de ese deployment devuelve 403 (`read_protection_bypass`), por falta de autorización del conector para el equipo/proyecto. La comprobación visual remota sigue pendiente; las pruebas anteriores comprueban producción local. No se cambió protección ni se hizo merge a main.
