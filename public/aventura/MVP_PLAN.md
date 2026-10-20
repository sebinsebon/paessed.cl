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

- Cuatro ejes M1, 16 unidades temáticas representadas en 17 microlecciones (racionales está dividido en enteros y fracciones); 102 preguntas originales de demostración, no oficiales ni GOLD.
- 12 preguntas diagnósticas opcionales, tres por eje, 5 preguntas por lección.
- Ruta visual adaptativa sin bloqueo obligatorio de contenidos; la aprobación de una microlección requiere al menos 60 %.
- XP (15 base en lección + 2 por acierto + 5 por perfecta + 10 por primera aprobación; diagnóstico 10 base, repaso 8 base, práctica libre 10 base).
- Corazones 0–5 con reposición tras sesión; nunca penalizan con bloqueo.
- Racha por fecha de sesión completada.
- Métrica dominio `redondear(100 × aciertos/intentos × min(1,intentos/7))`.
- Repetición espaciada: 1 día tras primer acierto, 3 tras segundo y crecimiento ~×2,2 limitado a 60 días; los errores pasan a repaso inmediato.
- Repaso por prioridad: errores, vencidos y habilidad más débil si no hay deuda.
- Misiones diarias, vista previa local de ligas con desafíos clasificatorios de 10 preguntas (hasta 100 puntos diarios), transición semanal, métricas, exportación y borrado. No existe aún tabla de rivales compartida.

## Reglas de integridad

- La respuesta se registra una sola vez; no hay doble puntuación si se pulsa repetidamente.
- XP, liga y rachas avanzan solamente al cerrar una actividad completada.
- Una lección figura como completada solo cuando obtiene ≥3/5 aciertos; no bloquea otras unidades.
- Al recargar, la sesión y las respuestas previas deben continuar intactas.
- Solo la primera aprobación de una habilidad activa el bono de desbloqueo.
- Las lecciones aprobadas siguen disponibles para repetir.
- El usuario puede exportar o borrar todos sus datos locales.

## Pruebas y criterios de aceptación

- Diagnóstico completa doce preguntas distribuidas entre los cuatro ejes y modifica estadísticas sin aprobar artificialmente el camino.
- Una lección aprobada registra exactamente su habilidad; las demás unidades siguen accesibles.
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
6. Sustituir la vista previa de ligas individual por grupos reales de 20 estudiantes con ascensos 1.º–5.º, permanencia 6.º–15.º y descensos 16.º–20.º, usando cuentas, backend transaccional, puntuación autoritativa y medidas antifraude; no simular o inventar rivales.
7. Instrumentar métricas de producto: retención D1/D7, lecciones finalizadas, error recurrente, tiempo por ítem y mejora posterior al repaso.

## Fuentes de producto

- Duolingo blog: How to Use Duolingo for Language Learning (blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/)
- Duolingo blog: The Science Behind Duolingo's Home Screen Redesign (blog.duolingo.com/new-duolingo-home-screen-design/)
- Temario PAES Matemática M1, cuatro ejes (DEMRE; ver temario vigente para aplicación específica antes de escalar el banco).
## Estado específico de Ranked

El desafío local elige diez preguntas de demostración de los cuatro ejes, ofrece un único resultado por fecha y calcula 10 puntos por respuesta acertada (máximo 100 diarios, 700 semanales). La liga individual cambia al inicio de la siguiente semana: asciende al llegar a 500 puntos y desciende por debajo de 150, con límites en Bronce y Diamante. Estos umbrales **no son el ranking social definitivo**: al integrar identidades y servidor, la posición real en el grupo sustituirá los umbrales personales.

`/app/aprender` redirige al prototipo funcional `/aventura` para evitar el anterior recorrido estático desconectado. La persistencia es `localStorage` y **no sincroniza dispositivos**. No publicar el banco de muestra como si estuviera validado por DEMRE ni considerarlo contenido GOLD.

## Pruebas

Ejecutar `npm run test:aventura`; el build también exige esta suite. Cubre el diagnóstico de 12 preguntas, 102 preguntas de demostración, acceso a todas las unidades, preguntas repetidas, reanudación, repasos y desafío diario, incluida la transición semanal.
