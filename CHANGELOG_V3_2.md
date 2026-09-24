# PAESSED Dashboard v3.2

Correcciones visuales solicitadas sobre v3.1, sin cambiar la arquitectura del Inicio.

## Cambios

- **Naranja de marca restaurado:** los botones y acentos principales usan `#F97316` también en dark mode; hover `#EA580C` y profundidad `#C2410C`, como define `DESIGN.md`.
- **Colores semánticos consistentes en Light/Dark:** índigo, verde, rojo y amarillo mantienen el mismo rol de marca/estado; solo cambian las superficies y el contraste del tema.
- **Menos look “vibecodeado”:** se eliminaron halos/blobs decorativos y gradientes de fondo del modal, Misión diaria, tarjeta Aprender y avatar. Se conserva el gradiente radial de las tarjetas de dominio porque forma parte de la dirección aprobada.
- **Carrusel:** al hacer hover ya no sube hacia la topbar; escala suavemente en su sitio y tiene espacio vertical adicional para que la sombra/aura no se recorte.
- **Modal de dominio:** corregida la variable de superficie elevada que faltaba (`--surface-raised`), causa de la apariencia transparente. Ahora es sólido en ambos temas.
- **Sileo adaptado a PAESSED:** conserva su animación morph/spring, pero usa superficies, tipografía, radios y colores semánticos coherentes con el `DESIGN.md`. En dark mode ya no aparece blanco.
- **Sileo reposicionado:** los toasts aparecen abajo a la derecha para no tapar controles de la topbar.
- **Bug de interacción de Sileo mitigado:** se añadió el workaround CSS recomendado en el issue abierto #22 para que el viewport invisible no intercepte clics sobre botones de la interfaz.
- **Sileo sin acumulación:** antes de mostrar un nuevo toast se limpia el anterior. El botón de notificaciones funciona como toggle: una segunda pulsación lo cierra.
- **Cambio de tema:** limpia cualquier toast activo para evitar que quede un toast del tema anterior.
