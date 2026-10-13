# TESLA: auditoría y resolución común de recursos

Rama `feat/paessed-standalone-renderer`, base `b1f506a`. Fetch confirmó rama local/remota idénticas y que `origin/main` (`ef90df4`) y `origin/feat/paessed-reader-contract-0.2.0-main` son ancestros. Sin merge a main. Los cambios locales de configuración y los archivos sin seguimiento del usuario quedan fuera del commit.

## Contenido comprobado

Se auditó `contrato/package_corregido.zip`: 65 preguntas, 260 alternativas, 18 assets declarados y 18 referencias a imágenes (14 enunciados y cuatro alternativas). Los 18 archivos existen, coinciden con su SHA-256 y tienen cabecera/dimensiones PNG válidas. No hay referencias huérfanas ni assets declarados ausentes.

`tests/fixtures/tesla-audit.zip` es una copia exacta del ZIP original, incluyendo `audit/revision_por_pregunta.json`. SHA-256: `2eedea311058d63e9a8b1eb9d67f638bd541f3634c97a521088bdaad767275d7`. El lector estricto sigue rechazando ese archivo adicional. La fixture compatible `.paessed`, creada anteriormente con las herramientas existentes, conserva los mismos bytes JSON/PNG y un manifiesto estricto.

Los bytes de `final.json` de ambos contenedores son iguales: SHA-256 `9186ec0950ffd5bbcb278a145f67fac5dda32b2e8d63bacfde1e0eb5739a5d97`. Es el contenido usado anteriormente en el standalone. Las pruebas de navegador comprueban también que IndexedDB guarda el mismo JSON en cada formato. Gold, ZIP original, JSON e imágenes originales no se modificaron.

- [Inventario completo: tamaños, dimensiones y hashes](evidence/resource-inventory.json).
- [Tabla de las 65 preguntas](TESLA-resource-coverage.md).
- Cobertura del navegador: [ZIP](evidence/resource-coverage-zip.json), [.paessed](evidence/resource-coverage-paessed.json), [JSON aislado](evidence/resource-coverage-json.json).

## Causa y solución

Antes había dos rutas independientes. `paessedAssetUrls` resolvía IDs del registro, únicamente para `sourceKind === "paessed"`. La ruta genérica `assetUrls` buscaba nombres de archivos dentro del texto. Los bloques estructurados de un ZIP referencian `asset_id`, no la ruta del PNG; se renderizaban siempre con el mapa estricto, vacío en ZIP. La regresión P25 con el ZIP original falló antes de corregir: esperaba una imagen y encontraba cero.

`resolveImportedResources` valida el registro y devuelve un conjunto común de Blob con índices por ID y ruta. El visor comparte las URL locales entre ambos índices, las libera al salir y descarta cargas canceladas. Enunciados, alternativas y celdas de tablas usan el mismo mapa por ID; referencias antiguas por ruta usan su alias. La carga pendiente tiene un estado accesible separado del error de archivo realmente ausente.

| Entrada | Resolución | Esperados | Encontrados | Cargados | Errores |
| --- | --- | ---: | ---: | ---: | ---: |
| ZIP original con auditoría | Contenedor genérico seguro + registro del contrato | 18 | 18 | 18 | 0 |
| `.paessed` compatible | Lector estricto original + registro del contrato | 18 | 18 | 18 | 0 |
| `final.json` aislado | Registro disponible, sin bytes PNG adjuntos | 18 | 0 | 0 | 18 |

JSON no puede recuperar archivos del disco por una ruta incluida en su contenido. Se informa la ausencia en las preguntas afectadas y se rechaza exportar un paquete incompleto. El resolvedor admite registros JSON con archivo adjunto cuando existe en el registro; se probó a nivel de módulo, sin agregar un flujo visual de adjuntos.

La exportación reutiliza el resolvedor: un ZIP con auditoría se exporta a `.paessed` con inventario canónico, hashes comprobados y validación final por el lector estricto. No copia auditorías extra ni acepta imágenes faltantes/corruptas.

## Seguridad y alcance

