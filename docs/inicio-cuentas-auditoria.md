# Auditoría de Inicio, cuentas y sincronización

| Pantalla | Reproducción | Antes | Criterio de verificación |
| --- | --- | --- | --- |
| Bienvenida | Entrar a una cuenta vacía con 16 respuestas de invitado e interrumpir el guardado | La pregunta de incorporación seguía visible junto al error | Solo queda el estado pendiente. Reintentar abre el resultado y crea un recibo y 16 respuestas. |
| API de progreso | Hacer el primer pull o guardar el diagnóstico con el controlador de producción | El preview devolvía HTTP 503. Postgres.js convertía el JSON serializado en una cadena y PostgreSQL rechazaba `learning_states_state_check` con `23514`. | La prueba TCP reproduce la escritura con Postgres.js, repite la solicitud y recupera el diagnóstico y una pregunta guardada con un cursor nuevo. |
| Inicio | Entrar en una cuenta vacía y salir tras la primera respuesta | Un diálogo bloqueaba el panel. El diagnóstico autenticado se escribía en el espacio de invitado. | La acción está dentro de Inicio. Conserva la respuesta y abre la segunda pregunta. Otra cuenta y el invitado tienen borradores independientes. |
| Inicio | Abrir el panel antes de rendir un ensayo | Aparecían puntajes ficticios como resultados personales y el botón de práctica del eje solo emitía un aviso. | Las respuestas y los ensayos del catálogo provienen de la cuenta. El detalle indica la calibración y ofrece un enlace a Playground. |
| Preguntas | Intentar confirmar una respuesta en modo DEV | El panel flotante interceptaba el clic. | El botón de confirmar queda disponible en el área de preguntas. |
| PostgreSQL | Comparar el historial de `paessed-dev` con la definición y los permisos efectivos | Quedó registrada la migración `20261114214805`. Ya existía `session_is_valid`, y el rol tenía un permiso de lectura de `auth.sessions` que el esquema bloqueaba. | Las migraciones incluyen la entrada histórica. En las pruebas desde una base vacía y desde el estado anterior, el rol valida sesiones mediante la función y recibe `42501` al leer la tabla. |

## Comprobación del candidato

Las pruebas de navegador locales usan cuentas DEV o respuestas simuladas cuando ejercitan contratos de autenticación. La prueba TCP usa el controlador Postgres.js de la aplicación y PGlite como PostgreSQL local con el esquema mínimo de Auth.

Para ejecutar las suites locales de navegador, iniciar la aplicación con `PAESSED_DEV_MODE=true` y `APP_ORIGIN=http://127.0.0.1:3210`, y usar ese mismo origen en `PAESSED_BASE_URL`. Ejecutar `npm run test:inicio-ui`, `npm run test:accounts-ui`, `npm run test:learning-ui` y `npm run test:learning-integration`.

El cierre del preview requiere Google y correo reales, terminar el diagnóstico con una interrupción de red, verificar en otra sesión el diagnóstico y una pregunta guardada, y cambiar de cuenta en el mismo navegador. La publicación requiere la aprobación del commit validado.

## Preparación de producción

Vercel construye producción desde `main`. Antes de publicar, establecer las variables propias de producción, comprobar los callbacks en el dominio de producción y verificar que el Supabase productivo pueda recuperarse de un respaldo. Al iniciar la auditoría, Vercel enumeró las variables de Auth y datos exclusivamente para el preview de `feat/inicio-cuentas`. La referencia de recuperación del sitio estable es el despliegue `dpl_9Su63yTVrBLqtFqFYFoytHv8Guns` del commit `0cd23a0`.
