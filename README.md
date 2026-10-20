> **Rama Aventura · actualización de prototipo (octubre de 2026).** El recorrido interactivo real está en [`/aventura`](/aventura). `/app/aprender` abre esa misma experiencia en lugar de mantener la maqueta estática. Incluye 17 microlecciones que cubren las 16 unidades temáticas M1, 102 preguntas **de demostración**, diagnóstico de 12 preguntas, repasos espaciados y una **vista previa individual** de Ranked (un reto de 10 preguntas diario, hasta 100 puntos). Para una liga semanal real entre usuarios todavía hacen falta backend, autenticación, banco verificado y validación antifraude. Ejecutar `npm run test:aventura` para probar las reglas. [Detalles técnicos](public/aventura/MVP_PLAN.md).

# PAESSED — Product UI prototype v4

Prototipo navegable de la experiencia completa de **PAESSED M1**, construido sobre el dashboard v3.x y el sistema visual de `DESIGN.md`.

## Stack

- Next.js 16.3.6 + React 19.2
- Tailwind CSS 4.1
- Motion para animaciones y transiciones
- Sileo para feedback/toasts del dashboard
- Lucide React para iconografía
- Light/Dark con tokens semánticos de PAESSED
- Plus Jakarta Sans

## Ejecutar

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Flujo principal

```text
Landing pública
→ diagnóstico inicial de 12 preguntas
→ resultado y primera evidencia
→ registro para guardar el progreso
→ Inicio
→ Aprender / Ensayos / Playground / Perfil
```

Rutas principales:

- `/` — landing pública.
- `/login` — acceso de usuarios que ya tienen cuenta.
- `/diagnostico` — diagnóstico inicial.
- `/diagnostico/resultado` — primera lectura de dominio.
- `/registro` — registro posterior al diagnóstico.
- `/app/inicio` — dashboard post-diagnóstico.
- `/app/aprender` — ruta adaptativa tipo micro-learning.
- `/app/ensayos` — historial y progreso por ensayos.
- `/app/ensayos/nuevo` — experiencia de ensayo de 65 preguntas.
- `/app/ensayos/resultado` — resultado y siguiente acción.
- `/app/playground` — exploración y práctica de preguntas.
- `/app/perfil` — metas, preferencias y resumen.

## Decisiones UX

- El usuario puede probar PAESSED **sin registrarse**.
- El registro aparece recién después del diagnóstico, cuando existe progreso que vale la pena guardar.
- Inicio prioriza progreso y siguiente acción; la ruta completa vive en Aprender.
- Los ensayos son la evidencia más fuerte del perfil.
- Playground permite practicar sin alterar la ruta principal en este prototipo.
- Los estados de dominio siguen siendo: Dominado, Fuerte, Regular, Débil y Crítico, más “Sin suficiente evidencia” como estado auxiliar.
- Desktop usa sidebar persistente; móvil usa navegación inferior.
- `prefers-reduced-motion` se respeta desde el sistema visual existente.

## Estado de datos

La v4 es todavía un **prototipo de producto**: usa datos demo/localStorage para demostrar los flujos y las interacciones. No simula que esos datos ya provengan del backend.

La siguiente etapa de integración conectará:

```text
.paessed / final.json
→ ingestión de contenido
→ banco de preguntas
→ sesión/usuarios
→ respuestas del estudiante
→ dominio y progreso
→ UI de PAESSED
```

## Diseño

`DESIGN.md` sigue siendo la fuente de verdad visual. La v4 reutiliza el lenguaje existente: naranja como motor de acción, índigo para aprendizaje, rojo para diagnóstico, esmeralda para dominio, superficies redondeadas y botones táctiles.

Ver `CHANGELOG_V4.md` para el alcance de esta iteración.
