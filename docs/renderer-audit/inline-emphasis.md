# Negrita y cursiva en contenido 0.2.0

`text.text` admite la convención opcional `<b>…</b>` y `<i>…</i>` en enunciados, alternativas, explicaciones y celdas. No cambia el esquema 0.2.0 ni el paquete 0.1.0; sí amplía la interpretación de la prosa literal. Solo se reconocen pares completos, exactos, sin atributos y correctamente anidados dentro de un bloque. Otros marcadores y entidades se muestran literalmente. Si un par permitido queda abierto o cruzado, todo el bloque es literal. Los marcadores exactos quedan reservados; los lectores anteriores pueden mostrarlos como texto.

El lector crea nodos DOM `b` e `i`, sin interpretar HTML. `math.latex`, recursos, estructura de tablas y estados de verificación mantienen su tratamiento. La extracción para búsqueda y resúmenes retira únicamente marcadores válidos de prosa; preserva LaTeX. Copiar la selección del DOM produce el texto visible. La adaptación de “Preguntar a la IA” se entrega en el PR de borrador #9, que permanece separado de esta implementación.

Pruebas: `npm run test:emphasis`, `npm run test:renderer`, `npm run test:playground`, `node tests/paessed.cjs`, `npm run build`. Con una instancia en `PAESSED_BASE_URL`, `npm run test:emphasis-ui` verifica Ensayos/Playground, explicaciones y tablas en escritorio/móvil y claro/oscuro. La fixture es sintética: sus estados simulan la UI; no certifica ningún ensayo.

La extracción del importador utiliza propiedades de fuente de PDFium y conserva texto nativo y una propuesta de formato. No reconstruye matemáticas ni tablas. Metadatos ambiguos y escaneos requieren cotejo visual y pueden conservar `TEXT_FORMAT_PENDING`. Las pruebas/evidencias del importador viven en `paes-importer-dev`, fuera de la skill. No se ha elevado contenido real a Gold.
