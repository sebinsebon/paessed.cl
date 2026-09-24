# PAESSED — Dashboard de Inicio (prototipo v3.4)

Prototipo funcional de **Inicio**, construido con la arquitectura acordada:

- Next.js 16.3.6 + React 19.2
- Tailwind CSS 4.1
- Motion para animación, gestos y transiciones
- Sileo para feedback/toasts, reestilizado con los tokens visuales de PAESSED
- Lucide React para iconografía
- Light/Dark con los logos oficiales proporcionados
- Sistema visual basado en `DESIGN.md`

## Ejecutar

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Qué incluye

- Carrusel continuo de los 4 ejes M1; pausa y selección suave al hover, sin elevarse bajo la topbar.
- Color semántico por **estado de dominio**, no por eje.
- Estados: Dominado, Fuerte, Regular, Débil, Crítico y Sin suficiente evidencia.
- Zoom/modal detallado al seleccionar un eje, con superficie sólida correcta en Light/Dark.
- Misión diaria adaptativa.
- Meta mensual propuesta por PAESSED y editable.
- Racha, nivel, XP, objetivo diario y tema en topbar.
- Resumen de progreso mensual y últimos ensayos.
- Entrada compacta a `Aprender`; la ruta Duolingo completa queda para esa página.
- Tour guiado de primera entrada al dashboard (persistido en localStorage).
- Responsive: en móvil el carrusel continuo se convierte en cards swipeables/snap.
- `prefers-reduced-motion` respetado.

## Librerías de animación

Se usan **Motion** y **Sileo** directamente. Animate UI y SmoothUI funcionan como registros estilo shadcn (copian componentes al proyecto); se dejan para incorporar selectivamente cuando se elijan componentes concretos, evitando meter componentes solo por decoración.

## v3.3

La v3.3 aumenta ligeramente la escala de escritorio, mejora la jerarquía del saludo, desactiva el indicador de desarrollo de Next.js, refuerza la separación visual de los toasts Sileo y rediseña `Últimos ensayos` para mostrar las 65 preguntas en una grilla 13×5 incluyendo omitidas en gris. Ver `CHANGELOG_V3_3.md`.

## v3.4

Carrusel infinito arrastrable con mouse; título/subtítulo ordenados en toasts Sileo y campana amarilla; sol amarillo en modo oscuro; comparación de **correctas** entre ensayos en vez de diferencias de puntaje. Consulta `CHANGELOG_V3_4.md`.