El lector `.paessed`, validadores, hashes, contrato y controles existentes permanecen intactos. Un fallo estricto no cae en el lector genérico. El helper genérico admite archivos extra y el directorio de `final.json`, pero verifica rutas, duplicados, CRC, cabeceras, tamaños y límites de descompresión; rechaza cifrado, ZIP64, volúmenes múltiples y enlaces simbólicos. Usa el [stream documentado de JSZip](https://stuk.github.io/jszip/documentation/api_zipobject/internal_stream.html), limitando los bytes producidos además del tamaño declarado.

Los fallos individuales dejan disponibles los demás recursos verificados. No se inventan imágenes, carga contenido remoto ni inserta HTML de recursos. Contratos 0.1.0 y 0.2.0 con `curriculum` conservados.

No se modificó CSS, navegación, colores, fuentes, controles, transiciones, mapa ni herramientas. Las diferencias visuales son las imágenes disponibles y los estados internos de carga/error. Las capturas previas de P2/P3 pasan sin cambios.

Archivos de implementación: `components/imported-exam-viewer.tsx`, `components/paessed-blocks.tsx`, `lib/imported-resources.ts`, `lib/resource-zip.ts`, `lib/paessed-export.ts` y el estado de carga de imágenes en `lib/paessed-runtime/block-renderer.js`. También se añadieron tests, fixture, snapshots y documentación; `package.json` incorpora `test:resources`.

## Pruebas y evidencia visual

- **43/43 Playwright PASS en producción local**, ejecución final sin actualizar snapshots. Recorrido de las 65 preguntas y cuatro alternativas en ZIP, `.paessed` y JSON aislado; decodificación y SHA-256 de cada imagen visible.
- Diez regresiones de imágenes: P25/P38/P41/P42/P43 para ZIP y `.paessed`, contra las mismas ocho capturas. P41 captura cada alternativa por separado para cubrir gráficos fuera del área visible inicial.
- Exportación por UI del ZIP original, validación estricta de la descarga, comparación de los 18 PNG y JSON, reimportación real y apertura explícita del nuevo registro `.paessed` en P41.
- Las 29 regresiones anteriores de matemáticas pasan: P2 en cuatro orígenes, escritorio/móvil y claro/oscuro; P3, navegación fría y fórmulas/fracciones similares.
- `npm run test:resources`: **5/5 PASS**; ZIP anidado, referencias antiguas, tablas, ausencia/corrupción, paths inseguros, duplicados, límites, cancelación y exportación 0.2.0 con curriculum.
- `npm run test:renderer`: **10/10 PASS** (incluido contenedor padre); `node tests/paessed.cjs`: PASS; curriculum **6/6** y progreso **4/4** PASS.
- TypeScript y build: PASS. Lint temporal sin findings nuevos. Persisten dos errores preexistentes por imports no usados (`FileJson2`, `useLayoutEffect`) y una advertencia por directiva innecesaria en el visor; comprobados contra `b1f506a`. La base no tiene script de lint.

Capturas inspeccionadas: [P25](../../tests/paessed-resources.spec.cjs-snapshots/tesla-p25-image-chromium-win32.png), [P38](../../tests/paessed-resources.spec.cjs-snapshots/tesla-p38-image-chromium-win32.png), P41 [A](../../tests/paessed-resources.spec.cjs-snapshots/tesla-p41-option-0-chromium-win32.png), [B](../../tests/paessed-resources.spec.cjs-snapshots/tesla-p41-option-1-chromium-win32.png), [C](../../tests/paessed-resources.spec.cjs-snapshots/tesla-p41-option-2-chromium-win32.png), [D](../../tests/paessed-resources.spec.cjs-snapshots/tesla-p41-option-3-chromium-win32.png), [P42](../../tests/paessed-resources.spec.cjs-snapshots/tesla-p42-image-chromium-win32.png), [P43](../../tests/paessed-resources.spec.cjs-snapshots/tesla-p43-image-chromium-win32.png).

Para repetir: instalar dependencias y navegador Playwright; `npm run build`, `npm run start -- --port 3104`, `npm run test:resources` y `npm run test:renderer-visual`. `PAESSED_BASE_URL` permite otro puerto; `PAESSED_BROWSER_CHANNEL=chrome` usa Chrome instalado; `PAESSED_COVERAGE_DIR` guarda las tres tablas JSON del navegador.

## Límites y publicación

P25 tiene la etiqueta derecha cortada y P41-D una etiqueta inferior recortada en los PNG originales. Los gráficos de P41 incluyen letras de alternativa impresas, además de la etiqueta del control web existente. Se preservan sus bytes y la marca de agua; no son recursos ausentes ni recortes añadidos por el visor.

Las nuevas capturas de imágenes son de escritorio claro en Chrome/Windows; las anteriores de matemáticas cubren también móvil y oscuro. No se afirma probar dispositivos físicos ni todas las versiones mínimas. Warnings preexistentes de Next sobre `viewTransition` y workspace fuera del alcance.

Preview de la rama: [Inicio](https://paesseduiux-git-feat-pae-47bc3d-sebinsebonzb-gmailcoms-projects.vercel.app/app/inicio) y [Ensayos](https://paesseduiux-git-feat-pae-47bc3d-sebinsebonzb-gmailcoms-projects.vercel.app/app/ensayos). La comprobación visual remota queda pendiente si la autorización Vercel continúa bloqueando el acceso; las pruebas locales usan un build real de producción. No se cambia Deployment Protection ni se hace merge a main.
