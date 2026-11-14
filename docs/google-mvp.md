# Activar el MVP con Google

La rama `feat/inicio-cuentas` incluye el acceso OAuth con PKCE, callback ligado al navegador, sesiones HttpOnly, revocación y progreso por cuenta. El modo dev simula identidades y debe estar desactivado para probar Google real.

## Configuración necesaria

1. Seleccionar el proyecto de Supabase y aplicar la migración de cuentas siguiendo `backend-mvp.md`. Configurar la conexión del servidor con un usuario que herede `paessed_server`.
2. Configurar las variables de `.env.example` en `.env.local` o en el entorno de alojamiento. No subir secretos a Git. `AUTH_FLOW_SECRET` e `IP_HMAC_SECRET` deben ser distintos y de al menos 32 caracteres. `APP_ORIGIN` debe coincidir con la URL donde se abrirá Paessed, por ejemplo `http://127.0.0.1:3210` para desarrollo.
3. Crear un cliente OAuth de tipo web en Google Cloud. Registrar como URI de retorno la URL del proyecto Supabase terminada en `/auth/v1/callback`, no el callback de Next.js. Configurar ese Client ID y secreto en el proveedor Google de Supabase y habilitarlo. Para Supabase local, usar las variables `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` y activar `[auth.external.google]` en `supabase/config.toml`.
4. En Supabase Auth, establecer Site URL en `APP_ORIGIN` y autorizar el callback de la aplicación `APP_ORIGIN/auth/callback`. Completar la audiencia y usuarios de prueba en Google si el consentimiento sigue en modo de pruebas.
5. Establecer `PAESSED_DEV_MODE=false`, reiniciar la aplicación y ejecutar `npm run verify:mvp`. La comprobación solo lee configuración y datos; no crea usuarios ni modifica servicios. No imprime claves.
6. Pulsar **Continuar con Google**, elegir una cuenta real y volver a Paessed. Comprobar diagnóstico, dashboard, recarga y cierre de sesión; verificar que otra cuenta conserve su propio progreso. La comprobación automática no sustituye este recorrido OAuth.

La eliminación de cuentas necesita además `SUPABASE_SECRET_KEY` en el servidor. Para un piloto público, configurar CAPTCHA y proxy de confianza según `backend-auth.md`.

Referencia: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
