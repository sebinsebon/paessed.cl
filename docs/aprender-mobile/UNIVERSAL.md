# Hoja compartida de PAESSED

Validación del 10 de noviembre de 2026, rama `feat/aprender-mobile`, sobre los cambios pendientes de `d9ad32f`.

## Comportamiento definitivo

Aprender, diagnóstico iniciado desde Inicio o Aprender, ensayos Default, importados, demostración y Playground comparten la hoja de preguntas. En escritorio mantienen la hoja amplia; en móvil, cabecera compacta, hasta cinco segmentos y controles al pie.

Un toque activa el lápiz sobre toda la hoja visible, incluido el espacio vacío. Otro toque antes de 500 ms abre las opciones. Al cumplirse los 500 ms desaparece la tuerca y vuelve el lápiz normal; el siguiente toque desactiva el dibujo y permite desplazar la hoja. El doble toque sobre un trazo elimina solo ese trazo. No aparece una barra de zoom al salir.

La tinta conserva dimensiones propias, tipografía y distribución de alternativas. Se ajusta al ancho disponible y amplía su altura al crecer la ventana mientras se dibuja, reproyectando las coordenadas sin mover los trazos anteriores. Las pruebas comprueban las coordenadas y los píxeles pintados después de ampliar y recargar.

Cada modalidad conserva su motor de respuestas y entrega. El diagnóstico no muestra corrección ni IA durante las preguntas. Los ensayos permiten cambiar o desmarcar respuestas antes de entregar, conservan la entrega al recargar y no duplican evidencia. Playground mantiene feedback neutral si no hay clave verificada. La ayuda IA pausa el cronómetro opcional de la pregunta; el cronómetro global de la demostración conserva su funcionamiento independiente. Una demostración nueva recibe otra identidad de tinta.

## Correcciones de integración

- El menú ejecuta primero la acción y después se cierra; los diálogos de entrega funcionan también desde preguntas intermedias.
- Se corrigió la hidratación del selector de subejes de Playground cuando el navegador tiene movimiento reducido: los botones animados mantienen el mismo `tabindex` en servidor y cliente.
- Las cajas invisibles de las fracciones de KaTeX ya no interceptan clics de otras alternativas. Se reproduce con Regular 2023, pregunta 44.
- La persistencia interna de archivos usa `ArrayBuffer`, evitando el error de IndexedDB con Blob/File en WebKit de Windows. La API pública devuelve un Blob y continúa leyendo los registros Blob anteriores, sin cambiar la versión de la base de datos.
- La validación importa el `.paessed` TESLA completo: 65 preguntas y 18 recursos. Compara el SHA-256 del archivo persistido, el JSON original y las imágenes cargadas después de recargar. No se sustituyó por un JSON sin imágenes para WebKit.
- Se retiraron las ramas antiguas de tarjetas del diagnóstico y de los ensayos Default.

## Resultados finales

Todas las suites de navegador de esta tabla se ejecutaron sobre `next start` después del build final. [Resumen verificable por caso y navegador](universal/results.json).

| Validación | Resultado |
|---|---:|
| Matriz universal: siete accesos a 320, 390 y 1440 px; tinta, entregas, recursos, sesiones e IA | 64/64, Chromium + WebKit |
| Interacción móvil: lápiz de 500 ms, borrado, rotación, almacenamiento, cronómetro y accesibilidad | 24/24, Chromium + WebKit |
| Diagnóstico completo, corrección, reanudación y XP | 2/2, Chromium |
| Visor importado, evidencia y entrega inmutable | 3/3, Chromium |
| Integración, dos pestañas, respaldos y almacenamiento | 7/7, Chromium |
| Motor y repositorio de aprendizaje | 26/26, Node |
| Renderizador, recursos, importaciones y énfasis | 26/26, Node |
| Progreso del ensayo, currículo y ayuda IA | 16/16, Node |
| TypeScript, build y `git diff --check` | Aprobados |

