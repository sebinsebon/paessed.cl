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

## Corrección de aislamiento del PR #16

La revisión reprodujo una ventana de exposición en la primera versión del PR. Después de un cambio de cuenta en otra pestaña, la navegación Ensayos → Inicio podía mostrar el historial del propietario anterior mientras esperaba la respuesta de sesión de la cuenta nueva.

El cliente distingue ahora una sesión en comprobación, una sesión verificada y una sesión no disponible. El identificador conservado en el navegador avisa de cambios; la respuesta de sesión confirma el propietario. Mientras se comprueba, Inicio conserva el saludo neutro y sus enlaces generales. Los demás contenidos privados esperan en el layout y el diagnóstico público aplica la misma comprobación a sus borradores y resultados. Un cambio de cuenta, cierre de sesión, expiración o discrepancia confirmada invalida la presentación y descarta las respuestas de la verificación anterior, incluso si se vuelve al mismo identificador en un cambio A → B → A.

La revisión cubrió aprendizaje, dominio, historial Default, diagnóstico y su incorporación, sesiones y guardados de Playground, datos de perfil, el contador del ensayo activo del sidebar, conflictos y descargas de respaldos. Las transacciones de sincronización conservan su propietario y las API siguen validando identidad y pertenencia. El guardado por cuenta sigue usando los mismos almacenes de IndexedDB. Los resultados nuevos del ensayo demo quedan bajo su ámbito de almacenamiento. Los datos del prototipo sin propietario verificable, incluido el resultado anterior, permanecen en disco y se omiten de la vista y de las exportaciones automáticas.

Pruebas incorporadas en `tests/account-isolation.spec.cjs`. El cambio entre pestañas usa el evento de almacenamiento real de Chromium, mantiene en espera la respuesta de la cuenta nueva y comprueba la ausencia del historial anterior durante las mutaciones del DOM. También se cubren las respuestas tardías, las recargas, 401/503, y la separación de los resultados locales del ensayo demo.

### Medición tras la corrección

Mismo benchmark y 30 regresos calientes por versión y escenario. Tiempos p50 / p95 en milisegundos desde el clic. La acción general medida es «Hacer un ensayo».

| Escenario | Contenido seguro en main | Contenido seguro corregido | Saludo personalizado en main | Saludo personalizado corregido |
|---|---:|---:|---:|---:|
| 1440 px, sesión +450 ms | 539,5 / 579 | **74 / 86** | 539,5 / 579 | 546 / 566 |
| 390 px, sesión +450 ms | 552,5 / 572 | **80 / 92** | 552,5 / 572 | 547 / 559 |
| 1440 px, sin demora añadida | 106,5 / 391 | 74 / 91 | 106,5 / 391 | 96 / 142 |

El contenido general alcanzó el objetivo de p95 ≤150 ms en ambos escenarios con demora. Ante un error de identidad se conserva la navegación general y se ofrece reintentar o volver a iniciar sesión. Para una recarga sin verificación válida, los datos guardados esperan en su ámbito sin mostrarse. Las pruebas usan cuentas ficticias y backend local o interceptado.

También se ejecutaron las suites históricas de navegador. Algunas intentaban abrir rutas privadas sin una sesión local. Se repitieron en una copia con el fixture de acceso local para comparar la misma prueba contra `main`. Asistencia IA, énfasis, Ensayos local y varias pruebas de la hoja universal y del renderer presentan fallos en la base. Las suites afectadas conservan sus expectativas y sus capturas. La verificación de Google y Supabase reales queda fuera de esta ejecución local.
