# Dictamen Técnico de Integración: Modo Aprender (UI Real)

**Fecha:** 2026-11-08  
**Rama:** `feat/aprender`  
**Directorio:** `C:\Users\Administrator\paessed-aprender`  
**Auditor:** Agente AGY2 (Auditoría estática y de integración funcional)  
**Coordinador:** Codex `t1`  

---

## 1. Resumen Ejecutivo

Se auditó la integración estática y contractual de la interfaz real del modo Aprender, implementada en `components/learning/` (`learn-experience.tsx`, `node-session.tsx`, `node-session.module.css` y el submódulo de ruta `route/learning-route.tsx`, `route/route.module.css`), frente al motor algorítmico (`lib/learning/engine.ts`), los tipos (`lib/learning/types.ts`) y la persistencia atómica en IndexedDB (`lib/learning/repository.ts`).

La compilación estática de TypeScript (`npx tsc --noEmit --incremental false`) finaliza con **0 errores**, la suite pura de pruebas del motor (`tests/learning-engine.test.mjs`) pasa **25/25 subtests** con simulaciones a 30, 60 y 90 días, y las pruebas de interfaz (`tests/learning-ui.spec.cjs`) ratifican el flujo con preguntas reales del banco Gold573, persistencia de tinta en scratchpad, reanudación tras recarga y pantalla completa inmersiva.

---

## 2. Verificación de Contratos Funcionales

### A. Estructura de 7 Sesiones y Bloques Serpenteantes (`positions7 / current`)
- **Contrato de bloque:** Cada ciclo genera exactamente 7 nodos según `CYCLE_TYPES = ["M", "M", "R", "R", "M", "M", "R"]`. `learning-route.tsx` divide el avance en bloques de 7 nodos (`blockNodes = state.nodes.slice(blockStart, blockEnd)`), garantizando siempre una vista de 7 posiciones activas/completadas/futuras por bloque.
- **Selectores de prueba y estados:** Cada nodo táctil expone `data-testid="learning-route-node"` y su atributo `data-state` (`"current"`, `"completed"` o `"future"`), cumpliendo con los selectores de automatización.
- **Hito de bloque independiente:** El marcador de hito final (🏁) se renderiza fuera de la colección de 7 sesiones interactivas, como un elemento informativo del "Cierre de Bloque (4M + 3R)", sin falsear un octavo nodo ni alterar el estado.
- **Previsión adaptativa sin candados:** Los nodos futuros permiten abrir un modal informativo de previsión adaptativa sin alterar la cola de nodos ni arrojar excepciones. La cola se reordena orgánicamente según el desempeño real.

### B. Proporción 4M : 3R (Mantenimiento vs. Refuerzo)
- **Etiquetado visual claro:** Cada nodo muestra su medallón `M` o `R` con estilos diferenciados (`typeBadgeM` y `typeBadgeR`).
- **Alternancia formativa:** Se mantiene la rotación acordada de 4 sesiones transversales de mantenimiento y 3 sesiones adaptativas focalizadas en subejes débiles.

### C. Guardado Atómico, Inmutabilidad de Primera Vuelta y Reanudación
- **Inmutabilidad de primera respuesta:** Al confirmar una alternativa en la fase original, la acción `{ type: "answer" }` se persiste de inmediato en `node.answers` y `state.attempts`. La interfaz bloquea la modificación de la opción seleccionada.
- **Reanudación transparente (`resume`):**
  - Si el estudiante sale o recarga en la pregunta $k$ ($1 \le k \le 5$), `displayId` se inicializa en la primera pregunta sin respuesta registrada (`node.questionIds.find(id => !node.answers[id])`).
  - La barra de progreso refleja con exactitud las respondidas (`answered / 5`), y el bocadillo contextual cambia a `"CONTINÚA AQUÍ"` con el botón `"Retomar sesión"`.
- **Persistencia de lápiz (Scratchpad):** Los trazos del canvas se aíslan y preservan bajo la clave `paessed-learning-ink:${node.id}:${questionId}`, manteniéndose intactos tras salir y retomar la sesión.

### D. Flujo de Corrección Formativa (Límite de 2 Reintentos)
- **Separación de fases:**
  - Si el resultado original es menor a 5/5, la sesión pasa a la pantalla de balance formativo (*"Ahora viene el aprendizaje."*).
  - El botón `"Corregir mis errores"` abre exclusivamente las preguntas falladas en primera vuelta.
- **Límite de 2 reintentos:**
  - El estudiante dispone de hasta 2 reintentos con la acción `{ type: "retry" }`.
  - Si falla el segundo reintento (`tries >= 2` y `!resolved`), se activa `revealSolution={true}`, mostrando la alternativa correcta oficial DEMRE y habilitando el botón `"Revisé la solución"`.
  - La acción `{ type: "review" }` marca `viaSolution: true` y `resolved: true`.
- **Cierre del nodo:** Una vez resueltos todos los errores, se habilita `"Completar nodo"`, despachando `{ type: "complete-node" }` para congelar `completedAt` y adjudicar los XP correspondientes.

### E. Integridad de Datos (Sin Gamificación Ficticia)
- **Fórmula de XP:** Se otorgan estrictamente **+5 XP** por cada pregunta original inédita y no asistida respondida en el nodo (máximo 25 XP por sesión). No existen multiplicadores arbitrarios, vidas, gemas, cofres ni penalizaciones punitivas.
- **Racha local:** Calculada exclusivamente a partir de días calendario con sesiones completadas (`getLearningStats(state).streak`).
- **Regla de calibración (15 respuestas por eje):**
  - El drawer *"Tu Mapa M1"* y el resumen de dominio aplican `masteryPresentation(percent, isCalibrated)`.
  - Ejes con menos de 15 respuestas originales se presentan en gris con el rótulo `"En calibración · X/15"`. Solo al alcanzar 15 respuestas se desbloquea la escala cromática definitiva.
  - El botón del drawer cuenta con `aria-label="Mapa M1"`, alineándose con las pruebas de Playwright.

---

## 3. Estado de Correcciones Técnicas Integradas

Se verificaron las optimizaciones incorporadas para estabilidad en navegador:
1. **Control de desplazamiento del viewport:** `scrollbar-gutter: auto` y bloqueo de scroll en el `body` durante `NodeSession`, restaurando el estado previo al salir para evitar saltos de layout.
2. **Geometría SVG reactiva:** Sustitución de cálculos manuales de offset por observación dinámica sobre los puntos del DOM (mediante `ResizeObserver`), eliminando desfases en cambios de resolución móvil/escritorio y loops de render.
3. **Accesibilidad en progreso:** Corrección del atributo `aria-valuenow` durante la fase de corrección formativa, acotando el rango entre los errores reales observados y los ya subsanados.

---

## 4. Dictamen Final

La revisión estática no detectó regresiones en los contratos revisados de ruta, sesión, persistencia y corrección. La evidencia de las pruebas ejecutadas por el coordinador se recoge en [INTEGRACION.md](./INTEGRACION.md). Esta revisión no certifica accesibilidad completa ni modifica los hallazgos previos H-01 y H-02 del motor, que siguen documentados en la auditoría funcional. La entrega es local en `feat/aprender`.
