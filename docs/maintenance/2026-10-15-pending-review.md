# Revisión de pendientes — 2026-10-15

## Integración web

Main inicial: `ef90df4`. Lector 0.2.0 adaptado a main: `3e837f3`. Renderizador: `101227f`. Main es ancestro del lector y este es ancestro del renderizador; la integración conjunta no tiene conflictos. Merge local: `b6d4af7`, cuyo árbol coincide exactamente con `101227f`.

La rama antigua `feat/paessed-reader-contract-0.2.0` (`22db47d`) parte de una base anterior. El núcleo del contrato (`lib/exam-editing.ts`, exportador, lector, runtime, recursos públicos y `tests/paessed.cjs`) es idéntico al de `3e837f3`. Los componentes UI difieren por la adaptación a main. Se integra la versión adaptada; mezclar además la rama antigua reintroduciría solapamientos innecesarios.

La rama `feat/paes-m1-aventura-mvp` es una funcionalidad distinta: siete archivos de una nueva ruta/MVP. Se inspeccionó su alcance y se dejó sin integrar; no se validó su flujo completo en esta revisión del importador/contrato/renderizador.

## Evidencia local

Pruebas ejecutadas en un worktree separado, con las dependencias existentes. Los cambios locales originales de `next-env.d.ts`, `tsconfig.json`, AGENTS/CLAUDE y lockfile se conservaron. Next generó cambios equivalentes en los dos archivos de configuración del worktree; no se incluyeron en los commits.

- Curriculum y progreso: 10/10 pruebas PASS.
- Recursos, Playground y candidata P41: 11/11 pruebas PASS.
- Motor de bloques en Chrome: 13/13 comprobaciones PASS.
- `node tests/paessed.cjs`: PASS para 0.1.0/0.2.0, edición segura, nulos, manifiesto, exportación/reimportación e imágenes.
- `next build --webpack`: PASS, incluido TypeScript y 15 páginas. Fue necesario permitir la descarga de Plus Jakarta Sans. El build Turbopack del worktree con dependencias enlazadas no se acreditó: rechazó el enlace externo de `node_modules`.
- Playwright, Chrome/Windows, build de producción local en puerto 3115: **83/83 PASS**, sin actualizar snapshots (3,8 minutos). Incluye 65 preguntas y recursos en distintos formatos, P41, P47, escritorio/móvil, claro/oscuro, navegación, filtros, lápiz y exportación/reimportación.
- Permanecen los avisos de la base por `experimental.viewTransition` y el tipo de módulo de dos tests. No se hicieron cambios ajenos a estos pendientes.

## Candidato Gold curricular rc1

SHA-256: `d135aa66a0fbc51c54820b56934148d53da6aae54aaa483c4d5a03c91e396cbf`.

Validación nueva: 65 preguntas consecutivas, 260 alternativas, 18 imágenes con hashes correctos, contenido 0.2.0 y manifiesto 0.1.0. ZIP y .paessed son idénticos. Curriculum: 63 `si`, P47 `dudoso`, P63 `no`.

Los dos PDFs están disponibles y sus hashes coinciden con la auditoría previa:

- Ensayo: `18e30b1e9064e7861de3c9636440eedb15b0c66590513536830df25da32acb0e`.
- Solucionario: `9939e54565e32f38a78d408aad2621c060531bdf8938cda87dfba7df589f323e`.

Se repitió el script de navegador de rc1 sobre copias temporales, apuntando al build recién compilado: PASS para importación de ambos formatos, recorrido de las 65 preguntas desde .paessed y tres desde ZIP, ocho comprobaciones de Playground, hashes de imágenes, filtros y exportación/reimportación por UI. Los archivos originales no se modificaron. Playground conserva su limitación de mostrar eje/subeje y filtrar por curriculum sin mostrar `en_temario`.

La inspección nueva de la página 18 del PDF y el recorte C confirma que falta el `2` inferior. Los cuatro recursos P41 coinciden con la versión anterior a la reparación documentada en `docs/renderer-audit/TESLA-P41-Gold-rc1.md`.

## Reparación acotada rc2, sin certificación Gold

Se creó una nueva candidata `TESLA-curriculum-0.2.0-rc2` dentro del área temporal del worktree del importador. Solo cambian los PNG, bbox y SHA-256 de los cuatro recortes P41. Las 65 preguntas, 260 alternativas, curriculum y otras 14 imágenes quedan idénticos. Los cuatro PNG coinciden exactamente con renders nuevos del PDF y contienen las etiquetas y ejes nativos comprobados por el verificador existente.

SHA-256 rc2: `0cd9ed1e0faa2dae7502c30b72efd1ef81c453ced8ef88a7e1cf4225a814ed71`. Pasa validación estricta Python + lector JS. Su evidencia de reparación y scripts se conserva junto a la entrega temporal; los originales siguen intactos.

La rc2 también pasó el mismo recorrido real en navegador: importación de ZIP/.paessed, 65 preguntas desde .paessed y tres desde ZIP, ocho comprobaciones de Playground, hashes de imágenes, filtros, exportación y reimportación por UI. Se guardaron seis capturas propias. Esto no sustituye su cotejo visual completo con las fuentes.

**Estado Gold: PENDIENTE.** No se realizó un cotejo nuevo e individual completo de las 65 preguntas. Para certificar faltan enunciado, todas las alternativas, fórmulas, imágenes, respuesta y justificación contra ambos PDFs, registro por pregunta y comparación visual de la entrega final con las fuentes. Deben resolverse/documentarse la ambigüedad de signo de P27 y las clasificaciones P47/P63. Los estados `verified` heredados no sustituyen esa revisión. Las pruebas locales no acreditan un despliegue o revisión en Vercel ni dispositivos físicos.

## Importador asociado

`1d0b457` corrige una prueba que dependía de un `tmp/` preexistente. `d169aff` corrige el rechazo Python de directorios ZIP vacíos admitidos por el lector web, con regresión para ambos contratos y rutas inválidas. Suite: 131 ejecutadas, 130 PASS y una omitida por privilegio de symlink. Release: 112 archivos verificados. Integración local del importador: `b442f89`.

No se ejecutaron importaciones nuevas con IA en Codex Chat Web o AGY CLI. La reparación completa de la fidelidad de ambos anfitriones permanece parcial; las comprobaciones de estructura, transporte y renderizado no la certifican.
