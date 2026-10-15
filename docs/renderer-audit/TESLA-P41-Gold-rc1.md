# TESLA P41 - candidata Gold rc1

Estado: **candidata verificada, sin promoción a Gold aprobado**. Rama `feat/paessed-standalone-renderer`, base `47ca4af`. Main y lector 0.2.0 siguen siendo ancestros; sin merge a main. No se cambió código del visor, CSS, lector ni contrato.

## Fuente y diagnóstico

La fuente exacta es `C:/Users/Administrator/Desktop/paes/TESLAM1.pdf`, página 18 de 32, tamaño 595.276 × 841.890 puntos. Su SHA-256 coincide con `sources` del paquete: `18e30b1e9064e7861de3c9636440eedb15b0c66590513536830df25da32acb0e`.

Los PNG originales de C/D cortaban los números inferiores: `2` en C y `−2` en D. En C el glifo llega hasta y=476.325 y en D hasta y=474.761, pero ambos recortes terminaban en y=470. Los ejes verticales de A/B llegan hasta y=295.891, fuera de sus recortes con límite y=280. Los de C/D también tenían extremos inferiores fuera del recorte.

Se generaron los cuatro PNG directamente desde esa página, con PDFium 153.0.7999.0 / pypdfium2 5.13.0, a escala 2 (144 dpi). Sin reconstrucción, retoques, inpainting, dibujo añadido ni eliminación de marcas de agua. La verificación repitió el render en memoria y comparó los bytes exactos de cada PNG; comprobó también al menos 10 puntos de margen para los glifos y ejes verticales nativos.

| Recurso, mismo ID y ruta | Bbox anterior | Bbox nuevo, origen superior izquierdo | Dimensiones nuevas |
| --- | --- | --- | --- |
| `crop-q41-opt-a` | `[50,130,290,280]` | `[50,130,290,310]` | 480 × 360 |
| `crop-q41-opt-b` | `[330,130,570,280]` | `[330,130,570,310]` | 480 × 360 |
| `crop-q41-opt-c` | `[50,320,290,470]` | `[50,310,290,500]` | 480 × 380 |
| `crop-q41-opt-d` | `[330,320,570,470]` | `[330,310,570,500]` | 480 × 380 |

## Paquetes y preservación

Entrega local: `contrato/Gold-candidatas/TESLA-P41-20261012-rc1/`, fuera del repositorio web. `package.zip` y `package.paessed` son idénticos: **346479 bytes**, SHA-256 `d011d81d3a464f7f1755661af67cb8e70dee3ab2910550f769b977053519f30c`.

La [fixture candidata independiente](../../tests/fixtures/tesla-p41-gold-rc1.paessed) conserva esos mismos bytes. Los contenedores tienen 20 archivos: final.json, manifest.json y 18 PNG. El manifiesto incluye tamaños y hashes actualizados de final.json y cada recurso.

Solo cambian `bbox` y `sha256` de los cuatro assets P41 en el JSON. IDs, rutas, source_id, página y MIME se mantienen. Las 65 preguntas, 260 alternativas, respuestas, explicaciones, fuentes y metadata restante son idénticas. Los otros 14 PNG conservan sus bytes exactos. Se conserva el schema_version 0.1.0 original; no se convirtió el contrato ni modificó la compatibilidad 0.2.0 del lector.

El ZIP original conserva SHA-256 `2eedea311058d63e9a8b1eb9d67f638bd541f3634c97a521088bdaad767275d7`; las dos fixtures anteriores y sus snapshots permanecen intactos. La auditoría original se copió sin cambios fuera del paquete estricto, junto con la página fuente renderizada y los cuatro recortes anteriores. No se sustituyó el Gold original ni se modificó su auditoría para ocultar el defecto.

- [Registro de cambios, hashes antiguos/nuevos y posiciones de los glifos del PDF](evidence/p41-gold-rc1-audit.json).
- [Validación estricta y comparación exacta contra el PDF](evidence/p41-gold-rc1-pdf-verification.json).

