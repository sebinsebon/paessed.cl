# Rendimiento de Inicio · Fase 1

Referencia: Auditoria-rendimiento-MVP-2026-11-21.md. Base de comparación: `ce0dc58` de `main`.

Inicio muestra el saludo neutro y las acciones de Aprender, Ensayos y Playground en cuanto el layout entrega el ámbito de almacenamiento preparado. El nombre llega con el perfil y se muestra solo si coincide con el propietario activo. Si la lectura de perfil identifica otro ámbito, Inicio oculta los datos personales hasta que el layout resuelve la identidad. Las transiciones de ámbito siguen desmontando los datos del propietario anterior.

Dominio, respuestas registradas y resultados de ensayos tienen esperas independientes. El recordatorio de diagnóstico aparece cuando están disponibles el borrador y el estado de aprendizaje que lo determinan. Aprender reutiliza la proyección calculada por Inicio en las dos vistas responsivas. Las consultas, las reglas de diagnóstico, la barrera de sincronización inicial y los formatos persistidos siguen su flujo existente.

## Reproducción

Compilar la revisión base y esta rama por separado con las dependencias del lockfile. Ejecutar ambos servidores con `next start`, `APP_ENV=local`, `PAESSED_DEV_MODE=true` y el `APP_ORIGIN` local correspondiente. Ejecutar desde esta rama:

```powershell
node scripts/measure-inicio-navigation.cjs http://127.0.0.1:3248 http://127.0.0.1:3250
```

El script comprueba el origen local antes de habilitar el fixture, usa una cuenta ficticia con progreso vacío y simula sesión y sincronización sin tráfico al backend real. Chromium abre contextos nuevos por escenario y descarta el primer recorrido de cada contexto. Se registran 30 regresos calientes por versión y escenario. El p95 usa el rango más cercano. El primer contenido útil se mide en el primer frame del navegador con saludo visible y el enlace «Hacer un ensayo» disponible en el contenido de Inicio. La opción de 390 px cambia el viewport de la misma máquina.

## Resultados de Ensayos → Inicio

Todos los tiempos se expresan como p50 / p95 en milisegundos.

| Escenario | URL en main | URL con fase 1 | Contenido útil en main | Contenido útil con fase 1 | Saludo personalizado en main | Saludo personalizado con fase 1 |
|---|---:|---:|---:|---:|---:|---:|
| 1440 px, sesión +450 ms | 42,5 / 85 | 43 / 49 | 514 / 554 | **60 / 70** | 514 / 554 | 515 / 535 |
| 390 px, sesión +450 ms | 44,5 / 58 | 44 / 55 | 514 / 524 | **57,5 / 67** | 514 / 524 | 519 / 533 |
| 1440 px, sin demora añadida | 44,5 / 56 | 44 / 70 | 71 / 79 | 58 / 90 | 71 / 79 | 77,5 / 108 |

Con 450 ms simulados, el p95 de contenido útil bajó 484 ms en escritorio y 457 ms a 390 px. Cumplió el objetivo de 150 ms en ambos viewports. La mediana de contenido útil en escritorio se movió 2 ms al añadir 450 ms a sesión. La personalización conserva su dependencia del perfil.

Con API inmediata, la mediana de contenido útil mejoró 13 ms y se observó un p95 11 ms mayor. El p95 del saludo personalizado subió 29 ms en ese escenario. Son diferencias de la serie local de 30 muestras y no se midieron en tráfico real. La entrada fría sigue pagando la preparación de identidad y sincronización. El diagnóstico y el saludo personalizado pueden ajustar su propio espacio cuando llegan los datos.

## Validación y reversión

Las pruebas de navegador retienen por separado la verificación inicial, la lectura del perfil y las transacciones locales. Comprueban las acciones utilizables, la ausencia de respuestas registradas o resultados ficticios durante la espera y la llegada normal del contenido tras liberar las lecturas. Las pruebas de cambio de cuenta cubren un perfil cuyo propietario no coincide y una respuesta tardía de la cuenta anterior.

La compilación optimizada pasó. Las suites `test:base`, `test:onboarding` y `test:backend` pasaron 108 pruebas. En Chromium, `test:inicio-ui`, `test:accounts-ui` y `test:learning-integration` pasaron 43 pruebas con almacenamiento local y cuentas de prueba.

Para revertir, aplicar un revert al commit de esta fase. La reversión afecta la presentación y sus pruebas, sin pasos de restauración de datos.
