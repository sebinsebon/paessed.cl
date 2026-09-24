# PAESSED Dashboard v3.1

Corrección enfocada únicamente en dos puntos solicitados:

1. **Fidelidad a `DESIGN.md`**
   - Plus Jakarta Sans se carga realmente mediante `next/font/google` (pesos 400–800), en lugar de depender de un fallback del sistema.
   - Se restauran los tokens visuales de PAESSED para superficies, naranja principal, índigo, bordes, sombras y tipografía.
   - Las tarjetas de dominio mantienen colores semánticos por estado (Dominado/Fuerte/Regular/Débil/Crítico), pero sobre las superficies y jerarquía definidas en `DESIGN.md`.
   - La escala tipográfica del carrusel vuelve a los roles de `title-sm`, `body-md` y `label-sm`.

2. **Carrusel infinito sin corte**
   - Las cuatro tarjetas rellenan exactamente el ancho útil del rail en desktop.
   - El set se replica tres veces y cada ciclo incluye su propio gap final.
   - El reset ocurre por el ancho exacto de una unidad repetida, evitando el hueco visible al terminar el ciclo.
   - Al hacer hover, la velocidad desacelera suavemente hasta cero y retoma de la misma forma al salir.

No se rediseñaron las demás secciones en esta iteración para mantener una revisión precisa, punto por punto.
