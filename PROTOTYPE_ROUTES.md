# PAESSED UI/UX — prototipo multipágina

Este repositorio **no implementa** cuentas, autenticación, backend, cálculo oficial de puntaje ni extracción PDF.

## Recorrido de la primera visita

1. `/`: landing page informativa pública.
2. `/diagnostico`: bienvenida + 12 preguntas **originales sintéticas** de demostración, tres por eje y tres por habilidad primaria. Se guardan respuestas y avance solo en `localStorage` del navegador.
3. `/registro`: pantalla de registro **simulado**, obligatoria para desbloquear `/resultados` en el recorrido UI. No pedir contraseñas: nombre y correo ficticio nunca se envían a un servidor.
4. `/resultados`: resumen inicial aproximado, **no** conversión a puntaje PAES ni diagnóstico pedagógico validado.
5. `/inicio`: se conserva el dashboard v3.10 existente; la navegación ahora enlaza las demás páginas y muestra una tarjeta separada con el resultado local. Las métricas históricas preexistentes son de muestra.

## Páginas internas

| Ruta | Alcance ilustrativo |
| --- | --- |
| `/aprender` | Ruta visual seleccionable por eje y unidad. |
| `/aprender/leccion` | Sesión de 3 preguntas originales con correcciones. |
| `/ensayos` | Catálogo; solo el ensayo corto de demostración está activo. |
| `/ensayos/practicar` | 12 preguntas y revisión final de las respuestas. |
| `/scanner` | Ilustración del flujo y lectura **local** de un JSON para comprobar superficialmente que tiene `questions[]`; NO es el contrato ni el procesador real. |
| `/verificador` | Visor de ejemplo y marcas de revisión en memoria. |
| `/playground` | Vista previa de filtros por eje y cantidad. |
| `/playground/practicar` | Práctica libre corta con preguntas sintéticas. |
| `/estadisticas` | Diagnóstico local, última práctica, datos con advertencias claras de evidencia limitada. |
| `/perfil` | Datos ficticios guardados localmente, reset de experiencia. |
| `/ranking` | Próximamente. |

## Principios para implementar después

- Reemplazar el formulario ficticio con autenticación real. Solo tras completar **correctamente** el registro, transferir el intento del diagnóstico a una API autenticada que valide la integridad, identifique duplicados y guarde el resultado. No confiar en soluciones ni porcentajes del cliente.
- Definir política de consentimiento, expiración, almacenamiento y recuperación de diagnósticos interrumpidos antes del lanzamiento. La persistencia local sirve únicamente para simular.
- No usar las preguntas sintéticas como banco real; el banco oficial requiere procedencia, validación y condiciones de reutilización verificadas.
- Mantener un mismo lenguaje visual con `DESIGN.md`, logos propios, estilos globales y modo claro/oscuro. Mantener `Dashboard` separado durante la experimentación para evitar regresiones.
- Formularios, catálogo, estadísticas y Scanner son exploraciones de UX, no contratos definitivos de backend.
