# Auditoría Funcional y Algorítmica: Modo Aprender y Entorno M1

**Fecha:** 8 de noviembre de 2026  
**Rama:** `feat/aprender`  
**Directorio auditado:** `C:\Users\Administrator\paessed-aprender`  
**Autor:** Antigravity (agy2)  
**Coordinación:** Codex (t1)  
**Modalidad:** Solo lectura de código, verificación estática y reproducciones puras.  
**Estado:** Informe final cerrado (validación independiente de t1 incorporada).

---

## 1. Resumen Ejecutivo

Se realizó una auditoría funcional exhaustiva y de solo lectura sobre el modo **Aprender** y su integración con los módulos de evidencia, catálogo Gold y almacenamiento local de PAESSED. Se examinaron los doce ejes de verificación requeridos: proporción 4:3, rotaciones M/R, calibración 15 por eje, dominio ponderado sin decaimiento calendario, diagnóstico de 16 preguntas, banco Gold de 573 preguntas elegibles, agotamiento y repaso, exposición y ayudas antes y después de responder, inmutabilidad y corrección, XP y racha, concurrencia en IndexedDB, y reanudación/respaldo.

### Estado General
* **Integridad del motor puro (`lib/learning/engine.ts`):** La lógica de inmutabilidad, cálculo de XP, racha local y cálculo de dominio ponderado responde estrictamente al diseño especificado. Las 25 pruebas unitarias puras (`tests/learning-engine.test.mjs`) pasan al 100%.
* **Integridad del banco Gold573 (`lib/default-catalog.json`):** Los 9 paquetes `.paessed` en `public/default/gold/` coinciden exactamente en sus hashes SHA-256 con el catálogo y la entrega Gold 0.7 (573 preguntas elegibles, 12 históricas excluidas de Aprender).
* **Almacenamiento y Concurrencia (`lib/learning/repository.ts`):** Las transacciones `readwrite` en IndexedDB aíslan lectura, reducción y escritura atómica, impidiendo sobreescrituras entre pestañas y conservando registros corruptos sin reinicio silencioso.
* **Validación cruzada independiente:** Los hallazgos algorítmicos H-01 y H-02 fueron reproducidos y confirmados de forma independiente por el coordinador t1 mediante el script `docs/aprender-redesign/validar-hallazgos.mjs`, persistiendo los resultados empíricos en `docs/aprender-redesign/validacion-auditoria.json`.

---

## 2. Matriz de Hallazgos Priorizados

| ID | Área / Componente | Clasificación | Severidad | Descripción Breve |
|---|---|---|---|---|
| **H-01** | `lib/learning/engine.ts` | Defecto de algoritmo | **Alta** | En refuerzo (R), `axisUnits` no construye grupo de debilidades con umbrales 10/30 antes de rotar; evalúa `countNodes` sobre toda la unidad, provocando que los refuerzos pasen de un subeje al 0% a otros al 100% para igualar cantidad de nodos. |
| **H-02** | `lib/learning/engine.ts` | Defecto de algoritmo | **Media** | En unidades sin stock suficiente (`< 5`), la sustitución rellena parcialmente preguntas de otros subejes (3+2), violando la regla de 5 preguntas del mismo subeje; la sustitución debe ser de nodo completo con `axisId`/`unitId` reales actualizados. |
| **H-03** | `lib/local-backup.ts` | Defecto textual | **Baja** | Mensaje de error de validación de manifiesto desactualizado (`versión 1` en vez de `versión 1 o 2`). |
| **H-04** | `components/learning-overview.tsx` | Discrepancia UI | **Media** | Barra de progreso de dominio en Inicio ignora la escala semántica de colores de `masteryPresentation` y usa clase binaria. |
| **H-05** | `lib/learning/exam-repository.ts` | Higiene de código | **Informativo** | Cadena en `BroadcastChannel("paessed-learning")` emite `"changed"` en vez de `"updated"`; no causa fallo funcional porque el receptor ignora el payload. |
| **H-06** | `components/learning/learn-experience.tsx` | Optimización UX | **Informativo** | Navegación a `/diagnostico` usa recarga dura (`window.location.assign`); funciona correctamente, pero una navegación SPA con Next Router sería más fluida. |
| **H-07** | `tests/learning-simulation.mjs` | Defecto de arnés | **Baja** | El script de simulación escribe automáticamente en `docs/learning-simulation.md`, ensuciando Git en auditorías de solo lectura. |
| **H-08** | `lib/learning/exam-repository.ts` | Decisión de Producto | **Informativo** | Validación de sesiones de ensayo restringe estrictamente números de pregunta al rango 1..65 mediante expresión regular. |
| **H-09** | Entorno Playwright | Limitación de Entorno | **Informativo** | Perfil Windows `AGY2` carece de binarios de Chromium en `ms-playwright`, impidiendo ejecución de pruebas de navegador sin elevación. |

