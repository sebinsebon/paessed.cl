# Cuentas del MVP: preparación local y piloto

El código no cambia `paessed-dev` ni producción. Las cuentas siguen siendo opcionales. Las credenciales privilegiadas se usan únicamente desde el servidor; el navegador recibe cookies de sesión HttpOnly y referencias educativas. El usuario de datos es siempre `auth.users.id`. No hay una fusión propia por correo ni desvinculación de proveedores.

## Entorno local

1. Copiar `.env.example` a `.env.local` y generar secretos distintos de al menos 32 caracteres para `AUTH_FLOW_SECRET` e `IP_HMAC_SECRET`. Usar el mismo `APP_ORIGIN` al abrir la aplicación y en `auth.site_url`; el ejemplo utiliza `http://localhost:3000`.
2. Arrancar Supabase local y aplicar las migraciones locales según el documento del backend. Crear un rol de login que herede `paessed_server`; su contraseña y conexión van en `DATABASE_URL`. No servir la aplicación con la contraseña del administrador de migraciones.
3. Completar URL y clave pública del Supabase local. La clave administrativa de `SUPABASE_SECRET_KEY` se necesita para eliminar una cuenta y nunca lleva prefijo `NEXT_PUBLIC_`.
4. El archivo `supabase/config.toml` exige confirmación del correo, contraseña de al menos ocho caracteres, permite vinculación manual y desactiva usuarios anónimos. El correo de pruebas puede inspeccionarse en el servidor SMTP local de Supabase.

Para Google, crear un cliente OAuth **de desarrollo** y registrar exactamente `http://127.0.0.1:54321/auth/v1/callback` en Google Cloud. Añadir las dos variables `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` y activar únicamente la sección local `[auth.external.google]`. Los permisos solicitados son `openid email profile`. No se solicitan permisos de Drive ni acceso offline a APIs de Google.

La aplicación solo construye `/auth/callback` en `APP_ORIGIN`; sus destinos finales son rutas internas fijas. El nonce de aplicación y `sb_flow_id` son parámetros de correlación de PKCE, no destinos. Mantener `Site URL` igual a `APP_ORIGIN`: Supabase permite el retorno al mismo origen, incluyendo estos parámetros, sin comodines. Véanse [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) y la [validación del servidor Auth](https://github.com/supabase/auth/blob/master/internal/utilities/request.go). La lista adicional contiene URLs explícitas de callback, sin dominios de preview abiertos.

## Identidades y operaciones sensibles

Supabase gestiona la [vinculación automática segura](https://supabase.com/docs/guides/auth/auth-identity-linking). La vinculación manual llama `linkIdentity()` con la sesión existente, requiere una confirmación reciente y verifica el mismo UUID al regresar. Una identidad ya utilizada produce un error y no mezcla datos.

La recuperación exige un enlace emitido para recuperación y el marcador del verificador PKCE `recovery`; un código de login no habilita cambiar la contraseña. El enlace debe abrirse en el navegador que inició el proceso. El SDK fijado devuelve `redirectType` en ejecución aunque su tipo público lo omite; se valida su forma antes de usarlo.

La reautenticación con Google inicia un nuevo flujo de selección de cuenta y comprueba nuevamente el mismo usuario. Google no documenta `prompt=login`; se utiliza `select_account`. El servidor admite sesiones creadas durante los últimos cinco minutos o recibos firmados de reautenticación ligados al UUID y al ID de sesión. La eliminación revoca primero todas las sesiones y después elimina al usuario; cada API comprueba también `auth.sessions`, evitando que un JWT aún no expirado continúe escribiendo.

## Preparación de paessed-dev para un piloto posterior

Estos pasos son operativos pendientes y **no se ejecutan con esta entrega**:

- Configurar `Site URL` y los callbacks explícitos del dominio de desarrollo; activar Google con sus credenciales de desarrollo y la vinculación manual.
- Activar Turnstile en Supabase Auth para registro, contraseña y recuperación. Configurar el mismo sitio/proveedor en `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`. La aplicación transmite el token al proveedor en esos flujos y verifica directamente Turnstile al iniciar OAuth.
- Revisar [límites nativos de Auth](https://supabase.com/docs/guides/auth/rate-limits). El limitador de PAESSED no cubre llamadas directas a `/auth/v1/*`; CAPTCHA y límites nativos deben verificarse también contra esos endpoints. La protección CAPTCHA nativa descrita por Supabase cubre [registro, acceso por contraseña y recuperación](https://supabase.com/docs/guides/auth/auth-captcha), no debe darse por supuesta para el inicio OAuth directo.
- Configurar SMTP propio antes de un piloto real. El proveedor integrado tiene un límite de dos correos por hora; no se contrata ningún servicio automáticamente.
- Configurar el proxy de confianza. En Vercel se usa `TRUSTED_PROXY=vercel`; Cloudflare solo es válido si sobrescribe su encabezado y el origen no acepta accesos que eviten el proxy. Nunca confiar en `X-Forwarded-For` suministrado por el cliente.
- Desactivar el registro de parámetros de consulta en los logs HTTP del despliegue, especialmente `/auth/callback`. Next dev ignora esa ruta en sus logs de solicitudes. No registrar cookies, contraseñas, tokens, códigos OAuth ni cuerpos de importación.

## Verificación disponible

`node --experimental-strip-types --test tests/auth-security.test.mjs` prueba firma, expiración, destino fijo, parámetros duplicados/desconocidos, cancelación, consumo único, identidad distinta y recuperación incorrecta. `scripts/verify-local-supabase.mjs` comprueba permisos mediante HTTP únicamente contra loopback; puede añadir un token de prueba autenticado para repetir la comprobación como usuario.

La aceptación completa con Google, correo no verificado, vinculación cruzada, entrega SMTP y revocación de sesiones reales requiere Supabase local activo y credenciales del proveedor. Las pruebas con dependencias simuladas no sustituyen esa aceptación.
