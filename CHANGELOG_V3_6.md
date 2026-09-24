# PAESSED Dashboard v3.6

Ajustes solicitados después de comparar localhost:3000 vs. localhost:3002.

- **Métricas superiores:** se restaura el tamaño, el peso y el borde redondeado de los botones v3.4; la racha recupera el fondo cálido y mantiene el icono `#ffb86a`.
- **Carrusel:** se recupera la tarjeta de altura/tipografía original y se reduce solo 8px el padding total del rail (~5% respecto de v3.4). Mantiene arrastre infinito e inercia.
- **Sileo:** se elimina la descripción JSX duplicada, el título vacío y el CSS `height:0` / altura forzada `68px` y el ancho `340px` (Sileo usa `40px` y `350px`) que desalineaban la geometría del badge SVG. Se usa el orden nativo icono + título y descripción debajo mediante `top-right`, anclando solo el viewport abajo a la derecha por CSS.
- **Notificación:** icono de campana y badge usan `#ffb86a`, idéntico al sol. Superficie y sombra adaptadas a ambos temas; hitbox visible sin bloquear controles circundantes.

Este prototipo conserva datos ficticios de interfaz: no cambia lógica de la PAES real.