Total: **100 pruebas de navegador y 68 pruebas Node**. Las matrices universal y móvil terminaron sin casos omitidos, fallos ni reintentos. Los resultados completos locales permanecen en `tests/test-results/universal-paes`, `learning-mobile`, `learning-ui`, `imported-learning` e `integration`.

## Capturas revisadas

Las capturas corresponden al build final, no a los previews históricos. El diagnóstico puede seleccionar ejercicios distintos entre sesiones; estas imágenes documentan composición y contenido real, no una comparación de píxeles del mismo ejercicio.

| Acceso | Chromium móvil / escritorio | WebKit móvil / escritorio |
|---|---|---|
| Aprender | [390](universal/chromium-learning-390.png) / [1440](universal/chromium-learning-1440.png) | [390](universal/webkit-learning-390.png) / [1440](universal/webkit-learning-1440.png) |
| Diagnóstico desde Inicio | [390](universal/chromium-diagnostic-inicio-390.png) / [1440](universal/chromium-diagnostic-inicio-1440.png) | [390](universal/webkit-diagnostic-inicio-390.png) / [1440](universal/webkit-diagnostic-inicio-1440.png) |
| Diagnóstico desde Aprender | [390](universal/chromium-diagnostic-aprender-390.png) / [1440](universal/chromium-diagnostic-aprender-1440.png) | [390](universal/webkit-diagnostic-aprender-390.png) / [1440](universal/webkit-diagnostic-aprender-1440.png) |
| Ensayo Default | [390](universal/chromium-default-390.png) / [1440](universal/chromium-default-1440.png) | [390](universal/webkit-default-390.png) / [1440](universal/webkit-default-1440.png) |
| Ensayo importado | [390](universal/chromium-imported-390.png) / [1440](universal/chromium-imported-1440.png) | [390](universal/webkit-imported-390.png) / [1440](universal/webkit-imported-1440.png) |
| Demostración | [390](universal/chromium-demo-390.png) / [1440](universal/chromium-demo-1440.png) | [390](universal/webkit-demo-390.png) / [1440](universal/webkit-demo-1440.png) |
| Playground | [390](universal/chromium-playground-390.png) / [1440](universal/chromium-playground-1440.png) | [390](universal/webkit-playground-390.png) / [1440](universal/webkit-playground-1440.png) |

Figura TESLA original después de recargar: [Chromium](universal/chromium-imported-original-figure.png) · [WebKit](universal/webkit-imported-original-figure.png).

Lápiz activo y configuración: [Chromium activo](universal/chromium-pen-active.png) · [Chromium opciones](universal/chromium-pen-settings.png) · [WebKit activo](universal/webkit-pen-active.png) · [WebKit opciones](universal/webkit-pen-settings.png).

## Reproducir

```powershell
npm run build
npm run start -- --port 3100
```

En otra terminal, dentro del repositorio:

```powershell
$env:PAESSED_BASE_URL='http://localhost:3100'
npx playwright test --config tests/universal-paes.config.cjs
npx playwright test --config tests/learning-mobile.config.cjs tests/learning-mobile-pen.spec.cjs tests/learning-mobile.spec.cjs
npx playwright test --config tests/learning-ui.config.cjs
npx playwright test --config tests/learning-imported-viewer.config.cjs
npx playwright test --config tests/learning-integration.config.cjs
npm run test:learning
node --test tests/paessed-renderer.cjs tests/imported-resources.cjs tests/playground-imports.cjs tests/inline-emphasis.cjs
npm run test:exam-progress
npm run test:curriculum
npm run test:ai-unit
npx tsc --noEmit
git diff --check
```

## Alcance

Chromium y WebKit de Playwright sobre Windows. No se afirma validación en dispositivos iPhone o Android físicos. Los barridos históricos de 573 preguntas y la comparación de snapshots heredados pertenecen a [la validación anterior](VALIDACION.md); no se presentan como barridos nuevos de esta implementación ni se actualizan snapshots para ocultar diferencias.

El build conserva dos advertencias previas: `experimental.viewTransition` no reconocido por Next 16.3.6 y el `pnpm-workspace.yaml` externo al repositorio. No bloquean la compilación.
