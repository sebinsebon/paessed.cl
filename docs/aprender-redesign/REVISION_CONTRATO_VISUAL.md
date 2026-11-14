# Revisión de Contrato de la Propuesta Visual: Aprender (PAESSED M1)

**Fecha:** 8 de noviembre de 2026  
**Documento auditado:** `docs/aprender-redesign/propuesta.html` y `docs/aprender-redesign/PROPUESTA_UI_UX.md`  
**Autor:** Antigravity (agy2)  
**Coordinación:** Codex (t1)  
**Modalidad:** Auditoría de contrato y fidelidad técnica (solo lectura de la propuesta y de la aplicación).  
**Entregable autorizado:** `docs/aprender-redesign/REVISION_CONTRATO_VISUAL.md`  
**Estado:** Dictamen final cerrado (contenidos contractuales actualizados en `propuesta.html`).

---

## 1. Resumen de Estado Final

Se verificaron las actualizaciones aplicadas en [`docs/aprender-redesign/propuesta.html`](./propuesta.html), confirmando que el mockup interactivo refleja con precisión el contrato de producto de Aprender, el motor determinista y el currículum DEMRE M1:

* **Taxonomía M1 corregida:** El panel deslizable (*drawer*) exhibe los denominadores exactos oficiales: **3/3 en Números**, **3/6 en Álgebra y Funciones**, **2/4 en Geometría** y **2/3 en Probabilidad y Estadística** (totalizando los 16 subejes oficiales M1).
* **Delimitación de la vista previa:** El modal interactivo está explícitamente etiquetado como `VISTA PREVIA DE PREGUNTA (DEMO)` con control `✕ Cerrar vista previa`. Se distingue con nitidez la representación de las **7 sesiones reales de aprendizaje** del bloque (4M + 3R) respecto al **ejemplo interactivo de 1 pregunta** diseñado exclusivamente para ilustrar la mecánica de feedback inmediato y la pantalla de resumen.
* **Copy honesto de claves y explicaciones:** Se actualizó el texto del popover y del resumen formativo (`"Clave verificada DEMRE: Explicación provisional o no disponible según el banco"` y `"En la fase de corrección vuelves a la pregunta con dos nuevos intentos. Si no se resuelve, revisas la clave verificada DEMRE"`), sin cifras obsoletas ni asunciones no verificables.

---

## 2. Matriz de Comprobación de Contrato

| Criterio de Contrato | Requisito de Especificación | Comprobación en `propuesta.html` | Dictamen |
|---|---|---|---|
| **1. Estructura de 7 Sesiones** | 7 sesiones de aprendizaje reales (5 preguntas c/u). Ningún hito sustituye a un nodo. | 7 posiciones de nodos táctiles reales; el hito decorativo (🏁) se ubica separado con posterioridad a la séptima sesión. | **CONFORME** |
| **2. Proporción 4:3 (M/R)** | Cada ciclo continuo tiene exactamente 4 Mantenimiento y 3 Refuerzo, sin secuencias triples. | 4 nodos `M` (pos 1, 2, 5, 6) y 3 nodos `R` (pos 3, 4, 7). Secuencia: M-M-R-R-M-M-R. Cero triples. | **CONFORME** |
| **3. Sin Candados Curriculares** | Nodos futuros son previsiones adaptativas de la cola, no niveles bloqueados con llave. | Sin candados ni llaves. Los nodos futuros (`upcoming`) son neutros y explican su naturaleza adaptativa al pulsarlos. | **CONFORME** |
| **4. Coherencia de Estados** | Estados: `completed` (pasado), `active` (foco actual), `upcoming` (previsión futura). | Pos 1..3 en verde con tilde; Pos 4 activa naranja (104px escritorio / 96px móvil) con bocadillo; Pos 5..7 en gris táctil. | **CONFORME** |
| **5. Reglas de XP y Rachas** | 5 XP por primera respuesta elegible al completar (máx 25 XP). Cero premios ficticios. | Indicadores de racha y XP acumulado coherentes. Sin vidas, corazones, gemas, cofres ni ligas. | **CONFORME** |
| **6. Calibración a 15 por Eje** | 15 respuestas originales por eje. Menos de 15 se muestra en gris provisional; $\ge 15$ calibrado. | Drawer muestra ejes en gris neutro hasta 15; Números (18/15) calibrado en verde esmeralda. | **CONFORME** |
| **7. Taxonomía 4 Ejes / 16 Subejes** | Números: 3; Álgebra: 6; Geometría: 4; Probabilidad: 3 (total 16 subejes oficiales). | Drawer actualizado con denominadores oficiales exactos: 3/3, 3/6, 2/4 y 2/3 subejes observados. | **CONFORME** |
| **8. Clave Verificada vs. Explicación** | Claves oficiales verificadas señalando honestamente explicaciones provisionales o ausentes. | Textos explícitos y unificados en popover y resumen indicando clave DEMRE verificada y condición de explicación. | **CONFORME** |

---

## 3. Delimitación de Alcance y Limitaciones del Prototipo

1. **Ruta y Nodos (Arquitectura visual):**
   * Las 7 posiciones desplegadas en el recorrido representan **7 sesiones de aprendizaje completas** de 5 preguntas cada una (35 preguntas por bloque).
   * La distinción entre nodos completados, nodo en curso y previsiones futuras respeta la cola adaptativa del motor sin introducir árboles bifurcados ni candados punitivos.
2. **Simulador Interactivo (Vista previa de flujo):**
   * El modal `sessionSimulator` actúa como un **ejemplo demostrativo de una sola pregunta** para validar la respuesta visual del feedback inmediato, la inmutabilidad de la primera respuesta y el paso a la tarjeta de resumen.
   * No ejecuta persistencia en IndexedDB ni itera secuencialmente por los 5 ítems de la sesión; esa funcionalidad corresponde al componente React `NodeSession` en la aplicación real.
3. **Drawer de Calibración:**
   * Muestra fielmente el criterio de 15 respuestas originales por eje antes de salir del estado gris provisional, alineado con la taxonomía M1.

---

## 4. Dictamen Final

La propuesta visual [`propuesta.html`](./propuesta.html) representa el contrato revisado de PAESSED M1: siete sesiones, proporción 4:3, ausencia de candados artificiales, reglas de XP y taxonomía M1. Es un prototipo con datos de ejemplo y una pregunta interactiva sin persistencia; no verifica el motor ni sustituye una sesión real. La revisión estática de este informe no constituye una auditoría completa de accesibilidad. La aplicación existente sigue intacta y la propuesta queda pendiente de aprobación visual.
