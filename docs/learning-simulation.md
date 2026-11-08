# Aprender: simulación reproducible

Comando: `node --experimental-strip-types tests/learning-simulation.mjs`. Semilla 42; catálogo real de 573 preguntas elegibles; inicio 1 de marzo de 2026, un estudiante independiente por fila.

Hipótesis de simulación: práctica diaria sin diagnóstico; probabilidad sintética inicial de acierto por eje 40/50/60/70 %, con incremento de 0,2 puntos diarios y tope 90 %. Las correcciones se resuelven al primer reintento y no cambian la respuesta original ni el dominio. Son escenarios de verificación del motor, no predicciones pedagógicas ni una validación empírica de su eficacia.

| Días | Meta | Nodos completados | XP | Evidencias únicas | Intentos repetidos | Día 4 ejes calibrados | Dominio N / A / G / D (%) | R exploración / total |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 30 | 1 | 30 | 750 | 150 | 0 | 13 | 38.3 / 60.2 / 59.8 / 79.6 | 5/12 |
| 30 | 2 | 60 | 1495 | 299 | 1 | 7 | 43.0 / 57.2 / 65.3 / 72.2 | 5/26 |
| 30 | 3 | 90 | 2205 | 441 | 9 | 5 | 42.8 / 54.5 / 68.1 / 76.3 | 5/38 |
| 60 | 1 | 60 | 1470 | 294 | 6 | 13 | 46.8 / 60.1 / 62.2 / 79.7 | 5/26 |
| 60 | 2 | 120 | 2515 | 503 | 97 | 7 | 46.0 / 58.2 / 66.2 / 74.7 | 5/52 |
| 60 | 3 | 180 | 2785 | 557 | 343 | 5 | 42.6 / 56.9 / 70.2 / 78.0 | 5/77 |
| 90 | 1 | 90 | 2185 | 437 | 13 | 13 | 51.5 / 59.5 / 66.0 / 79.7 | 5/38 |
| 90 | 2 | 180 | 2785 | 557 | 343 | 7 | 46.0 / 59.4 / 66.9 / 76.8 | 5/77 |
| 90 | 3 | 270 | 2865 | 573 | 777 | 5 | 42.6 / 56.9 / 70.8 / 78.8 | 5/116 |

En las nueve ejecuciones se verificó: cantidad exacta de nodos y racha; siete próximos/actuales; ausencia de evidencia duplicada; XP igual a cinco por primera respuesta elegible en nodos completados. Al agotarse preguntas nuevas se conserva la práctica y la racha, y las repeticiones dejan de sumar dominio o XP. Los nodos M siguen una rotación equitativa; R cambia de exploración a debilidades cuando cada eje reúne 15 respuestas válidas.

Las pruebas adicionales cubren saltos de día sin decaimiento por calendario, cambios de meta efectivos al día siguiente, límites 30/10 puntos de grupos débiles, puntaje original 3/5 inmutable, dos fallos antes de revisar una solución, restauración y concurrencia real de IndexedDB entre pestañas.