## Verificación real

- **55/55 tests Playwright PASS**, Chrome/Windows, build de producción local, ejecución final sin actualizar snapshots.
- Las 43 regresiones anteriores pasan con el paquete original y sus capturas intactas.
- Ocho combinaciones de la candidata: ZIP/.paessed × escritorio/móvil × claro/oscuro. Las cuatro opciones se capturan individualmente; se verifican decodificación, SHA-256, dimensiones, proporciones y ausencia de desbordamiento de página.
- Recorrido de las 65 preguntas y 260 alternativas de la candidata en ambos formatos: los 18 recursos se decodifican y coinciden con su hash.
- Exportación por UI desde ambos formatos, validación estricta de la descarga, comparación de los 18 PNG, reimportación explícita del nuevo registro y capturas de P41 después de reimportar.
- `npm run test:tesla-p41`: **3/3 PASS**; igualdad de preguntas y recursos no afectados, metadata limitada a cuatro cambios y exportación/reimportación por módulo.
- Recursos **5/5**, motor **10/10**, curriculum **6/6**, progreso **4/4** y `node tests/paessed.cjs`: PASS.
- TypeScript y build: PASS. ESLint temporal para los tests/config modificados: PASS; sintaxis Python: PASS. Permanecen los warnings de build de la base sobre viewTransition/workspace; no se editaron para esta corrección.

Se inspeccionaron los cuatro PNG contra la página fuente y capturas reales de escritorio/móvil. C muestra completo el `2` inferior y D el `−2`, con los ejes y etiquetas X/Y presentes. No se afirma comprobación en dispositivos físicos ni visual remota en Vercel, cuyo acceso sigue pendiente de autorización.

| Alternativa | Escritorio claro | Móvil oscuro |
| --- | --- | --- |
| A | [Captura](../../tests/tesla-p41-candidate.spec.cjs-snapshots/candidate-p41-0-desktop-light-chromium-win32.png) | [Captura](../../tests/tesla-p41-candidate.spec.cjs-snapshots/candidate-p41-0-mobile-dark-chromium-win32.png) |
| B | [Captura](../../tests/tesla-p41-candidate.spec.cjs-snapshots/candidate-p41-1-desktop-light-chromium-win32.png) | [Captura](../../tests/tesla-p41-candidate.spec.cjs-snapshots/candidate-p41-1-mobile-dark-chromium-win32.png) |
| C | [Captura](../../tests/tesla-p41-candidate.spec.cjs-snapshots/candidate-p41-2-desktop-light-chromium-win32.png) | [Captura](../../tests/tesla-p41-candidate.spec.cjs-snapshots/candidate-p41-2-mobile-dark-chromium-win32.png) |
| D | [Captura](../../tests/tesla-p41-candidate.spec.cjs-snapshots/candidate-p41-3-desktop-light-chromium-win32.png) | [Captura](../../tests/tesla-p41-candidate.spec.cjs-snapshots/candidate-p41-3-mobile-dark-chromium-win32.png) |

## Repetición

`scripts/build-tesla-p41-candidate.py` reutiliza `render_crop` y `package_io.pack` del importador instalado sin cambiar sus fuentes. Requiere una carpeta de salida nueva y comprueba identidad del ZIP original/PDF antes de generar. Conserva la auditoría fuera del contenedor. `--verify-only` valida una candidata existente sin cambiar sus archivos y compara los PNG con renders directos del PDF.

Ejecutar con el Python del importador, indicando `--original`, `--pdf`, `--output` y `--importer-root`. Para la candidata entregada, añadir `--verify-only`. Para las regresiones web: `npm run build`, `npm run start -- --port 3104`, `npm run test:tesla-p41` y `npm run test:renderer-visual`. Los archivos originales no se sobrescriben; las fechas ZIP pueden cambiar el hash del contenedor de una regeneración futura, aunque los PNG y el JSON sean iguales.