---

## 3. Detalle de Hallazgos

### H-01: Falta de agrupamiento por debilidad (10/30) en subejes antes de rotar en Refuerzo (R)
* **Archivo / Línea:** [lib/learning/engine.ts](file:///C:/Users/Administrator/paessed-aprender/lib/learning/engine.ts#L106-L113)
* **Clasificación:** Defecto de algoritmo (Selección de debilidades en subejes).
* **Impacto:** Alto en la adaptabilidad pedagógica del modo Refuerzo.
* **Descripción:**
  En la función `selectTarget`, cuando el nodo a planificar es de tipo refuerzo (`type === "R"`) y los ejes ya están calibrados (`exploration === false`), el código selecciona el eje débil construyendo adecuadamente un grupo filtrado con umbrales 10/30 (líneas 94-98).  
  Sin embargo, a nivel de **subejes** dentro de ese eje (`axisUnits`), el algoritmo **no construye ningún grupo de debilidades** previo. Aplica directamente un comparador global sobre todas las unidades del eje:
  ```typescript
  axisUnits.sort((a, b) => {
    if (type === "R") {
      if ((a.count === 0) !== (b.count === 0)) return a.count === 0 ? -1 : 1;
      if (exploration && a.count !== b.count) return a.count - b.count;
    }
    return countNodes(prior, undefined, a.unitId, type) - countNodes(prior, undefined, b.unitId, type) || (type === "R" ? (a.percent ?? 0) - (b.percent ?? 0) : 0) || units.findIndex(u => u.id === a.unitId) - units.findIndex(u => u.id === b.unitId);
  });
  ```
  Al anteponer `countNodes` sobre toda la lista de subejes, la rotación equitativa abarca obligatoriamente a todos los subejes del eje. El porcentaje (`percent`) solo desempata si dos subejes tienen exactamente la misma cantidad de nodos R.
* **Aclaración técnica sobre la solución:**  
  Invertir ingenuamente el orden (`percent` antes que `countNodes`) provocaría el defecto opuesto: elegiría **siempre y de forma exclusiva el subeje más débil**, perdiendo la alternancia y rotación acordada entre áreas débiles.  
  El defecto preciso radica en que `axisUnits` no aplica la lógica de filtrado 10/30 que sí existe a nivel de ejes.
* **Evidencia independiente confirmada:**  
  La validación cruzada ejecutada en `docs/aprender-redesign/validar-hallazgos.mjs` y documentada en `docs/aprender-redesign/validacion-auditoria.json` confirmó la anomalía en dos bloques sucesivos de Álgebra:
  * **Posición 2:** `expresiones-algebraicas` (dominio: 0%).
  * **Posición 7:** `proporcionalidad` (dominio: 100%).
  * **Posición 13:** `ecuaciones-inecuaciones-primer-grado` (dominio: 100%).
  
  Los refuerzos pasan de un subeje en 0% a otros subejes ya dominados al 100% únicamente para equiparar la cantidad de nodos `countNodes`.
* **Sugerencia técnica:**
  Dentro del eje seleccionado para refuerzo, construir un subconjunto de subejes candidatos débiles con la misma regla 10/30 (si el segundo más débil supera al primero por $\ge 30$ puntos, grupo de 1; de lo contrario, los dos más débiles más los que disten $\le 10$ puntos del mínimo). Luego, aplicar la rotación por `countNodes` **exclusivamente dentro de ese grupo filtrado**, preservando tanto el foco en debilidades como la rotación entre ellas.

---

### H-02: Sustitución parcial híbrida (3+2) viola el contrato de 5 preguntas del mismo subeje
* **Archivo / Línea:** [lib/learning/engine.ts](file:///C:/Users/Administrator/paessed-aprender/lib/learning/engine.ts#L125-L127)
* **Clasificación:** Defecto de algoritmo / Violación de contrato de producto.
* **Impacto:** Medio (Latente: no afecta al banco Gold573 completo donde cada unidad tiene entre 14 y 59 preguntas, pero se manifiesta en catálogos reducidos o unidades agotadas sin repaso).
* **Descripción:**
  El principio rector de Aprender establece: *"Nodos de cinco preguntas de un mismo subeje"*.  
  La función `selectQuestions` maneja la escasez de preguntas en una unidad rellenando las faltantes con preguntas de otras unidades:
  ```typescript
  const sameUnit = sorted(unique.filter(q => q.unitId === unitId));
  const chosen = sameUnit.slice(0, 5);
  if (chosen.length < 5) chosen.push(...sorted(unique.filter(q => q.unitId !== unitId)).slice(0, 5 - chosen.length));
  return { questionIds: chosen.map(q => q.id), substitution: sameUnit.length < 5 };
  ```
  Esto produce un nodo híbrido mientras que en el nodo se mantiene `node.unitId = target.unitId`, exhibiendo una etiqueta curricular que no corresponde a la totalidad de las preguntas.
* **Aclaración técnica sobre la solución:**  
  La solución no consiste en buscar preguntas de otro subeje dentro del mismo eje, ya que el nodo continuaría violando la regla de "5 preguntas del mismo subeje".  
  La sustitución debe realizarse a **nivel de nodo completo**: si la unidad prevista no cuenta con 5 preguntas disponibles, el planificador debe sustituir el nodo íntegro por otra unidad que sí disponga de 5 preguntas completas, actualizando los campos `node.axisId` y `node.unitId` reales para mantener la veracidad curricular del nodo.
* **Evidencia independiente confirmada:**  
  La prueba en `docs/aprender-redesign/validar-hallazgos.mjs` (registrada en `validacion-auditoria.json`) simuló un catálogo con solo 3 preguntas en `numeros-enteros-racionales`. El nodo resultante exhibió:
  * **Rótulo del nodo:** `numeros-enteros-racionales` (Eje Números).
  * **Contenido real de preguntas:**
    1. `numeros-enteros-racionales` (Números)
    2. `numeros-enteros-racionales` (Números)
    3. `numeros-enteros-racionales` (Números)
    4. `semejanza-proporcionalidad-figuras` (Geometría)
    5. `potencias-raices-enesimas` (Números)
  
  Se constató fehacientemente que el nodo mezcla preguntas de Geometría bajo el rótulo de Números Enteros y Racionales al presentarse escasez de stock.
* **Sugerencia técnica:**
  En `planLearning`, validar la disponibilidad de 5 preguntas completas para la unidad seleccionada. Si no se alcanza el stock requerido, seleccionar una unidad alternativa con stock completo y registrar el nodo con su `unitId` y `axisId` reales.

---

### H-03: Mensaje erróneo en validación de versión del manifiesto de respaldo
* **Archivo / Línea:** [lib/local-backup.ts](file:///C:/Users/Administrator/paessed-aprender/lib/local-backup.ts#L209-L211)
* **Clasificación:** Defecto menor / Inconsistencia textual.
* **Impacto:** Bajo.
* **Descripción:**
  La función `validateManifest` acepta versiones 1 y 2: `![1, 2].includes(Number(value.version))`. Sin embargo, el mensaje de error emitido en caso de versión inválida indica: `"El archivo no es un respaldo PAESSED compatible (versión 1)."`.
* **Sugerencia:**
  Actualizar el texto de error a `"El archivo no es un respaldo PAESSED compatible (versión 1 o 2)."`.

---

### H-04: Discrepancia cromática y semántica en la barra de dominio de Inicio vs Aprender
* **Archivo / Línea:** [components/learning-overview.tsx](file:///C:/Users/Administrator/paessed-aprender/components/learning-overview.tsx#L24) vs [components/learning/learn-experience.tsx](file:///C:/Users/Administrator/paessed-aprender/components/learning/learn-experience.tsx#L61-L62)
* **Clasificación:** Discrepancia de interfaz / Decisión de presentación.
* **Impacto:** Medio en claridad para el usuario.
* **Descripción:**
  En `LearnExperience` (ruta Aprender), la barra y porcentaje de cada eje adoptan el color semántico de `masteryPresentation` (rojo para Crítico <40%, naranja para Débil <60%, amarillo para Regular <75%, índigo para Fuerte <85%, verde para Dominado >=85%).  
  En cambio, en `LearningHome` (pantalla de Inicio), el color de la barra está codificado como:
  ```tsx
  className={"h-full rounded-full " + (p?.calibrated ? "bg-[var(--secondary)]" : "bg-slate-400")}
  ```
  Un eje calibrado con 35% de dominio (Crítico) se visualiza azul/índigo en Inicio pero rojo en Aprender.
* **Sugerencia:**
  Importar y aplicar `masteryPresentation` en `LearningHome` para unificar el lenguaje visual durante la fase de rediseño.

---

### H-05: Divergencia de cadena en BroadcastChannel (`"changed"` vs `"updated"`)
* **Archivo / Línea:** [lib/learning/repository.ts](file:///C:/Users/Administrator/paessed-aprender/lib/learning/repository.ts#L86) vs [lib/learning/exam-repository.ts](file:///C:/Users/Administrator/paessed-aprender/lib/learning/exam-repository.ts#L50)
* **Clasificación:** Higiene de código / Estilo (Informativo, no es defecto funcional).
* **Impacto:** Nulo en runtime actual.
* **Descripción:**
  `repository.ts` emite `postMessage("updated")`, mientras que `exam-repository.ts` en `clearLearningState` emite `postMessage("changed")`.  
  **Hecho verificado:** Esto **no constituye un defecto funcional**, dado que el manejador en `repository.ts:91`:
  ```typescript
  channel.onmessage = () => { for (const listener of listeners) { try { listener(); } catch { ... } } };
  ```
  ignora por completo el contenido de `event.data` y dispara la recarga ante cualquier mensaje recibido.
* **Sugerencia:**
  Estandarizar a `"updated"` en todas las emisiones de `BroadcastChannel("paessed-learning")` como buena práctica preventiva ante futuros filtros por tipo de evento.

---

### H-06: Navegación hacia diagnóstico mediante recarga dura (`window.location.assign`)
* **Archivo / Línea:** [components/learning/learn-experience.tsx](file:///C:/Users/Administrator/paessed-aprender/components/learning/learn-experience.tsx#L41)
* **Clasificación:** Optimización de UX / Preferencia de navegación (Informativo, no es defecto funcional).
* **Impacto:** Bajo.
* **Descripción:**
  Al elegir meta en `LearningSetup` y avanzar al diagnóstico, se llama a `window.location.assign("/diagnostico")`.  
  **Hecho verificado:** No es un fallo funcional demostrado; la navegación ocurre con éxito y el progreso se carga de forma correcta desde IndexedDB en la página destino. Sin embargo, produce una recarga completa del documento (hard reload), a diferencia de la navegación interna de Next Router (`router.replace` o `router.push`) utilizada en el resto de la aplicación.
* **Sugerencia:**
  Alinear con `router.push("/diagnostico")` durante el rediseño para mantener la fluidez de Single Page Application.

---

### H-07: Script de simulación realiza escrituras fuera de la ruta autorizada
* **Archivo / Línea:** [tests/learning-simulation.mjs](file:///C:/Users/Administrator/paessed-aprender/tests/learning-simulation.mjs#L50-L51)
* **Clasificación:** Defecto de arnés de pruebas.
* **Impacto:** Bajo en producción, relevante en entornos CI/CD y auditorías restringidas.
* **Descripción:**
  El comando `npm run simulate:learning` ejecuta `writeFile(new URL("../docs/learning-simulation.md", ...), report)`. Si el entorno restringe escrituras a carpetas específicas (como en esta auditoría a `docs/aprender-redesign/`), la ejecución falla y además ensucia el árbol de trabajo de Git con cambios no comiteados.
* **Sugerencia:**
  Soportar flag `--stdout` o respetar una variable de entorno para emitir el reporte sin escribir en disco automáticamente.

---

### H-08: Expresión regular rígida para identificadores de ensayo en `exam-sessions`
* **Archivo / Línea:** [lib/learning/exam-repository.ts](file:///C:/Users/Administrator/paessed-aprender/lib/learning/exam-repository.ts#L15)
* **Clasificación:** Decisión de producto documentada.
* **Impacto:** Informativo / Rigidez arquitectónica.
* **Descripción:**
  La validación `!/^demre:[a-f\d]{64}:([1-9]|[1-5]\d|6[0-5])$/.test(id)` acota los números de pregunta al intervalo 1..65. Esto garantiza fidelidad absoluta para PAES M1, pero impide reutilizar el almacén para ensayos DEMRE de otras disciplinas (ej. Ciencias con 80 preguntas).

---

### H-09: Entorno sin navegador Playwright en perfil AGY2
* **Archivo / Línea:** `tests/learning-repository.test.mjs`, `tests/learning-ui.spec.cjs`
* **Clasificación:** Limitación de infraestructura / entorno.
* **Impacto:** Impide correr localmente la suite E2E de Playwright desde cuentas no administradoras sin aprovisionamiento de browser.
* **Descripción:**
  Playwright busca ejecutables en `C:\Users\AGY2\AppData\Local\ms-playwright`. Los navegadores instalados residen en el perfil `Administrator`. Se coordinó con t1 priorizar auditoría estática y verificación pura.

---

## 4. Auditoría Sistemática de los 12 Puntos Requeridos

### 1. Proporción 4:3 estable
* **Implementación:** `lib/learning/engine.ts` (`nodeTypes`, líneas 59-80).
* **Mecanismo:** Generación determinista por bloques de 7 nodos, exactamente 4 M (mantenimiento) y 3 R (refuerzo).
* **Control de triples:** Comprobación estricta del tail histórico (`[...result.slice(-2), ...path]`) que prohíbe secuencias de 3 nodos idénticos ("MMM" o "RRR") tanto intra-bloque como entre bloques consecutivos.
* **Verificación:** Ejecución de 20 semillas por 35 bloques (700 nodos): cero violaciones de proporción y cero secuencias triples.
* **Dictamen:** **CONFORME.**

### 2. Rotaciones M/R
* **Implementación:** `lib/learning/engine.ts` (`selectTarget`, líneas 84-114).
* **Comportamiento M:** Rotación equitativa verificada entre los 4 ejes y entre los subejes de cada eje (`countNodes` diferencia máxima <= 1).
* **Comportamiento R:** Alternancia entre ejes débiles mediante exclusión de `lastR`.
* **Discrepancia detectada:** Véase **H-01**. Falta de filtrado 10/30 a nivel de subejes antes de rotar entre ellos, confirmado en `validacion-auditoria.json`.
* **Dictamen:** **CON OBSERVACIÓN (H-01).**

### 3. Calibración 15 por eje
* **Implementación:** `lib/learning/engine.ts` (línea 55).
* **Cálculo:** `calibrated = count >= 15`, considerando únicamente respuestas originales elegibles y no asistidas (`state.attempts.filter(a => a.eligible && !a.assisted)`).
* **Transición de fase:** Durante la fase exploratoria (`exploration === true`), R prioriza los ejes con menor conteo de intentos para nivelar la muestra. Al alcanzar los cuatro ejes 15 intentos, la fase cambia automáticamente a refuerzo de debilidades (umbrales 10/30).
* **Dictamen:** **CONFORME.**

### 4. Dominio ponderado sin decaimiento calendario
* **Implementación:** `lib/learning/engine.ts` (`getProfile`, líneas 39-57).
* **Ponderación:** Fórmula exponencial $0.95^{(\text{respuestas posteriores}/5)}$. El exponente depende exclusivamente del orden y cantidad de respuestas posteriores en ese subeje.
* **Inactividad:** El paso del tiempo (semanas, meses) no reduce el peso ni degrada el porcentaje de dominio (verificado con salto de 90 días en pruebas unitarias).
* **Media de eje:** El porcentaje del eje se calcula como el promedio no ponderado de los subejes observados (`observed.length`), coherente con la especificación.
* **Dictamen:** **CONFORME.**

### 5. Diagnóstico de 16 preguntas
* **Implementación:** `lib/learning/engine.ts` (líneas 193-208) y `components/learning/diagnostic.tsx`.
* **Estructura:** Exactamente 16 preguntas, 1 por cada subeje del temario M1.
* **Reglas:** Respuestas inmutables; sin retroalimentación de acierto/error durante la prueba; prohibición total de ayudas (`assisted`).
* **Bloqueo de avance:** No se autoriza iniciar nodos de aprendizaje regulares si el diagnóstico se inició pero no está completado (`complete-diagnostic`).
* **Puntaje basal:** Los 16 intentos se registran en `state.attempts` con `mode: "diagnostic"`, otorgando la línea base para la calibración inicial sin otorgar XP.
* **Dictamen:** **CONFORME.**

### 6. Banco Gold573
* **Implementación:** `lib/default-catalog.json`, `lib/learning/catalog.ts`, `scripts/prepare-gold.py`.
* **Verificación de archivos:** 9 ensayos PAES/PDT (2021 a 2027), 585 preguntas totales.
* **Elegibilidad:** 573 preguntas cumplen `en_temario == "si"` y clave verificada (`status == "verified"`). Las 12 preguntas restantes quedan fuera de Aprender y se reservan para ensayos completos.
* **Criptografía:** Los 9 paquetes `.paessed` en `public/default/gold/` fueron verificados contra sus hashes SHA-256 en `ENTREGA_SHA256.json`.
* **Identidad canónica:** `demre:${sourceSha256}:${number}`, invariante ante reexportación de paquetes.
* **Dictamen:** **CONFORME.**

### 7. Agotamiento y repaso
* **Implementación:** `lib/learning/engine.ts` (`selectQuestions`, líneas 115-128).
* **Prioridad:** 1) Preguntas no reservadas en el buffer de 7 nodos, 2) Preguntas nunca vistas, 3) Repaso LRU (preguntas vistas hace más tiempo), 4) Desempate pseudoaleatorio por semilla.
* **Neutralización de progreso:** Al responder una pregunta repetida, se registra con `eligible: false`. No suma calibración, no incrementa dominio y no otorga XP. La racha diaria se conserva.
* **Discrepancia en sustitución sin stock:** Véase **H-02**. Sustitución híbrida 3+2 confirmada en `validacion-auditoria.json` en vez de sustitución de nodo completo.
* **Dictamen:** **CON OBSERVACIÓN (H-02).**

### 8. Exposición y ayudas antes y después de responder
* **Implementación:** `lib/learning/engine.ts` (`expose` y `record`), `lib/learning/repository.ts` (línea 146).
* **Ayuda previa:** Si el estudiante consulta la solución o recibe ayuda antes de responder, el intento se marca con `assisted: true` y `eligible: false`.
* **Ayuda posterior:** Si el estudiante responde de forma independiente y posteriormente revisa la solución (durante corrección o revisión de ensayo), el intento original conserva `eligible: true`. La revisión posterior no reescribe la evidencia histórica.
* **Fusión de respaldos:** La función `mergeStates` compara los sellos temporales `(e.assistedAt ?? e.at) < a.at` para preservar la cronología de asistencia.
* **Dictamen:** **CONFORME.**

### 9. Inmutabilidad y corrección
* **Implementación:** `lib/learning/engine.ts` (líneas 219-244).
* **Primeras respuestas:** Inmutables. La llamada repetida de `action: "answer"` sobre una pregunta respondida es idempotente y no altera el valor registrado.
* **Fase de corrección:**
  - Si el nodo obtiene 5/5, finaliza de inmediato.
  - Si hay errores, el nodo pasa a `state: "correction"`.
  - El resultado original (`originalCorrect`, ej. 3/5) se congela y no se modifica por las correcciones.
  - La acción `"review"` (ver solución) está bloqueada hasta acumular 2 intentos fallidos (`correction.tries >= 2`).
  - Completar el nodo exige resolver todos los errores (por nuevo intento acertado o por revisión de solución tras 2 fallos).
* **Dictamen:** **CONFORME.**

### 10. XP y racha
* **Implementación:** `lib/learning/engine.ts` (`getLearningStats`, líneas 249-255).
* **XP:** Se otorgan 5 XP por cada primera respuesta elegible y no asistida al completar un nodo (máximo 25 XP por nodo). Las preguntas de repaso otorgan 0 XP.
* **Racha:** Basada en días calendario locales del estudiante (`localDate`), contemplando cambios de horario DST al evaluar fechas a mediodía (`12:00`).
* **Tolerancia intradía:** Si no se ha completado un nodo en el día actual, se conserva la racha del día anterior. Omitir un día completo reinicia la racha a 0 sin afectar el dominio acumulado.
* **Meta diaria:** Opciones de 1, 2 o 3 nodos. Los cambios entran en vigencia al día siguiente (`pendingGoal.effectiveDate = nextDay(at)`). Completar la meta no restringe la práctica adicional.
* **Dictamen:** **CONFORME.**

### 11. IndexedDB concurrente
* **Implementación:** `lib/learning/repository.ts` (base `paessed-learning`, almacén `state`).
* **Aislamiento:** La operación de lectura (`get`), validación, ejecución del reducer puro y persistencia (`put`) se ejecutan dentro de una misma transacción `readwrite` exclusiva de IndexedDB.
* **Sincronización:** Al completarse la transacción, se emite notificación vía `BroadcastChannel` para que las demás pestañas actualicen su estado en memoria.
* **Protección contra corrupción:** Los datos entrantes pasan por `validateLearningState`. Si la estructura está dañada, la transacción se aborta (`tx.abort()`) y los datos defectuosos no se sobrescriben con un estado vacío por defecto.
* **Dictamen:** **CONFORME.**

### 12. Reanudación y respaldo
* **Implementación:** `lib/local-backup.ts`, `lib/learning/repository.ts`, `lib/learning/exam-repository.ts`.
* **Formato:** Manifiesto versión 2 compatible con respaldos versión 1.
* **Adopción de identidad:** Un navegador sin actividad previa adopta el `learnerId` del respaldo. Un navegador con actividad previa de otro estudiante rechaza la restauración con error explícito.
* **Fusión de datos (`mergeStates`):** Conserva respuestas originales; si hay conflicto entre respuestas del mismo intento, se aborta la restauración. Prioriza el estado más avanzado de los nodos (`completed > correction > active > future`).
* **Dictamen:** **CONFORME.**

---

## 5. Recomendaciones para el Coordinador y Rediseño

1. **Prioridad Inmediata (Algoritmo de Refuerzo):** Implementar la construcción del grupo de subejes candidatos débiles con umbrales 10/30 en `lib/learning/engine.ts:106` antes de rotar por `countNodes` (Hallazgo **H-01**). Esto resolverá la rotación indiscriminada confirmada en `validacion-auditoria.json` sin caer en el extremo de concentrar el 100% de los refuerzos en un único subeje.
2. **Prioridad Media (Sustitución Curricular Coherente):** Modificar la lógica de sustitución para unidades con `< 5` preguntas en `lib/learning/engine.ts:125` hacia una sustitución de nodo completo con sus metadatos curriculares actualizados (Hallazgo **H-02**), evitando la mezcla de disciplinas constatada en `validacion-auditoria.json` y preservando la regla de 5 preguntas del mismo subeje por nodo.
3. **Consistencia Visual:** Durante la implementación del rediseño aprobado por el usuario, sustituir la barra binaria de Inicio (`learning-overview.tsx`) por los colores semánticos de `masteryPresentation` (Hallazgo **H-04**).
4. **Higiene y Limpieza Menor:** Actualizar texto de versión en `lib/local-backup.ts:210` (Hallazgo **H-03**) y unificar a `"updated"` en `exam-repository.ts:50` (Hallazgo **H-05**).
5. **Preservación Estricta de UI y Código:** Se confirma que ningún archivo existente de la aplicación fue modificado durante esta auditoría, manteniéndose el árbol en perfecto estado para la aprobación visual del usuario.
