# Aprender integrado en PAESSED

Implementación local en `feat/aprender`, sobre los cambios existentes de `C:\Users\Administrator\paessed-aprender`.

Vista real: http://127.0.0.1:3100/app/aprender

## Experiencia

- Se conserva la navegación, cabecera y tema originales de PAESSED. La ruta usa el estado real de IndexedDB, con siete sesiones por bloque, historial, XP, racha, meta diaria y mapa M1 desplegable.
- Los nodos recuperan el relieve de la primera propuesta: 96/104 px en escritorio y 88/96 px en móvil, extrusión de 6–8 px y halo del nodo actual. Los conectores se alinean con los centros reales de los nodos mediante `ResizeObserver`.
- El nodo actual muestra una vista previa antes de iniciar o retomar. Los nodos futuros y completados permiten consultar su información.
- La sesión ocupa todo el viewport, con salida y progreso arriba, contenido desplazable y acciones fijas abajo. Oculta la navegación general mientras se responde y restaura el marco de PAESSED al salir.
- El visor de preguntas usa la estructura de hoja de Ensayos y Playground: barra superior de tres columnas, etiquetas compartidas de eje/subeje, papel plano de borde a borde, alternativas compactas y acciones al pie. Reutiliza `PaessedBlocks`, `PlaygroundScratchpad`, `QuestionTopicTags` y `useDrawingTools`.
- La apariencia clara/oscura/automática usa la misma preferencia de hoja que los otros modos. El lápiz añade colores, goma y deshacer, conservando las claves de trazos existentes. Las preguntas guardadas comparten la colección de Playground.
- Tras confirmar, la alternativa correcta se destaca en verde. Si la elegida es incorrecta, también se muestra en rojo; ambos estados incluyen iconos y se conservan al cambiar la apariencia de la hoja. El puntaje original y los reintentos permanecen separados.
- Se mantienen las respuestas confirmadas, trazos del lápiz, correcciones y XP. No hay cambios en el esquema de datos ni nuevas API.

## Verificación

- 26 pruebas del motor y repositorio: aprobadas.
- 2 pruebas de navegador del flujo completo: aprobadas. Incluyen diagnóstico de 16 preguntas, resultado original 3/5, dos reintentos, revisión de solución, cierre, recarga, reanudación, lápiz, XP y error de carga recuperable.
- La revisión del visor vuelve a verificar esos dos flujos y añade dibujo en color, deshacer, bloqueo de alternativas al dibujar, preguntas guardadas y apariencia compartida con Ensayos. Otras dos pruebas de integración confirman evidencia, reanudación y respaldo de Ensayos, y evidencia compartida con Playground.
- Comprobación de viewport completo en escritorio y móvil; ruta sin desbordes a 768, 430 y 390 px; tema oscuro desde los controles reales de PAESSED.
- Compilación de producción y TypeScript: aprobadas. `git diff --check`: sin errores.
- Capturas de la aplicación obtenidas en un contexto aislado de pruebas, sin modificar el perfil del usuario: [ruta escritorio](./app-ruta-desktop.png), [ruta móvil](./app-ruta-mobile.png), [pregunta escritorio](./app-pregunta-desktop.png), [pregunta móvil](./app-pregunta-mobile.png).

El motor no fue modificado por esta integración visual. Los hallazgos previos H-01 y H-02 siguen documentados en [la auditoría funcional](./AUDITORIA_FUNCIONAL.md).
