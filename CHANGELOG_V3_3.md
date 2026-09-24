# PAESSED Dashboard v3.3

Esta iteración pule escala, notificaciones y la sección de ensayos sin cambiar la arquitectura general del dashboard.

## Cambios

- Escala desktop ligeramente mayor: sidebar, topbar, ancho de contenido y sizing rem ampliados para aproximarse al zoom que se veía mejor en las capturas.
- Saludo principal más protagonista: 32–34 px según viewport.
- Indicador de desarrollo de Next.js desactivado (`devIndicators: false`) para quitar el icono flotante `N`.
- Sileo:
  - estructura de copy consistente de título + subtítulo;
  - sombra inferior más visible en light y dark;
  - conserva el workaround del hitbox invisible para no bloquear controles cercanos.
- Últimos ensayos:
  - nueva sección contenida y con jerarquía visual más clara;
  - cada ensayo muestra las 65 preguntas completas;
  - grilla fija de 13 × 5;
  - verde = correcta, rosa/rojo = incorrecta, gris = omitida;
  - resumen de cantidades por estado;
  - hover por pregunta con número y estado;
  - puntaje y variación con mejor jerarquía.

## Nota de validación

No se pudo completar `npm install` dentro del entorno de generación por timeout. Se hizo chequeo sintáctico con TypeScript global; los errores devueltos corresponden a módulos/tipos de dependencias no instaladas, no a errores de sintaxis introducidos por esta iteración.
