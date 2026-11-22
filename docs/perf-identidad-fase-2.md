# Fase 2 de rendimiento · Identidad y sesiones

Referencia de la auditoría del 21 de noviembre de 2026. Base comparativa `7477d00` de `main`, con la fase 1 integrada.

## Identidad compartida

Inicio, Perfil y el resultado del diagnóstico leen el perfil de la misma respuesta de sesión que verifica la identidad. El cliente comparte el GET en curso y mantiene la respuesta confirmada en memoria por documento, propietario y `epoch`. La portada también usa esa verificación y puede cargar su perfil sin iniciar la sincronización. La entrada a un layout privado nuevo vuelve a verificar la sesión y conserva la espera de la sincronización inicial.

El límite local de revalidación es de cinco minutos con una cuenta abierta y la pestaña visible. También se revalida al volver a la pestaña, recuperar la conexión, restaurar un documento del historial o guardar el perfil. Una respuesta iniciada antes del guardado puede contener un nombre anterior y se descarta. La cancelación de cada solicitud se mantiene activa mientras llega el cuerpo de la respuesta.

El perfil de presentación se limpia mientras la identidad está en comprobación o no está disponible. Un cambio de cuenta, una revocación detectada o el cierre de sesión invalida la generación previa. El acceso por correo confirmado avisa a las otras pestañas en cuanto cambia la sesión. La marca local sirve para provocar una nueva comprobación y las API protegidas siguen verificando la sesión y la cuenta de cada operación. La respuesta de sesión y el perfil permanecen en memoria.

Una página abierta que ya verificó su cuenta puede seguir usando el progreso local al quedarse sin red, con los mismos mecanismos de IndexedDB y outbox. Una recarga sin verificación de sesión mantiene oculto el contenido privado. Al reconectar se verifica al propietario antes de volver a mostrar sus datos. Las validaciones del servidor, el orden de la sincronización inicial y los formatos de almacenamiento se conservan.

## Reproducción

Compilar cada revisión por separado y ejecutar `next start` con `APP_ENV=local`, `PAESSED_DEV_MODE=true` y el `APP_ORIGIN` local correspondiente.

```powershell
node scripts/measure-session-identity.cjs http://127.0.0.1:3261 http://127.0.0.1:3264
```

Chromium usa cuentas ficticias, IndexedDB real y respuestas interceptadas con 450 ms de espera por solicitud de sesión o sincronización. Hay 12 accesos fríos por versión y ancho, cada uno en un contexto nuevo, y 30 transiciones calientes por ruta tras descartar el primer recorrido. La entrada fría se mide desde el inicio de la navegación. Las transiciones calientes se miden desde el clic hasta el primer frame con contenido visible. Perfil se mide al seleccionar «Mi perfil» en el menú. El ancho de 390 px simula el viewport en el mismo equipo. El benchmark registra también los GET de sesión de cada observación.

## Resultados con 450 ms

Tiempos p50 / p95 en milisegundos. En Inicio, el contenido personalizado se identifica por el saludo. En Perfil, por el nombre verificado visible en el formulario.

| Escenario | Ancho | GET de sesión en main → fase 2 | Personalizado en main | Personalizado en fase 2 | General p95 en main → fase 2 |
|---|---:|---:|---:|---:|---:|
| Entrada fría a Inicio | 1440 px | 2 → 1 | 1612,5 / 1685 | **1138 / 1166** | 58 → 68 |
| Ensayos → Inicio | 1440 px | 1 → 0 | 500,5 / 508 | **42 / 57** | 50 → 57 |
| Inicio → Perfil | 1440 px | 1 → 0 | 474 / 476 | **27 / 28** | — |
| Entrada fría a Inicio | 390 px | 2 → 1 | 1576 / 1618 | **1071,5 / 1143** | 53 → 49 |
| Ensayos → Inicio | 390 px | 1 → 0 | 500,5 / 506 | **40 / 52** | 46 → 52 |
| Inicio → Perfil | 390 px | 1 → 0 | 475 / 475 | **27 / 28** | — |

El p95 del contenido general de Inicio se mantiene por debajo de 150 ms. El perfil y el saludo dejan de esperar un viaje de red adicional. Las esperas del servidor y la sincronización inicial siguen presentes en el acceso frío.

## Validación y reversión

Las pruebas de navegador cubren los GET por pestaña y navegación, el aviso al completar el acceso por correo en otra pestaña, A → B → A, respuestas tardías, respuestas sin identidad, 401 y 503, vencimiento de la vigencia local, guardado de Perfil, desconexión y reconexión con cambio de propietario. La restauración del historial se prueba mediante eventos `pagehide` y `pageshow` con `persisted`.

Con la misma cuenta abierta en dos pestañas, cada pestaña hizo dos GET entre la entrada a Ensayos y el saludo de Inicio en `main`, y uno en la fase 2. Cada pestaña parte de su propia verificación.

Pasaron la compilación optimizada, 54 pruebas de backend, 25 de inicio y diagnóstico educativo en Node y 36 de la suite base. En navegador pasaron 59 pruebas de Inicio, cuentas, Aprender y respaldos en Chromium, cinco casos adicionales de identidad en WebKit y dos casos del temporizador de Aprender en Chromium y WebKit.

La prueba local de dos navegadores usa las rutas HTTP de PAESSED, PostgreSQL local y un proveedor de identidad simulado. Comprueba la entrega de una operación guardada sin red, su recepción en el segundo navegador, el aislamiento de otra cuenta y el rechazo de una sesión revocada. La validación alojada de Google, correo y concurrencia queda pendiente en un Preview conectado a `paessed-dev`.

Para revertir la fase, revertir el commit de esta rama. La reversión conserva los datos en IndexedDB y la cola existente.
