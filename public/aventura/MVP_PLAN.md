# Plan de producto · PAESSED Modo Aventura

## Objetivo del primer MVP

Validar el ciclo de estudio diario: diagnóstico -> recomendación -> microlección -> feedback -> avance -> repaso -> retorno. La experiencia debe funcionar en cualquier navegador moderno y evitar dependencias de pago.

## Principios de producto

1. **Una decisión menos:** la portada recomienda automáticamente la próxima lección.
2. **Sesiones breves:** 5 ejercicios por lección; se puede reanudar una sesión interrumpida.
3. **Feedback útil:** cada respuesta revela una explicación matemática, no solo un acierto/error.
4. **Errores como señal:** toda respuesta incorrecta se registra y vuelve al circuito de repaso.
5. **Retención en el tiempo:** respuestas correctas programan repasos espaciados.
6. **Motivación separada de dominio:** XP recompensa constancia; dominio depende de desempeño.
7. **Accesibilidad por defecto:** no bloquear el acceso al aprendizaje por corazones.
8. **Transparencia:** sin rivales, ligas sociales ni resultados supuestamente reales si no existen.

## Alcance del MVP implementado

- Cuatro ejes M1 y ocho habilidades; 48 preguntas originales (seis por habilidad).
- 8 preguntas diagnósticas opcionales, 5 preguntas por lección.
- Camino con desbloqueo por aprobación (60%).
- XP (15 base en lección + 2 por acierto + 5 por perfecta + 10 por primera aprobación; diagnóstico 10 base, repaso 8 base, práctica libre 10 base).
- Corazones 0–5 con reposición tras sesión; nunca penalizan con bloqueo.
- Racha por fecha de sesión completada.
- Métrica dominio `redondear(100 × aciertos/intentos × min(1,intentos/7))`.
- Repetición espaciada: 1 día tras primer acierto, 3 tras segundo y crecimiento ~×2,2 limitado a 60 días; los errores pasan a repaso inmediato.
- Repaso por prioridad: errores, vencidos y habilidad más débil si no hay deuda.
- Misiones diarias, liga personal semanal, métricas, exportación y borrado.

## Reglas de integridad

- La respuesta se registra una sola vez; no hay doble puntuación si se pulsa repetidamente.
- XP, liga y rachas avanzan solamente al cerrar una actividad completada.
- El avance de camino solo se registra cuando la lección tiene ≥3/5 correctas.
- Al recargar, la sesión y las respuestas previas deben continuar intactas.
- Solo la primera aprobación de una habilidad activa el bono de desbloqueo.
- Las lecciones aprobadas siguen disponibles para repetir.
- El usuario puede exportar o borrar todos sus datos locales.

## Pruebas y criterios de aceptación

- Diagnóstico completa ocho preguntas y modifica estadísticas sin desbloquear artificialmente el camino.
- Una lección completa desbloquea exactamente la habilidad correcta.
- Pulsar «Comprobar» dos veces no duplica resultados.
- Cerrar/reabrir y actualizar mantienen respuestas y avances.
- Errores aparecen en repaso y los repasos correctos actualizan su programación.
- XP no se acredita antes de terminar la sesión.
- La racha aumenta como máximo una vez por día.
- El modo móvil no depende de hover para operar.

## Siguiente fase (no implementada en el MVP)

1. Conectar con banco de preguntas validado e importador PAESSED (`.paessed` / JSON + assets).
2. Diferenciar diagnóstico formativo de evaluación calibrada y estimación de puntaje con datos de calibración.
3. Expandir el currículo con subhabilidades, prerrequisitos y ejercicios de dificultad auténtica PAES.
4. Sustituir la heurística de dominio por modelo por concepto y métricas de retención estables.
5. Incorporar autenticación y sincronización con políticas de privacidad claras.
6. Introducir ligas reales únicamente con backend, identidades y medidas antifraude.
7. Instrumentar métricas de producto: retención D1/D7, lecciones finalizadas, error recurrente, tiempo por ítem y mejora posterior al repaso.

## Fuentes de producto

- Duolingo blog: How to Use Duolingo for Language Learning (blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/)
- Duolingo blog: The Science Behind Duolingo's Home Screen Redesign (blog.duolingo.com/new-duolingo-home-screen-design/)
- Temario PAES Matemática M1, cuatro ejes (DEMRE; ver temario vigente para aplicación específica antes de escalar el banco).