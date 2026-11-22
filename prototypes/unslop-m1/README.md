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

- **Inicio.** En `main`, el ensayo en curso compite con el diagnóstico y la ruta
  de aprendizaje. En la Propuesta, el cuadernillo de respuestas y el avance de
  64/65 acompañan el botón principal. La meta y el dominio por eje quedan como apoyo.
- **Pregunta 65.** En `main`, la hoja a pantalla completa usa alternativas
  compactas. En la Propuesta, el enunciado y el esquema ocupan una columna
  propia en escritorio y se apilan con las alternativas en móvil. Se usan radios
  nativos con foco visible en ambas vistas.
- **Resultado.** En `main`, el puntaje centrado va seguido de tarjetas
  independientes. En la Propuesta, puntaje y totales caben juntos y dan paso a
  la corrección, que indica el acierto o el error con texto, marca y color.

**Actual** adapta la vista clara del producto al recorrido de tres pantallas.
Ambas vistas incluyen el esquema del cambio de precio y la corrección de la
última pregunta para comparar la misma información. El resto del producto se
representa visualmente cuando da contexto al recorrido.

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
