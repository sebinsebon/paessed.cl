# TESLA P3: duplicación de matemáticas durante navegación fría

Corrección sobre `feat/paessed-standalone-renderer`, base `68b30d9`, después de fetch: 0 commits de divergencia con su remoto; `origin/main` y lector 0.2.0 siguen siendo ancestros. No se hizo merge a main.

## Datos de entrada comprobados

El ZIP TESLA original, la copia compatible usada por ambos visores y la exportación anterior tienen el mismo contenido JSON. La fixture `tests/fixtures/tesla-renderer.paessed` es una copia byte por byte del paquete suministrado al standalone y a la web; no se modificaron los originales Gold, `final.json`, assets, contrato, reader, validator o hashes.

- SHA-256 del paquete compartido: `1abd9ef269c9e5fe730346d7319fd704fff2d5df52424c1822d6290002266dc4`.
- SHA-256 de sus bytes `final.json`: `9186ec0950ffd5bbcb278a145f67fac5dda32b2e8d63bacfde1e0eb5739a5d97`.
- P3: una fracción anidada con `display: true`, bloque de texto `?`, opciones A=`1/3`, B=`2/3`, C=`8/3`, D=`3`.

## Causas y solución

**Duplicados:** se reprodujeron en el build de producción mediante importación real → enlace interno a Ensayos → enlace interno Practicar, reteniendo temporalmente la respuesta de `katex.min.css`. El DOM de las preguntas se montaba antes de la hoja. Sin ella, `.katex-mathml` tenía `position: static` y estaba visible a la vez que `.katex-html`: los dígitos de las alternativas aparecían duplicados y el enunciado mostraba una expresión adicional. Al liberar CSS, MathML pasó a `position: absolute`, caja 1×1 y clipping, y el defecto desapareció. Las respuestas CSS completas eran HTTP 200; no se encontró un override global de `.katex-mathml`.

Los dos links requeridos ahora usan `precedence`: React gestiona su carga, orden, suspensión del commit y conservación durante navegación. Se conserva `htmlAndMathml`, su representación accesible y las restricciones de KaTeX. No se añadió una regla para esconder MathML a la fuerza ni se cambió la salida a texto. La gestión está documentada en [React link](https://react.dev/reference/react-dom/components/link); se revisó también la guía CSS de la versión instalada de Next.

**Signo separado:** el contrato marca la expresión como display y almacena `?` como bloque posterior. Con los mismos bytes, el standalone disponible también lo coloca aparte. El motor ahora reconoce bloques exclusivamente de puntuación de cierre y los asocia al display precedente, manteniendo LaTeX, modo display y texto originales. El texto ordinario posterior y los saltos explícitos permanecen separados. El centrado incluye fórmula y puntuación. El posicionamiento relativo del contenedor matemático evita que su MathML absoluto afecte el overflow de la página en expresiones largas.

Todos los cambios CSS están bajo `.paessed-blocks`; el único cambio al visor es `precedence` en sus dos links. Papel, header, sidebar, colores, fuentes de interfaz, botones, alternativas, herramientas y transiciones conservan su código y estilos.

La auditoría anterior esperaba la carga completa antes de capturar: no comprobaba el intervalo de navegación fría. La nueva regresión mantiene la hoja pendiente y verifica ese intervalo explícitamente.

## Evidencia

- [Defecto reproducido con CSS pendiente](evidence/p3-before-css-loaded.png).
- [Standalone P3 con los mismos bytes](evidence/p3-standalone.png).
- [P3 móvil clara corregida](../../tests/paessed-navigation.spec.cjs-snapshots/tesla-p3-mobile-light-chromium-win32.png).
- [P3 móvil oscura corregida](../../tests/paessed-navigation.spec.cjs-snapshots/tesla-p3-mobile-dark-chromium-win32.png).
- [P3 escritorio clara corregida](../../tests/paessed-navigation.spec.cjs-snapshots/tesla-p3-desktop-light-chromium-win32.png).
- [P3 escritorio oscura corregida](../../tests/paessed-navigation.spec.cjs-snapshots/tesla-p3-desktop-dark-chromium-win32.png).

Las cuatro capturas incluyen todas las alternativas. Los snapshots se generaron, inspeccionaron visualmente y luego se compararon en dos ejecuciones independientes sin `--update-snapshots`. Son referencias Chrome/Windows; no se consideran evidencia de Safari/iPhone físicos.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| CSS retenido en navegación interna | Falló en el código anterior; PASS después de la corrección |
| Puntuación tras display | Falló antes; PASS sin cambiar el modo matemático |
| Regresión visual en producción local | 6/6 PASS: navegación fría, cuatro snapshots P3, preguntas similares |
| Fórmulas similares | P15/P19/P20/P50 sin MathML visual duplicado, 4 opciones y sin overflow de página |
| Navegación de vuelta/reentrada y reload | PASS: estilos conservados y MathML accesible recortado |
| Inmutabilidad del contenido | Fixture SHA-256 fija y JSON realmente guardado por la web igual al JSON del paquete |
| Motor Chrome/Firefox/WebKit | 8 subcasos por motor PASS (9 tests contando el padre) |
| Contratos 0.1.0/0.2.0 y export/import | PASS |
| Curriculum / progreso | 6/6 y 4/4 PASS |
| 13 flujos UI anteriores | PASS sobre producción local, bytes de recursos y JSON preservados |
| TypeScript y build de producción | PASS |
| Lint | Motor/tests/config sin findings. Visor: mismas 2 infracciones preexistentes de imports sin usar (`FileJson2`, `useLayoutEffect`) y misma directiva ESLint innecesaria que en HEAD; ningún finding nuevo |

Para repetir: instalar dependencias, ejecutar `npm run build`, iniciar `npm run start -- --port 3104` y luego `npm run test:renderer-visual`. Instalar Chromium con `npx playwright install chromium` o definir `PAESSED_BROWSER_CHANNEL=chrome` para usar Chrome instalado. `PAESSED_BASE_URL` permite apuntar a otro servidor. No actualizar snapshots para aceptar un fallo sin inspeccionarlo.

Vercel mantiene autenticación de preview; la comprobación remota se registrará tras publicar. La evidencia anterior comprueba producción local, no una preview remota autenticada. No se desactivó protección ni se hizo merge a main.
