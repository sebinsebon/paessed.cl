# P47: scroll solo para contenido demasiado ancho

Rama `feat/paessed-standalone-renderer`, base `210dea1`. Fetch inicial confirmó rama local/remota iguales, con 10 commits propios y ninguno pendiente de `origin/main` (`ef90df4`). Main y el lector 0.2.0 son ancestros. Sin merge a main; configuración y archivos locales del usuario preservados fuera del commit.

## Causa reproducida

Las fórmulas display tenían `overflow-x: auto` aunque cupieran, mientras `fitMath()` solo decidía ese comportamiento para fórmulas inline. El valor vertical inicialmente visible se calcula como auto cuando el otro eje es auto, según [CSS Overflow](https://www.w3.org/TR/css-overflow-3/#overflow-properties). Algunas cajas posicionadas y líneas internas de KaTeX excedían ligeramente la altura lógica y creaban un área vertical desplazable.

En TESLA P47, escritorio: fórmula de **304.125 px** dentro de **1060 px**, altura del contenedor **68 px**, scrollHeight **70 px** y scrollTop alcanzable **2 px**. Móvil: fórmula **264.563 px** dentro de **325 px**, altura **58 px**, scrollHeight **60 px** y los mismos 2 px desplazables. Reproducido en claro y oscuro, usando el JSON original sin modificarlo. La prueba nueva falló contra el código anterior antes de implementar.

Chrome headless usa barras superpuestas; la prueba mide el desplazamiento vertical real, además del CSS y las capturas. No se infiere ausencia de scroll a partir de una barra que la plataforma no pinta.

| P47, claro y oscuro | Antes | Después |
| --- | --- | --- |
| Overflow calculado X/Y | auto / auto | visible / visible |
| Desplazamiento vertical interno alcanzable | 2 px | 0 px |
| Rectángulo y padding de la fórmula | Referencia | Idénticos |
| Ancho de fórmula/contenedor | Cabe en ambos tamaños | Sigue cabiendo |

[Métricas antes/después](evidence/p47-overflow-matrix.json). [Antes escritorio claro](evidence/p47-before-desktop-light.png), [antes móvil oscuro](evidence/p47-before-mobile-dark.png). [Después escritorio claro](../../tests/paessed-overflow.spec.cjs-snapshots/p47-formula-desktop-light-chromium-win32.png), [después móvil oscuro](../../tests/paessed-overflow.spec.cjs-snapshots/p47-formula-mobile-dark-chromium-win32.png).

## Corrección

`fitMath()` mide tanto inline como display contra el ancho útil del padre, incluyendo puntuación display y descontando padding de celdas. Solo las fórmulas que exceden ese ancho reciben `.paessed-math-overflow`. Las tablas aplican el mismo criterio mediante `.paessed-table-overflow`.

Los contenidos que caben quedan con overflow visible, sin viewport de scroll ni recortes de tinta. Los demasiado anchos conservan overflow-x auto. Antes de limitar el eje vertical en esos viewports, `fitVertical()` reserva el espacio que necesitan las cajas de KaTeX, SVG, líneas anónimas y redondeos. Las pruebas exigen scrollHeight <= clientHeight y scrollTop == 0: no basta esconder una barra mientras queda contenido cortado o desplazable verticalmente.

Las ecuaciones anchas se alinean al inicio dentro de su viewport para que sea posible alcanzar tanto su primer símbolo como el último. Las que caben conservan su centrado/flujo original. Los roles de región, etiquetas y tabulación se asignan únicamente a viewports horizontales reales; no a cajas inline con métricas internas de overflow ficticias.

No se usa scrollbar-width:none ni se ocultan barras globalmente. La regla overflow-y:hidden se limita a los viewports horizontales calculados, con altura/padding suficiente para sus símbolos. Las imágenes mantienen exactamente sus reglas anteriores de tamaño proporcional y object-fit:contain.

Cambios de implementación: `public/paessed/block-renderer.css` y `lib/paessed-runtime/block-renderer.js`. No cambiaron componentes React, páginas, CSS global, controles, fuentes, colores, transiciones, lector, validadores, importadores, exportador ni JSON/PNG/fixtures Gold. No cambia la API pública del motor ni los contratos 0.1.0/0.2.0.

## Regresiones

Ejecución final contra `next start` del build de producción: **68/68 Playwright PASS**, sin actualizar snapshots. Incluye las 55 regresiones previas intactas y 13 pruebas nuevas de overflow. Las capturas de P2/P3/P41 y las imágenes previas pasan sin cambios.

Las nuevas pruebas cubren P47 ZIP/.paessed, escritorio/móvil y claro/oscuro; fórmulas cortas, largas y altas, radicales, fracciones anidadas, exponentes e índices; tablas ajustadas/anchas y PNG reales de TESLA. Verifican proporciones de imágenes, límites verticales de símbolos, acceso a ambos extremos y desplazamiento por teclado. P47 se redimensiona de 390 a 320 y 1440 px para comprobar entrada/salida del viewport, limpieza de padding y ausencia de errores ResizeObserver.

Las capturas de fórmulas/tablas se toman antes de activar el scroll nativo de teclado, cuya animación no depende de CSS. Las 16 referencias nuevas están separadas de las capturas anteriores; ninguna captura anterior se actualizó.

Durante la ejecución se detectó una carrera en la prueba antigua de MathML: leía estilos de nodos ya retirados por la recarga de recursos (isConnected=false, estilos vacíos y rectángulo 0×0). Se corrigió únicamente el muestreo para esperar nodos conectados; las comprobaciones de posición absoluta, clipping y 1×1 px siguen siendo estrictas. No se cambió la carga de CSS para resolver un falso fallo del test. Las cuatro entradas de navegación fría se repitieron cinco veces: **20/20 PASS**.

El motor pasó **13/13** en cada uno de Chrome, Firefox y WebKit (incluido el contenedor de subtests). Recursos **5/5**, candidata P41 **3/3**, curriculum **6/6**, progreso **4/4** y contratos/edición/exportación con `node tests/paessed.cjs`: PASS. TypeScript, build y lint temporal de todos los JS/tests modificados: PASS. Los warnings preexistentes de Next sobre viewTransition/workspace permanecen fuera del alcance.

Para repetir: `npm run build`, `npm run start -- --port 3104`, `npm run test:renderer` y `npm run test:renderer-visual`. `PAESSED_BROWSER=firefox` o `webkit` selecciona esos motores para el test DOM; `PAESSED_BROWSER_CHANNEL=chrome` usa Chrome instalado. La configuración Playwright añade la nueva suite de overflow al conjunto anterior.

Las pruebas de producción y las capturas corresponden a Chrome/Windows; Firefox/WebKit verifican el motor con DOM/layout reales. No se afirma comprobar dispositivos físicos ni la preview protegida sin autorización Vercel.
