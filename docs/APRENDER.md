# Aprender: primera entrega funcional

Implementación local sobre `feat/aprender`, inicialmente sincronizada con `main` en `0cd23a0`. La especificación de producto es [APRENDER.md](https://github.com/sebinsebon/PAESSED.CL-notas/blob/main/notas/producto/APRENDER.md), con decisiones confirmadas durante la implementación.

## Probar

```powershell
npm ci
npm run prepare:gold -- C:\Users\Administrator\Desktop\paes\demre\Gold
npm run dev -- --hostname 127.0.0.1 --port 3100
```

Abrir http://127.0.0.1:3100/app/aprender. Elegir una meta de uno, dos o tres nodos; completar el diagnóstico de dieciséis preguntas y comenzar la ruta. No hace falta crear una cuenta.

El catálogo Gold 0.7 contiene nueve ensayos y 585 preguntas. Aprender utiliza las 573 clasificadas dentro del temario M1 con clave verificada; los ensayos completos conservan las doce preguntas históricas restantes. El script comprueba los hashes contra `ENTREGA_SHA256.json` y no modifica los originales. Los paquetes se sirven automáticamente por ensayo, con verificación SHA-256 antes de abrirlos. Permanecen separados de las importaciones personales.

Los binarios de terceros no se incluyen en Git: para otra instalación hay que aprovisionar esta misma entrega antes de iniciar o compilar el sitio. El catálogo y las herramientas están versionados. La clasificación `private_local` refleja que la revisión Gold acredita fidelidad técnica; la publicación pública requiere resolver por separado el registro de distribución `public_authorized` indicado por la documentación del banco.

## Comportamiento

- Diagnóstico de dieciséis preguntas, una por subeje; reanudable y sin feedback hasta su cierre.
- Nodos de cinco preguntas de un mismo subeje; primeras respuestas inmutables. Al confirmar, la alternativa correcta se marca en verde; si la elegida es incorrecta, queda roja y se destaca también la correcta en verde. Antes de confirmar no se muestra la clave.
- Corrección de los errores con dos reintentos; después se ofrece la revisión explícita de la solución. Las explicaciones del banco se identifican como provisionales o ausentes. El resultado original nunca se sustituye por el de la corrección. Los aciertos de corrección permanecen visibles hasta continuar a la siguiente pregunta.
- Tras fallar aparece «Preguntar a la IA», con animación de entrada y un resplandor breve; respeta movimiento reducido. Reutiliza el diálogo de ayuda de Ensayos y Playground, sin activar globalmente la IA ni alterar la primera respuesta o sus XP. El usuario puede revisar y copiar el prompt o abrir su proveedor elegido.
- Bloques continuos de siete posiciones: cuatro de mantenimiento y tres de refuerzo, intercaladas de manera reproducible. Los días omitidos no acumulan deuda. La meta diaria no limita la práctica.
- Mantenimiento con rotación equitativa entre cuatro ejes y sus subejes. Refuerzo exploratorio hasta reunir quince respuestas válidas por eje; después selecciona y rota debilidades con umbrales experimentales 10/30.
- Dominio por subeje ponderado con `0.95^(respuestas posteriores / 5)`; el eje es la media de sus subejes observados. La inactividad no reduce dominio. Los porcentajes son estimaciones, no puntajes PAES.
- Preguntas nuevas primero y, al agotarse, repaso señalado. No hay repetición dentro del nodo. Las preguntas repetidas o asistidas no incrementan dominio, calibración ni XP.
- Cinco XP por primera respuesta elegible al completar un nodo; racha por completar al menos uno al día. Cambios de meta efectivos al día siguiente una vez iniciado el trabajo.
- Evidencia compartida entre diagnóstico, Aprender, Playground y entregas de ensayos. La identidad utiliza el hash del PDF fuente y el número original, conservándose al reimportar un paquete.

## Datos y arquitectura

`lib/learning/` separa tipos, catálogo, motor puro, evidencia y repositorios de IndexedDB. `components/learning/` contiene ruta, diagnóstico y visor compartido; Default reutiliza ese visor con sus recursos matemáticos y lápiz.

La base local `paessed-learning` versión 1 guarda estado y sesiones Default. Las transacciones del motor conservan respuestas concurrentes de distintas pestañas; BroadcastChannel comunica cambios. Las entregas de ensayo congelan su respuesta antes de registrar evidencia y pueden terminar un registro interrumpido sin duplicarlo. La ayuda posterior a una respuesta confirmada no invalida retroactivamente esa respuesta.

El respaldo ZIP versión 2 añade Aprender y sesiones Default; los respaldos versión 1 siguen siendo legibles. Un navegador vacío puede adoptar la identidad del respaldo; un perfil con actividad de otro estudiante no se mezcla silenciosamente. Los datos corruptos se conservan y se informa el error.

El guardado es propio de este navegador: no hay autenticación real ni sincronización entre dispositivos. La segunda etapa, después de la revisión del usuario, sustituirá estos repositorios por persistencia remota manteniendo las interfaces del motor. No se ha desplegado ni publicado contenido.

## Verificación

```powershell
npm run test:learning
npm run simulate:learning
npm run test:learning-ui
npm run test:learning-integration
npx playwright test --config tests/learning-imported-viewer.config.cjs
npm run build
```

El motor cubre cuotas, rotaciones, calibración, ponderación, agotamiento, correcciones, inmutabilidad y replanificación. Las pruebas reales de IndexedDB cubren inicialización, cuarenta escrituras concurrentes desde dos pestañas, reanudación, restauración y corrupción. Las pruebas de navegador recorren el banco Gold real, diagnóstico, 3/5, corrección, cierre 5/5, móvil oscuro, teclado, error de carga y recuperación, entregas de ensayos, evidencia compartida y respaldos.

Resultados de simulación: [learning-simulation.md](learning-simulation.md). Las pruebas de interfaz guardan capturas de revisión en `tests/test-results/`, fuera de Git.

HLR, ranking, teoría guiada, explicaciones nuevas completas y base de datos remota quedan fuera de esta entrega. Los parámetros adaptativos requieren después un piloto con estudiantes; las simulaciones verifican reglas, no eficacia pedagógica.
