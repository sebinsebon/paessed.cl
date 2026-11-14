# Backend MVP de PAESSED

Implementado sobre `feat/aprender-mobile`. Esta entrega prepara el código y las migraciones; no aplica cambios a `paessed-dev` (`rqeuczrmkkehxzipkynq`) ni a producción. Los archivos locales existentes permanecen disponibles.

## Diseño y límites de privacidad

Las cuentas son opcionales. `auth.users.id` identifica al propietario; el servidor valida el usuario y la vigencia de su sesión en cada API. El encabezado `X-PAESSED-Account` comprueba que la cola pertenece a la cuenta de las cookies, evitando que otra pestaña envíe el trabajo de una cuenta a otra.

El navegador mantiene una base IndexedDB separada para cada cuenta y conserva la base original del invitado. Cada modificación educativa y su operación pendiente se guardan en una transacción. Las confirmaciones, el cursor y los cambios remotos también se guardan juntos. Las operaciones conservan UUID, dispositivo y secuencia al reintentarse.

La sincronización envía acciones y referencias educativas. Los archivos `.paessed`, ZIP y JSON, los enunciados, recursos, solucionarios y trazos permanecen locales. Una fuente personal se identifica mediante SHA-256 y número original, con revisión separada de su contenido. Una referencia Gold se evalúa exclusivamente con el catálogo del servidor. Los respaldos manuales son ZIP versión 3; se conservan lectores de versiones 1 y 2. Los respaldos no incluyen credenciales, cookies, colas ni registros técnicos.

Las tablas están en el esquema privado `paessed`, con RLS y permisos retirados de `PUBLIC`, `anon` y `authenticated`. PostgREST no expone ese esquema. El acceso de la aplicación pasa por las APIs de Next.js y una conexión PostgreSQL del servidor. `paessed_server` es un rol sin login: un operador debe crear un rol de conexión que lo herede y almacenar su contraseña exclusivamente en `DATABASE_URL`. El rol de aplicación solo inserta o consulta respuestas originales; las alternativas utilizan ramas educativas independientes.

## Puesta en marcha local

1. Instalar las dependencias con `npm ci`.
2. Con Docker disponible, consultar `npx supabase start --help` y arrancar Supabase local con `npx supabase start`.
3. Consultar `npx supabase db reset --help` y aplicar las migraciones **solo al entorno local**, usando su opción local. El reset elimina datos locales de prueba: no utilizarlo contra un proyecto alojado.
4. Copiar `.env.example` a `.env.local`, configurar el origen exacto y las claves locales. Crear el rol de conexión que herede `paessed_server`; no usar las credenciales del administrador de migraciones para servir la aplicación.
5. Seguir [la preparación de autenticación](backend-auth.md) para correo, Google, CAPTCHA y retornos explícitos. Google, SMTP y Turnstile necesitan credenciales propias; no se contrata ningún servicio.
6. Ejecutar `npm run dev`. Las pruebas de navegador usan el puerto 3100: `npm run dev -- --hostname 127.0.0.1 --port 3100`.

Las pruebas de migración incluidas utilizan PGlite, un motor PostgreSQL local, con las tablas mínimas de Auth. Esto comprueba SQL, permisos y transacciones, pero no sustituye probar la pila completa de Supabase Auth, PostgREST y Storage.

## Cuotas y operación

Los límites se leen de variables `LIMIT_*`, sin nuevas migraciones. Los contadores son compartidos y atómicos en PostgreSQL. Los valores iniciales son: cuerpos reales de 256 KiB, 50 operaciones por lote, 20 solicitudes Auth/minuto/IP, 120 lecturas/minuto/usuario, 60 escrituras/minuto/usuario, 600 solicitudes de progreso/minuto/IP, 600 acciones educativas/minuto y 20.000/día/usuario, 100 sesiones/día, 20 abiertas y 10 dispositivos. Los reintentos confirmados no consumen cuotas de creación. Los cuerpos comprimidos y los campos fuera del contrato se rechazan.

`TRUSTED_PROXY` selecciona únicamente encabezados sobrescritos por el despliegue. La aplicación conserva un HMAC de la IP y acota su conjunto activo a 10.000 claves durante una hora. No aceptar encabezados suministrados directamente por el visitante. `SYNC_WRITES_PAUSED=true` permite pausar las nuevas escrituras sin perder la cola local.

La función `paessed.cleanup_batch()` elimina por lotes contadores inactivos, eventos técnicos vencidos y detalles técnicos de operaciones confirmadas. Conserva los recibos compactos de deduplicación, el progreso y las alternativas de conflictos. La migración registra una tarea diaria si `pg_cron` ya está habilitado. Verificar su activación y ejecución en el entorno local antes de la aplicación remota posterior.

`paessed.capacity_state` contiene la medición de base de datos y la medición de egress. Cada solicitud de sincronización comprueba el tamaño de base de datos; el egress facturado debe alimentarse desde las mediciones del proyecto y requiere su fecha de observación. Las respuestas avisan al 70 % y pausan nuevas escrituras al 85 %, incluida la activación de alternativas de conflictos. Una simulación local de tráfico no mide el egress real facturado por Supabase. No se habilitan planes de pago automáticamente.

## Verificación reproducible

```powershell
npm run test:base
npm run test:backend
npm run build
npm run test:learning-integration
npm run test:accounts-ui
npm run measure:sync
```

Con Supabase local activo y sus variables configuradas, ejecutar `npm run verify:local-supabase`. El verificador rechaza cualquier destino que no sea loopback y utiliza solo claves públicas; repetir con `LOCAL_TEST_ACCESS_TOKEN` para comprobar también el rol autenticado. Comprobar los endpoints directos de Auth por separado: el limitador de PAESSED no cubre esas solicitudes.

La aceptación del piloto requiere todavía ejecutar los flujos reales de Google, correo sin verificar, vinculación cruzada, recuperación SMTP, Turnstile y revocación contra Supabase local; comprobar PostgREST y Storage por HTTP; confirmar el trabajo diario de Cron y medir los recursos del proyecto. Estas comprobaciones dependen de un entorno local activo y de las credenciales del proveedor. Los mocks de navegador se identifican expresamente como tales en el informe de verificación.

El modo offline cubre la aplicación abierta y el contenido ya disponible en el navegador. PWA, arranque completo sin red, fusión de cuentas existentes, pagos y ranking permanecen fuera del MVP.
