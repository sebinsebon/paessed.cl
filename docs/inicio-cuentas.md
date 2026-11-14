# Inicio y cuentas

Rama de implementación: `feat/inicio-cuentas`, basada en `feat/aprender-mobile` (`7a942a9`). Integra el trabajo local de cuentas y sincronización que ya existía.

## Recorrido público

La portada abre una tarjeta de registro al pulsar **Empezar mi diagnóstico**, o de acceso con **Ya tengo cuenta**, sin cambiar de página. Explica para qué sirven las 16 preguntas y permite volver o elegir **Más tarde**. Tras acceder desde ese botón, `/bienvenida` conserva la incorporación de respuestas pendientes y continúa al diagnóstico. La ruta directa del diagnóstico sigue admitiendo borradores locales. La portada muestra acceso al dashboard y perfil cuando detecta una sesión verificada (o una cuenta simulada en dev).

Después de autenticarse, `/bienvenida` recupera las respuestas del dispositivo y consulta el estado de la cuenta antes de decidir si hay un diagnóstico que incorporar. Una cuenta sin diagnóstico puede entrar al dashboard; Inicio explica mediante un diálogo por qué debe hacerlo para personalizar Aprender. Los accesos de los resultados también abren la tarjeta en un modal y conservan las respuestas.

La cuenta vacía incorpora el diagnóstico automáticamente. Si existe evidencia previa, se pregunta si incorporar las respuestas al dominio (recomendado) o mantener el dominio actual. Completar el diagnóstico y aportar evidencia se registran por separado. No se reinician las sesiones comenzadas; las preguntas repetidas no suman dominio ni XP. Aprender utiliza la misma señal de diagnóstico completado.

Los datos iniciales son provisionales. Se mantiene el umbral de 15 respuestas elegibles por eje. Los porcentajes de la portada son una demostración, no los resultados del visitante.

## Modo dev

Configurar `PAESSED_DEV_MODE=true` antes de arrancar `npm run dev`. En previews se requiere además `VERCEL_ENV=preview`. Para probar una compilación local de producción se admite `APP_ENV=local`; nunca se debe configurar así un despliegue público de producción.

El botón **DEV** permite ir directamente a portada, diagnóstico, dashboard, Aprender, acceso y registro. Activar un atajo crea una cookie HttpOnly temporal. Los datos de prueba usan bases IndexedDB y claves con prefijo `paessed-dev:`; no se crea una identidad remota. Acceso y registro mantienen el modo de prueba activo. **Salir del modo dev** conserva los datos de prueba y restablece el recorrido real.

En modo dev puedes crear una cuenta de prueba con nombre y correo, entrar con ese correo o simular Google. Las contraseñas no se guardan ni se verifican: estas cuentas sirven únicamente para recorrer la interfaz. No se envían correos, CAPTCHA ni solicitudes remotas de autenticación o sincronización. El selector de cuentas conserva un progreso separado por usuario; **Usar cuenta con progreso** prepara una cuenta con respuestas previas para probar la incorporación de otro diagnóstico.

El modo dev permite iniciar una sesión en Aprender sin completar el diagnóstico, incluso si existe un diagnóstico pendiente. El borrador sigue disponible para retomarlo y no se marca como completado. Una cuenta nueva que sí tenga un diagnóstico terminado lo incorpora automáticamente; una cuenta con evidencia previa presenta la decisión de incorporarlo o mantener el dominio actual.

## Diseño y tema

La portada conserva el título y el carrusel junto a él. Debajo presenta Aprender, Ensayos y Playground, la importación de ensayos compatibles y las ventajas de la ruta adaptativa y el dominio por eje. El carrusel no muestra caption ni controles; conserva arrastre, teclado y pausa al interactuar, y respeta movimiento reducido. Comparte los botones, colores y superficies del dashboard.

El Inicio del dashboard vuelve al componente original `Dashboard`. El recordatorio del diagnóstico aparece al entrar mientras falte completarlo, admite **Más tarde** y Escape, y vuelve a mostrarse al regresar a Inicio. No utiliza un temporizador ni se superpone al recorrido introductorio del dashboard. Completar o incorporar el diagnóstico desactiva el recordatorio, incluso si se eligió no sumar sus respuestas al dominio.

Registro y acceso usan una sola tarjeta centrada con Google o correo, con copyright al pie izquierdo y **Volver** en la cabecera. La tarjeta es la misma en la página completa y en los modales. Los diálogos empiezan enfocando su título y mantienen Tab/Shift+Tab dentro de sus controles.

Los conflictos de versiones y la incorporación de progreso se muestran como modales, sin franjas que desplacen el menú. Los conflictos aparecen primero, luego la incorporación y finalmente el recordatorio del diagnóstico; nunca se abren a la vez. **Guardar (recomendado)**, **No guardar** y **Más tarde** preparan una elección: hay 5 segundos para leerla y después 5 segundos para pulsar **CONFIRMAR** en rojo. Vencido el plazo se vuelve a las opciones sin escribir datos. No guardar una incorporación conserva el original local y registra la negativa por cuenta; Más tarde la aplaza durante esa visita. Al resolver un conflicto se conserva la alternativa, con descarga disponible. Los errores de sincronización también se presentan en un diálogo. Un borrador de diagnóstico sin respuestas no provoca un aviso vacío de importación.

El diagnóstico introduce los cuatro ejes con emojis locales animados. Los resultados muestran los aciertos y errores originales por eje; se pueden desplegar los subejes y leer qué significa esa primera señal. No se presentan como una predicción de puntaje ni un dominio ya calibrado.

El tema claro es el predeterminado, independientemente del sistema operativo. La selección explícita se guarda en `paessed-theme`, se comparte entre todas las rutas y se actualiza en otras pestañas abiertas. No se guarda por cuenta: es una preferencia del navegador.

En producción (`VERCEL_ENV=production` o `APP_ENV=production`) el servidor rechaza estos atajos aunque exista la cookie. Una compilación de producción sin entorno local/preview explícito también los desactiva.

## Verificación

- `npm run test:base` y `npm run test:backend`: regresión del motor y sincronización.
- `npm run test:onboarding`: incorporación del diagnóstico, persistencia, reintentos y aislamiento del modo dev.
- `npm run test:inicio-ui`: servidor local en `http://127.0.0.1:3210` con `PAESSED_DEV_MODE=true` y `APP_ORIGIN` igual al origen de pruebas.
- `npx tsc --noEmit` y `npm run build`: tipos y compilación.
- `node tests/inicio-production.mjs`: contra `next start` local en puerto 3211 con `VERCEL_ENV=production` y `PAESSED_DEV_MODE=true`, confirma que la cookie dev no habilita el dashboard y el endpoint dev devuelve 404.

Los recorridos reales de Google, SMTP, confirmación y revocación necesitan Supabase y los proveedores configurados conforme a `backend-auth.md`. No se han activado proveedores ni modificado servicios hospedados como parte del rediseño.
