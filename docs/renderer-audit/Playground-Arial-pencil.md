# Arial, Playground y menú del lápiz — 2026-10-13

Rama: `feat/paessed-standalone-renderer`. Base: `1b3b0a5`, con `origin/main` (`ef90df4`) y el lector 0.2.0 incluidos. Sin merge a main.

## Causas y cambios

Playground utilizaba un adaptador que aplanaba las matemáticas a LaTeX literal, descartaba `options[].blocks` y mostraba las etiquetas como contenido de alternativas. Sus imágenes se buscaban por rutas con JSZip en un flujo independiente, sin el registro de IDs usado por Ensayos. Tampoco leía `answer.status/label` ni `curriculum.subeje` del contrato.

- El adaptador conserva enunciados, alternativas, etiquetas y explicaciones estructuradas. El texto simplificado se utiliza en búsqueda/previsualizaciones y como respaldo para datos genéricos. Los 65 enunciados y las 260 alternativas de TESLA mantienen sus bloques originales.
- Playground usa `PaessedBlocks` y el mismo resolvedor de recursos que Ensayos. Un hook compartido conserva la distinción entre lectura estricta y ZIP genérico, muestra los errores del contenido actual y administra la cancelación y revocación de URL al salir o cambiar de fuente. Reabrir una fuente nunca reutiliza sus URL revocadas.
- Las respuestas y explicaciones del contrato solo se usan para corregir cuando están verificadas. Los estados provisionales y ausentes no se convierten en respuestas correctas. La clasificación disponible en 0.2.0 alimenta los filtros; la clasificación pendiente sigue sin inventarse.
- Arial se aplica al enunciado, alternativas, texto de tablas y explicaciones de la hoja. KaTeX conserva sus fuentes matemáticas. No se modificaron estilos globales, sidebar, header, controles, transiciones ni el diseño de la configuración de Playground.
- El estado del lápiz se comparte entre los tres visores: activar abre herramientas; iniciar dibujo/borrado las oculta sin desactivar el lienzo; pulsar el lápiz oculto reabre el menú; pulsarlo con menú abierto desactiva el dibujo. Se conservan tinta, borrador y deshacer. El callback opcional `onInteractionStart` no desmonta el canvas ni modifica su geometría.

Cambios internos de tipos: `BankQuestion` añade bloques y etiquetas opcionales; `loadPlaygroundImports` proporciona registros completos para resolver recursos. No cambian el formato del paquete ni el JSON de entrada.

## Evidencia visual

Capturas reales sobre el build de producción, usando el mismo paquete candidato TESLA P41 en ambos estados:

- [P3 antes, móvil](evidence/playground-arial/playground-p3-before-mobile.png): LaTeX sin representar y etiquetas como alternativas.
- [P3 después, móvil](../../tests/playground-renderer.spec.cjs-snapshots/playground-p3-mobile-light-chromium-win32.png): fracciones, puntuación y cuatro alternativas matemáticas.
- [P41 antes, escritorio](evidence/playground-arial/playground-p41-before-desktop.png).
- [P41 después, escritorio](../../tests/playground-renderer.spec.cjs-snapshots/playground-p41-desktop-light-chromium-win32.png): cada imagen dentro de su alternativa, con desplazamiento de la hoja para contenido alto.
- [P41 C móvil oscuro](../../tests/playground-renderer.spec.cjs-snapshots/playground-p41-option-2-mobile-dark-chromium-win32.png) y [P41 D móvil claro](../../tests/playground-renderer.spec.cjs-snapshots/playground-p41-option-3-mobile-light-chromium-win32.png): ejes, números y etiquetas inferiores completos.
- [P47 fórmula móvil](../../tests/playground-renderer.spec.cjs-snapshots/playground-p47-formula-mobile-light-chromium-win32.png): fórmula completa, sin scroll interno.

Se añadieron 48 referencias de Playground: P1/P2/P3/P25/P41/P47, cuatro gráficos individuales de P41 y fórmula/alternativas de P47, en escritorio/móvil y claro/oscuro. Se actualizaron 33 referencias existentes afectadas por Arial y las letras de las alternativas. Las referencias del motor para fórmulas extensas, tablas y P47 permanecieron iguales. Una comparación de P2 escritorio encontró diferencias de cero píxeles en el header y el pie de Ensayos; no se afirma identidad píxel a píxel de toda la pantalla durante las transiciones.

## Verificación

Las nuevas pruebas fallaron en la versión anterior: ausencia de bloques en Playground, clasificación no reconocida y menú que permanecía visible al dibujar. Se ejecutaron después del cambio contra `next start`, no solo contra un DOM simulado.

| Comprobación | Resultado |
|---|---|
| TypeScript `tsc --noEmit` | PASS |
| ESLint de componentes/hooks/adaptador modificados y pruebas nuevas | 0 errores; 2 avisos por directivas existentes de imágenes locales |
| `npm run build` | PASS; avisos previos de `experimental.viewTransition` y workspace externo |
| Conversión Playground | 3/3 PASS; cobertura exacta de 65 preguntas, etiquetas, curriculum y respuestas verificadas |
| Recursos / exportación / candidato P41 | 8/8 PASS |
| Curriculum / progreso demo | 6/6 y 4/4 PASS |
| Motor en Chromium / Firefox / WebKit | 13/13 PASS en cada navegador |
| Suite visual completa, sin actualizar referencias | 83/83 PASS, sin actualizar referencias |

Las regresiones de Playground cubren filtros 0.2.0, favoritos e historial, corrección, reintento, aplicación de filtros ahora y en la próxima pregunta, recursos ZIP y JSON sin archivo adjunto, revocación/reapertura de URL y dibujo con ratón/táctil. Se comprueban píxeles de tinta para demostrar continuidad del primer trazo y el borrado real. Las regresiones anteriores conservan importación/exportación, reimportación, progreso, 65 preguntas y las 18 imágenes.

SHA-256 del fixture TESLA original: `1abd9ef269c9e5fe730346d7319fd704fff2d5df52424c1822d6290002266dc4`. Candidato P41: `d011d81d3a464f7f1755661af67cb8e70dee3ab2910550f769b977053519f30c`. Ambos intactos; no se regeneraron imágenes ni se alteró el contrato.

## Publicación y límites

La publicación usa el push a la misma rama y la integración Git de Vercel. [Preview Playground](https://paesseduiux-git-feat-pae-47bc3d-sebinsebonzb-gmailcoms-projects.vercel.app/app/playground) y [Ensayos](https://paesseduiux-git-feat-pae-47bc3d-sebinsebonzb-gmailcoms-projects.vercel.app/app/ensayos). La revisión visual remota queda pendiente mientras Vercel mantenga la protección de acceso. La verificación local de producción y las capturas no sustituyen una comprobación remota autenticada. No se integra a main en este trabajo.
