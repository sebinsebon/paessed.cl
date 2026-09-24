# PAESSED Dashboard v3.4

Cambios acotados respecto de v3.3. **No se ha modificado la arquitectura, paleta del DESIGN.md ni el layout del dashboard.**

- **Notificaciones Sileo:** el toast inferior usaba la disposición interna de Sileo, que dibuja la descripción por encima del título al expandir desde abajo. Ahora el título y subtítulo se renderizan juntos, en ese orden, dentro del contenido enriquecido de Sileo y el título integrado de la biblioteca se oculta para evitar duplicarlo. La campana del aviso usa un icono amarillo (`BellRing`). Las notificaciones de meta, práctica y ruta siguen el mismo formato.
- **Campana:** el segundo clic limpia la notificación mientras está activa; su estado también se reinicia tras cambiar el tema.
- **Carrusel desktop:** mantiene movimiento continuo infinito y pausa suave al hover. Además se puede arrastrar en cualquier dirección con el mouse (detección de umbral para no confundir el arrastre con abrir una tarjeta; ajuste modular para seguir siendo infinito). El modo móvil sigue teniendo swipe/snap nativo.
- **Tema:** en modo oscuro el sol del botón de tema ahora es amarillo (`#FACC15`), no naranja. El naranja oficial se mantiene para CTA y demás componentes.
- **Últimos ensayos:** se reemplaza el delta de puntos por un delta *calculado de respuestas correctas* frente al ensayo anterior. Ejemplo en los datos del prototipo: #8 tiene 46 correctas y #7 tiene 43, por lo que #8 indica «↑ 3 correctas más». Para el ensayo más antiguo mostrado se indica «Primer registro» en vez de inventar una comparación.

## Probar

```sh
npm install
npm run dev
```

Verificar: cambiar entre claro/oscuro, pulsar dos veces la campana, actualizar la meta, arrastrar el carrusel con mouse a ambos lados y abrir una tarjeta con un clic sin arrastrar; en «Últimos ensayos», comprobar diferencias y omitidas. Todos los datos son ficticios para la demostración.
