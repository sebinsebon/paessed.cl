# Piloto de PAESSED

## Invitación para la ronda de 48 horas

Abre [PAESSED](https://paesseduiux-zeta.vercel.app/) y realiza estas tres tareas:

1. Completa el diagnóstico de Matemática M1 con tu cuenta.
2. Practica una pregunta y guárdala para revisarla después.
3. Mañana, abre PAESSED en otro dispositivo, entra con la misma cuenta y busca tu resultado y la pregunta que guardaste.

Si algo te impide continuar o necesitas ayuda, cuéntanos dónde ocurrió. Puedes adjuntar una captura y dejar un contacto si quieres que te respondamos. [Reportar un problema](https://paesseduiux-zeta.vercel.app/reportar)

## Operación de la ronda

Convocar a 5–10 estudiantes una vez completada la aceptación pública. Registrar inicio y fin, número de participantes y dispositivos que cada uno usó. Registrar en qué tarea pidió ayuda o abandonó. Los archivos personales y dibujos se recuperan con el respaldo local del dispositivo de origen.

Al publicar, a la hora y al día siguiente, revisar los errores de funciones de Vercel, retornos de Auth, entregas y rebotes del remitente SMTP, errores y demoras de sincronización, base y transferencia de Supabase. Consultar los reportes con una cuenta de operación en la tabla privada `paessed.problem_reports`. El rol que atiende la aplicación solo puede insertar reportes. Asignar a cada incidencia responsable, fecha, SHA, dispositivo, pasos, resultado esperado, resultado observado y prueba que acreditó su cierre.

Detener la difusión ante mezcla de cuentas o pérdida de progreso. Activar `SYNC_WRITES_PAUSED=true` en el entorno afectado y desplegar la configuración para conservar las colas locales. Verificar compatibilidad del esquema y recuperar el despliegue identificado en el acta. Comprobar aislamiento, reconciliar escrituras y repetir la lectura desde un segundo navegador antes de reabrir.

Cerrar la ronda cuando al menos un estudiante externo complete el recorrido sin asistencia y recupere sus datos al día siguiente en otro dispositivo. Registrar la revisión final del dominio, los callbacks y cada alias antes de retirar accesos.
