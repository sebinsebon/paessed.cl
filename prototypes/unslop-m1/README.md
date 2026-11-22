# Prototipo Paessed M1

Comparación de Inicio, pregunta 65 y resultado sobre `main` en `0e8b622`.
El recorrido abre en **Propuesta**. El selector **Actual / Propuesta** conserva
la pantalla y la respuesta. **Reiniciar demo** vuelve al inicio con las 64
respuestas de ejemplo.

## Referencia visual

Se capturaron las tres pantallas de `main` con Playwright a 1440 y 390 px.
Se precargaron las respuestas del ensayo de práctica e ingresó por el modo de
desarrollo local. La última pregunta y la fórmula de puntaje estimado son las
del ensayo de práctica de `main`.

Propuesta aplica el modo de pulido de Unslop sobre la misma interfaz de
Paessed. Comparte con Actual la paleta clara, Plus Jakarta Sans, la navegación
y la estructura de las tres pantallas.

- **Inicio.** Alinea el encabezado, el diagnóstico y las tarjetas. Los paneles
  comparten un radio de 16 px, las tarjetas contiguas usan separaciones de
  16 px y las secciones se separan por 24 px.
- **Pregunta 65.** Conserva la hoja de ensayo y el botón inferior. Las
  alternativas usan radios de 12 px, una separación de 8 px y una altura
  mínima de 48 px. La alternativa seleccionada conserva el acento naranja.
- **Resultado.** Conserva el puntaje centrado y las tarjetas de totales. En
  móvil, las tarjetas forman dos columnas para acercar la corrección. El
  resultado de la última pregunta se distingue con texto, marca y color.

**Actual** adapta la vista clara del producto al recorrido de tres pantallas.
Ambas vistas incluyen el esquema del cambio de precio y la corrección de la
última pregunta para comparar la misma información. El resto del producto se
representa visualmente cuando da contexto al recorrido. El documento y la
lógica son comunes a los dos modos. Solo cambia el tratamiento visual.

## Compilación y verificación

Desde la raíz del repositorio, con las dependencias instaladas:

```sh
node prototypes/unslop-m1/build.mjs
node prototypes/unslop-m1/verify.mjs
```

La verificación usa Chromium y WebKit de Playwright. Para capturar las pantallas
locales, agrega `--local <carpeta>`. Para verificar un despliegue anónimo, pasa su
URL como primer argumento.

El despliegue de Vercel usa solo `out/unslop-m1`. La compilación copia el logo
de Paessed y reutiliza la tipografía Plus Jakarta Sans y el icono Trophy de
Lucide. Las licencias de la tipografía y del icono acompañan los archivos
estáticos. La demo se ejecuta en memoria, con una política que bloquea
conexiones salientes desde la página.

Las guías de [Unslop](../../.agents/skills/unslop/UPSTREAM.md) y
[Modern Web Guidance](../../.agents/skills/modern-web-guidance/UPSTREAM.md)
documentan sus revisiones de origen y licencias.
