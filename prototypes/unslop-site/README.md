# Vista previa del pulido de Paessed

La galería usa los componentes reales de Paessed en escritorio (1440 px) y
móvil (390 px), con tema claro y oscuro. **Actual** usa los estilos del sitio.
**Propuesta** aplica los estilos bajo `html[data-paessed-polish]` en el mismo
documento. El selector de pantallas de la galería cambia entre capturas.

## Escala de diseño

| Función | Medida | Motivo |
| --- | --- | --- |
| Bloque dentro de una tarjeta | 8 px de radio | El borde interior acompaña al contenedor. |
| Control rectangular | 12 px de radio | Botones, campos y alternativas conservan una forma reconocible. |
| Tarjeta | 16 px de radio | Coinciden el dashboard, los resultados, Aprender y las bibliotecas. |
| Diálogo o panel de entrada | 20 px de radio | Su escala mayor acompaña el tamaño del panel. |
| Separación | 8, 12, 16 y 24 px | Se distingue la cercanía dentro de cada grupo del espacio entre secciones. |
| Acción principal y alternativa libre | 48 px de altura mínima | Facilita el uso táctil sin imponer altura fija al texto. |

Las sesiones conservan la hoja a pantalla completa y las métricas de una
hoja con tinta guardada. Los nodos, avatares, indicadores y estados conservan
su función visual. Las capturas usan cuentas y resultados ficticios, y la
hoja de preguntas del catálogo local se presenta con enunciados de ejemplo.
La captura del cambio de contraseña monta el formulario existente en una
ruta temporal del servidor local. Auditoría se captura con su puerta de
desarrollo y un paquete ficticio.

## Reproducir

Desde la raíz del proyecto, inicia el servidor Next de desarrollo en
`http://127.0.0.1:3262` con `PAESSED_DEV_MODE=true`,
`APP_ORIGIN=http://127.0.0.1:3262` y `PAESSED_AUDIT_MODE=1`. En otra
terminal, con Chrome y los navegadores de Playwright instalados:

```sh
node prototypes/unslop-site/capture.mjs
node prototypes/unslop-site/package.mjs
node prototypes/unslop-site/verify.mjs
```

La compilación estática para Vercel usa `prototypes/unslop-site/site` como
raíz. Para verificar el despliegue, pasa la URL a `verify.mjs`.
