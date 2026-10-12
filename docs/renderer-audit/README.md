# Auditoría del renderizador PAESSED — 12 octubre 2026

Seguimiento: [corrección de P3 y regresión de navegación fría](P3-regression.md). Actualiza la carga de hojas y la puntuación display descritas en esta auditoría inicial.

Rama: `feat/paessed-standalone-renderer`. Base: lector `3e837f3`, sobre `origin/main` `ef90df4079c82d4ab8489ad0e4e897fb545d9492` (UI reciente de Ensayos/Playground y subejes M1). Fetch realizado antes y después de implementar; main y lector son ancestros de esta rama. No hubo divergencias ni conflictos. No se hizo merge a main.

Cambios locales anteriores preservados en el stash `Preserve local setup before standalone renderer integration` y en `../renderer-audit-20261012/`: `next-env.d.ts`, `tsconfig.json`, `AGENTS.md`, `CLAUDE.md`, `package-lock.json` y parche binario. Fueron restaurados después del commit; su contenido coincide con el respaldo (Git normalizó algunos finales de línea). La configuración que Next regeneró durante las pruebas no forma parte del commit. Se restableció el servidor dev existente en el puerto 3102 tras el build y se comprobó HTTP 200.

## Comparación y alcance

La ruta pedida con `(1).zip` no existe. La referencia disponible y usada fue `../contrato/PAESSED_Visor_Standalone_0.1_0.2.zip`, extraída fuera de Git. Se revisaron `app.js` (`renderBlocks`), `styles.css`, HTML, lector, validadores, KaTeX, host React y `imported-exam-viewer.tsx`.

| Aspecto | Renderizador anterior | Adaptación |
| --- | --- | --- |
| Texto y matemáticas inline | Hermanos sueltos; matemáticas en `div` con inline-block | Párrafo compartido, `span` matemático y alineación por línea base |
| Párrafos | Bloques de texto contiguos podían concatenar frases | Regla del standalone: separar texto consecutivo cuando termina una frase y comienza otra en mayúscula; conservar espacios y saltos originales |
| Display | Alineación dependiente de CSS de KaTeX y contenedores genéricos | Bloque independiente centrado, separación explícita antes/después |
| Fracciones, potencias, índices y radicales | Overflow automático incluso en fórmulas cortas | Matemática inline sin clipping; overflow local solamente cuando supera el ancho disponible |
| Imágenes | Contenedor sin centrado ni aviso de fallo de decodificación | Imagen centrada, ratio original, máximo 470px como la referencia, errores accesibles |
| Tablas | Wrapper y tabla compartían clase; reglas sin scope completo | Wrapper independiente, celdas con bloques recursivos y nombre accesible, desplazamiento local |
| Fallos de contenido | Un tipo inesperado podía abortar la actualización y dejar la pregunta anterior | Aislamiento por bloque, aviso accesible y reemplazo del contenido anterior |

Se reutilizaron las ideas de flujo de párrafos, fronteras display/imagen/tabla, centrado proporcional y manejo de errores de imagen. No se copió la interfaz del standalone, ni sus tarjetas, fuentes, colores, opciones, fondos de tabla, bordes o animaciones.

