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

## Temario M1 — Admisión 2027

El catálogo compartido vive en `lib/m1-curriculum.ts` y corresponde al temario oficial de **PAES Regular 2026, Admisión 2027**. DEMRE los denomina *unidades temáticas*; en la UI se presentan como *subejes*.

- Números: 3 unidades.
- Álgebra y funciones: 6 unidades.
- Geometría: 4 unidades.
- Probabilidad y estadística: 3 unidades.

Total: **4 ejes y 16 subejes**. [PDF oficial DEMRE/Mineduc](https://acceso.mineduc.cl/wp-content/uploads/2026/03/Temario-PAESRegular-2026-M1-v1.pdf).

Inicio utiliza este catálogo para los detalles de dominio y deja sin evidencia los subejes que no tienen resultados. Aprender enumera el temario completo. Playground permite elegir varios subejes simultáneamente, incluso de ejes distintos, o marcar un eje completo. La selección es visual, indica cuántas preguntas de demostración hay por subeje y se combina con el filtro de año y preguntas guardadas. En una sesión se pueden aplicar cambios ahora o dejarlos pendientes para la próxima pregunta. Las preguntas de ejemplo tienen IDs de subeje explícitos, pero **no existe aún un banco de preguntas para los 16 subejes** ni un clasificador automático para los archivos `.paessed` importados.

Comprobación de la integridad de los IDs y la cobertura:

```bash
npm run test:curriculum
```

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
