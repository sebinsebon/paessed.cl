# Plan móvil y acceso online — PAESSED UI/UX

**Estado:** plan propuesto. No implica que el sitio ya esté desplegado ni que se hayan terminado las correcciones responsive.

## Objetivo
Abrir el prototipo desde iPhone o Android mediante una URL HTTPS, sin consola ni `git clone`, y convertir el dashboard actual de Next.js en una interfaz verdaderamente mobile-first sin cambiar su identidad visual.

## Fase 0 — Acceso desde el celular (prioridad inmediata)
1. Conectar Vercel a la cuenta de GitHub del propietario.
2. En Vercel, importar el repositorio **privado** `sebinsebon/paesseduiux`. Usar **Next.js**, rama de producción `main` y directorio raíz `./`.
3. Ejecutar un build real y corregir cualquier error de compilación antes de afirmar que existe una URL funcional.
4. Verificar la URL HTTPS asignada desde Safari iOS y Chrome Android. `localhost:3000` no es accesible desde otro dispositivo por sí solo.
5. Si el prototipo debe ser solo para el propietario, habilitar **Vercel Authentication → All Deployments** en Deployment Protection y comprobar el acceso desde el teléfono con la cuenta autorizada. Un repositorio privado no vuelve privada automáticamente la URL publicada.
6. Confirmar que cada actualización de `main` redepliega el sitio y que las versiones de prueba no alteran PAESSED principal.

**Criterio de aceptación:** la web carga en un teléfono usando solamente una URL, y el propietario decide si exige login.

## Fase 1 — Responsive móvil
- **Shell:** barra superior ligera en móvil con logo, racha condensada, campana y tema; navegación inferior fija, accesible y con área táctil adecuada; evitar solapamientos con safe-area de iPhone.
- **Carrusel:** conservar diseño desktop actual. En móvil, una tarjeta protagonista y siguiente visible parcialmente; gesto táctil con inercia; loop realmente infinito (no solo las cuatro tarjetas con scroll de extremo a extremo), sin clic accidental al arrastrar.
- **Contenido:** misión diaria antes de meta mensual; tarjetas de progreso/aprender en una sola columna; CTA principal visible y ancho cómodo; título con tamaño fluido.
- **Últimos ensayos:** conservar las 65 respuestas: 13 × 5 en desktop; distribución móvil legible sin miniaturas ilegibles, con totales y gris explícito para omitidas. No inferir preguntas reales a partir del mock.
- **Modal y notificaciones:** modal responsive con altura máxima, scroll interno y cierre accesible; Sileo sin desbordar ni tapar la barra inferior y respetando ambos temas.
- **Accesibilidad:** controles táctiles ~44 × 44px, estados de enfoque, `prefers-reduced-motion`, contraste y etiquetas para lectores de pantalla.

## Fase 2 — QA y publicación estable
- Verificar 360px, 375px, 390px, 430px, 768px, 1024px y desktop amplio.
- Probar Safari iOS, Chrome Android y escritorio; detectar scroll horizontal global, saltos del carrusel, overlays y errores de hidratación.
- Construir con `npm install` y `npm run build` en el entorno de despliegue; verificar funcionamiento en teléfono real.
- Mantener cambios responsive en rama separada/PR; integrar en `main` después de revisar capturas light/dark y gestos.

**Nota:** los datos del prototipo siguen siendo de demostración. El contador PAES actualmente tiene días estáticos y debería vincularse a la fecha oficial verificada antes de usarlo en producción.