El standalone utiliza salida MathML nativa. Se conserva `htmlAndMathml` de KaTeX: HTML para visualización consistente con las fuentes ya incluidas y MathML semántico para accesibilidad. No se aplanan fórmulas ni se infiere LaTeX a partir de texto. `strict: 'warn'` coincide con la referencia; `throwOnError`, `trust: false`, `maxExpand: 1000` y `maxSize: 20` permanecen. Las opciones de salida están documentadas en [KaTeX](https://katex.org/docs/options); [MDN MathML](https://developer.mozilla.org/en-US/docs/Web/MathML) documenta el soporte nativo. La guía instalada de Next admite Chrome/Edge 111+, Firefox 111+ y Safari 16.4+; no se probaron todas esas versiones mínimas.

Todos los selectores del CSS nuevo están bajo `.paessed-blocks`. El papel, header, alternativas como botones individuales, navegación, sidebar, páginas principales, tipografías, temas y Shared Element Transitions conservan su código. Tampoco se modificaron el lector, validadores, hashes, exportador ni contrato de PAES Importer Skill.

Se corrigió además un fallo anterior en `components/import-exam.tsx`: el adaptador intentaba recorrer `parsed.validation.warnings`, un campo ausente en el lector actual. El fallback a una lista vacía permite importar paquetes estrictamente válidos sin omitir ninguna validación.

## Datos reales y evidencia visual

TESLA: `../contrato/package_corregido.zip`, contrato 0.1.0, 65 preguntas. Contiene `audit/revision_por_pregunta.json`, que el lector estricto correctamente rechaza como archivo extra. La copia compatible se generó fuera de Git con la herramienta existente `package_io.pack(..., include_evidence=True)` sobre la extracción temporal. La igualdad de los datos de `final.json` original y empaquetado se verificó; los Gold y ZIP originales quedaron intactos.

SHA-256 de la copia usada por ambos visores: `1abd9ef269c9e5fe730346d7319fd704fff2d5df52424c1822d6290002266dc4`.

Se capturaron 31 pantallas antes y 31 después (28 layouts TESLA más Inicio/Ensayos/Playground) y 14 capturas standalone (7 preguntas × 2 tamaños). Escritorio: 1440×1000; móvil: 390×844. TESLA se verificó en hoja clara y oscura. La captura inicial fue sobre el servidor de desarrollo existente; la final sobre un servidor de producción separado. Las diferencias fuera del contenido incluyen animaciones de Inicio y herramientas de desarrollo: esas capturas no son una afirmación de igualdad de píxeles de toda la aplicación.

Las 28 combinaciones preservan cantidades de fórmulas e imágenes frente a ambos renderizadores, proporciones originales y dimensiones del header; no hay alertas de render, errores JavaScript ni overflow horizontal de página. El header en P19 clara/P20 oscura, escritorio/móvil, tiene cero píxeles diferentes en las muestras comparadas. La fidelidad comprobada se limita a los casos y motores ensayados, no certifica todo contenido posible ni su corrección matemática.

| Pregunta | Observación |
| --- | --- |
| P1 | Frases separadas, tabla estructurada, valores monetarios literales y cuatro alternativas |
| P15 | Fracción y potencias completas, respetando `display: true`; el `?` posterior permanece en un párrafo separado según el contrato y standalone |
| P19 | Radicales inline con texto, alternativas matemáticas independientes |
| P20 | Fracción y raíces de índices distintos completas en móvil y oscuro |
| P25 | Figura centrada y proporcional; etiqueta derecha ya cortada en el PNG original |
| P41 | Cuatro gráficos asociados a sus alternativas, sin deformación ni clipping adicional; D contiene una etiqueta inferior cortada en el PNG |
| P50 | Vectores, fracciones y figura conservan la estructura y asociación |

Ejemplos versionados:

- P1: [antes](evidence/before-desktop-light-p1.png) / [después](evidence/after-desktop-light-p1.png).
- P20 móvil: [antes](evidence/before-mobile-light-p20.png) / [después](evidence/after-mobile-light-p20.png) / [standalone](evidence/standalone-mobile-p20.png).
- P41 móvil: [antes](evidence/before-mobile-light-p41.png) / [después](evidence/after-mobile-light-p41.png). Las alternativas siguientes se ven desplazando verticalmente la hoja; las métricas incluyen las cuatro imágenes.
- [Matriz de 28 layouts](evidence/matrix-verification.json), [flujos UI](evidence/flows.json).

La matriz completa, capturas, scripts de captura y métricas originales están en `../renderer-audit-20261012/`, fuera de Git.

## Pruebas ejecutadas

| Comprobación | Resultado |
| --- | --- |
| TypeScript `npx tsc --noEmit` | PASS |
| `npm run build` | PASS: compilación, TypeScript y 15 rutas |
| `node tests/paessed.cjs` | PASS: contratos 0.1.0/0.2.0, curriculum, edición segura, export/import, integridad y archivo inválido |
| `npm run test:curriculum` | 6/6 PASS |
| `npm run test:exam-progress` | 4/4 PASS |
| `npm run test:renderer` | 7 subcasos PASS en Chrome, Firefox y WebKit (8 tests contando el padre por motor) |
| Lint de los cuatro archivos de código tocados | PASS, 0 errores y 0 warnings |
| UI real en Chrome sobre producción | 13 flujos PASS: importación 0.1.0, selección, marca, lápiz, borrador, navegación, restauración, mapa, cuatro gráficos, exportación, igualdad de bytes/hashes/datos, reimportación, importación 0.2.0 con curriculum |
| Diff/ancestry | CSS scoped; reader/validator/export/viewer/global CSS sin cambios; main y lector preservados |

Las regresiones de render fueron ejecutadas contra el motor anterior y fallaron antes de implementar. Se probaron DOM y layout reales con Playwright. No se añadió ninguna dependencia de ejecución: Playwright es dependencia de desarrollo.

Para repetir las regresiones: instalar dependencias y `npx playwright install chromium firefox webkit`; ejecutar `npm run test:renderer`, y definir `PAESSED_BROWSER=firefox` o `webkit` para los otros motores. `PAESSED_BROWSER_CHANNEL=chrome` permite usar Chrome instalado. No existe script ni configuración de lint global en la base: se ejecutó ESLint temporal con comprobación de variables/flujo y reglas de hooks/dependencias en los archivos modificados. Configuración en `../renderer-audit-20261012/eslint.config.mjs`.

## Límites conocidos

- P25 y P41-D requieren corregir assets en una versión nueva de datos; el motor no puede recuperar píxeles ausentes. También se conserva la marca de agua presente en las imágenes.
- Safari/iPhone y Android físicos, versiones mínimas de navegadores y lectores de pantalla reales no se probaron. WebKit en Windows es una prueba del motor, no Safari en un dispositivo real.
- No hay snapshots universales estables de Inicio/Playground: contienen animaciones y la captura previa incluye herramientas dev. Se inspeccionaron las diferencias y no hay cambios de código ni CSS dirigidos a esas pantallas.
- El warning preexistente de Next sobre `experimental.viewTransition` y los avisos de workspace/Node no se corrigieron dentro de este alcance. La configuración de transitions no fue modificada.

## Publicación

Rama publicada en GitHub; commits de código: `8c917cb` (adaptador de importación) y `243cee7` (motor, tests y evidencia). Vercel informó `success / Deployment has completed` para `243cee7`; deployment `dpl_SUibJ1qe1ABMdZKGxAfoduGUu9YX`, proyecto `paesseduiux`.

- [Inicio de la preview](https://paesseduiux-git-feat-pae-47bc3d-sebinsebonzb-gmailcoms-projects.vercel.app/app/inicio).
- [Ensayos de la preview](https://paesseduiux-git-feat-pae-47bc3d-sebinsebonzb-gmailcoms-projects.vercel.app/app/ensayos).
- [Estado del deployment](https://vercel.com/sebinsebonzb-gmailcoms-projects/paesseduiux/SUibJ1qe1ABMdZKGxAfoduGUu9YX).

La preview requiere autenticación Vercel: el navegador anónimo redirige al login (el HTTP 200 final pertenece al login). El conector devuelve 403 al consultar el equipo y al acceder a ambas rutas mediante el fetch autenticado; no hay credenciales CLI ni sesión de navegador conectada disponible. Por tanto, los 13 flujos UI y las capturas finales verifican el build de producción local, no la preview remota. Para completar esa comprobación se necesita una conexión Vercel autorizada para `sebinsebonzb-gmailcoms-projects` o una sesión autenticada disponible. No se modificó Deployment Protection.

Estado: implementación lista para revisión técnica; los defectos de assets no bloquean el motor. La aprobación final para integrar a main queda pendiente de comprobar la preview autenticada y de la aceptación visual en dispositivos reales. No se hizo merge a main.
