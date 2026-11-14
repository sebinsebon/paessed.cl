# Verificación del backend MVP

Fecha: 12 de noviembre de 2026. Rama conservada: `feat/aprender-mobile`.

## Resultados ejecutados

| Comprobación | Resultado |
|---|---|
| `npm run test:base` | 36/36 pasan |
| `npm run test:backend` | 38/38 pasan |
| `npm run test:learning-integration` | 7/7 pasan |
| `npm run test:accounts-ui` | 3/3 pasan |
| `npm run build` | Correcto; compilación y TypeScript completos |
| `git diff --check` | Sin errores de espacios |
| `npm run measure:sync` | Simulación local completada |

Las pruebas de backend ejecutan la migración en PostgreSQL mediante PGlite. Incluyen permisos de tablas y funciones, RLS, reintentos después de limpiar detalles de operaciones, conflictos con ambas respuestas conservadas, selección de una rama, conservación del progreso posterior al conflicto, combinación de borradores compatibles, paginado de 50 sesiones históricas, borrados por generación, cuotas compartidas y límites de lectura del cuerpo. Las pruebas IndexedDB usan Chromium real, incluidas transacciones concurrentes y confirmaciones HTTP perdidas.

Las pruebas de navegador verifican entregas y evidencia Gold, recarga de sesiones, pestañas concurrentes y respaldos. Los escenarios de cuenta de `account-sync.spec.cjs` **simulan las respuestas de Auth y Sync** para verificar aislamiento y conservar la cola ante un `429`; no equivalen a iniciar sesión realmente con Supabase. También inspeccionan los lotes enviados: no contienen enunciados, soluciones, archivos ni trazos. Las pruebas existentes cubren respaldos versión 1; se añadieron comprobaciones de restauración versión 2 y exportación/restauración versión 3.

## Carga sintética local

`npm run measure:sync`, con 10 cuentas, 80 sesiones y 400 respuestas originales:

| Medida | Valor observado |
|---|---:|
| Consultas SQL instrumentadas | 3.060 |
| Operaciones serializadas de solicitud | 128.450 bytes |
| Respuestas de la aplicación | 1.839.563 bytes |
| Resultados de consultas serializados | 3.243.377 bytes |
| Tamaño local de la base | 9.855.099 bytes |
| Crecimiento de la base local | 1.654.784 bytes |

Los tamaños pueden variar con la asignación de páginas. Estas cifras excluyen TLS, protocolos de transporte, solicitudes Auth y egress facturado por Supabase. Las lecturas incrementales sin modificaciones devuelven una lista vacía de cambios; marcas y borradores no actualizan ni reenvían la proyección pedagógica si esta no cambia.

## Aceptación pendiente del entorno

Se intentó arrancar `npx supabase start`. El CLI, cuyo destino se confirmó como exclusivamente local, respondió que no encontró Docker ni Podman. Por tanto, no se ejecutaron migraciones contra una pila completa local, ni pruebas HTTP reales de PostgREST o Storage. El verificador `scripts/verify-local-supabase.mjs` queda preparado y restringido a loopback; sus pruebas de contrato pasan con respuestas simuladas.

Queda por ejecutar con Docker y credenciales de desarrollo:

- Registro y recuperación reales, correos no verificados, SMTP, Google, vinculación automática/manual, identidad ya asociada y revocación de sesiones.
- Turnstile y límites nativos de los endpoints directos de Supabase Auth.
- Rechazo HTTP real de PostgREST, RPC y Storage con claves públicas y un usuario autenticado.
- Activación y ejecución de Supabase Cron y medición del egress real del proyecto. El control de base de datos se mide por solicitud; el egress requiere alimentar `capacity_state` desde las mediciones del proyecto.

El build mantiene dos avisos previos del proyecto: la opción experimental `viewTransition` no reconocida y un `pnpm-workspace.yaml` fuera del repositorio. No afectan al resultado de compilación obtenido.

No se aplicaron migraciones ni cambios de configuración a `paessed-dev` ni a producción. No se crearon buckets ni servicios de pago, y no se envió progreso personal a un servicio remoto durante estas comprobaciones. Los archivos originales sin seguimiento del usuario se conservaron.

Consulta [la guía del backend](backend-mvp.md) y [la preparación de autenticación](backend-auth.md) para continuar la aceptación local y preparar posteriormente el entorno de desarrollo remoto.
