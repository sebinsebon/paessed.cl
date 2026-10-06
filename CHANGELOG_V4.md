# CHANGELOG V4 — Product UI

## Objetivo

Convertir el prototipo aislado de Inicio en una experiencia navegable de producto, sin reemplazar el diseño visual existente.

## Nuevo flujo público

- Landing pública con propuesta de valor y CTA al diagnóstico.
- Diagnóstico inicial de 12 preguntas sin registro.
- Resultado con evidencia inicial por eje.
- Registro posterior al diagnóstico.

## Aplicación

- Inicio conserva el dashboard v3.x y ahora enlaza a las otras experiencias.
- Aprender incorpora una ruta visual adaptativa con nodos, foco actual, bloqueos y XP.
- Ensayos incorpora historial, tendencia, objetivo y CTA a un ensayo completo.
- Nuevo reproductor de ensayo con:
  - 65 posiciones;
  - temporizador;
  - mapa de preguntas;
  - respondidas, omitidas y marcadas;
  - navegación anterior/siguiente;
  - finalización y resultado.
- Playground incorpora selección de preguntas, alternativas y feedback de respuesta.
- Perfil incorpora metas, preferencias y resumen de actividad.

## Navegación

- Sidebar común en desktop para Inicio, Aprender, Ensayos, Playground y Perfil.
- Bottom navigation común en móvil.
- CTAs del dashboard enlazados a rutas reales del prototipo.

## Integración futura

La v4 mantiene datos demo/localStorage de forma intencional. No añade backend, autenticación real ni ingestión de `.paessed`. La arquitectura visual queda preparada para conectar esos datos después.

## Compatibilidad

- Se conserva Next.js 16.3.6, React 19.2 y Tailwind CSS 4.1.
- Se mantiene `DESIGN.md` como sistema visual.
- No se elimina el dashboard existente ni sus interacciones.
