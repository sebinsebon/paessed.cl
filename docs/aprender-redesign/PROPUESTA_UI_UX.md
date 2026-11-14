# Propuesta de Rediseño Visual y de Experiencia: Aprender (PAESSED M1)

> **Integración posterior:** La experiencia ya está implementada localmente en `feat/aprender`. Por petición del usuario, los nodos reales recuperan el relieve de 6–8 px de la primera propuesta. Ver [implementación, capturas y verificación](./INTEGRACION.md). Este documento conserva la referencia de diseño previa.

> **Documento de Diseño, Dirección Visual y Arquitectura de Interfaz**  
> **Estado:** Propuesta formal para revisión y aprobación previa del usuario  
> **Rama de trabajo:** `feat/aprender`  
> **Directorio exclusivo de entregables:** `docs/aprender-redesign/`  
> **Mockup interactivo autónomo:** [`propuesta.html`](./propuesta.html)  
> **Fuente local empaquetada:** [`font-plus-jakarta-sans.woff2`](./font-plus-jakarta-sans.woff2)  
> **Logos SVG locales empaquetados:** [`paessed-logo.svg`](./paessed-logo.svg) y [`paessed-logo-dark.svg`](./paessed-logo-dark.svg)

---

## 1. Diagnóstico del Estado Actual vs. Oportunidad

La primera entrega funcional de Aprender consolidó un motor determinista robusto en `lib/learning/`: persistencia en IndexedDB (`paessed-learning` v1), rotaciones 4:3 entre Mantenimiento y Refuerzo, y calibración de 15 respuestas originales por eje.

Sin embargo, en su capa de presentación ([`learning-desktop-light.png`](../aprender-ui/learning-desktop-light.png), [`learning-mobile-dark.png`](../aprender-ui/learning-mobile-dark.png)):
1. **Sensación de dashboard SaaS genérico:** El recorrido queda relegado frente a una disposición tradicional de múltiples tarjetas estáticas. En escritorio, una columna lateral con barras de progreso y tarjetas de texto compite visualmente y le resta protagonismo a la ruta.
2. **Nodos pequeños y desdibujados:** Círculos de 70px alineados con leves desplazamientos rígidos, acompañados de bloques de texto laterales que convierten el camino en un formulario por etapas en lugar de un avance continuo y motivador.
3. **Conector débil:** Un borde discontinuo delgado que carece de tridimensionalidad, peso y ritmo físico.
4. **Desajustes ergonómicos en móvil:** En viewports estrechos (390px / 430px) la cabecera en una sola fila comprime los chips de estado, quiebra títulos y desborda elementos, mientras que la barra inferior sufre recortes si no se estructura en columnas fluidas.

### La Oportunidad:
Recuperar la **auténtica identidad sobria y profesional de PAESSED**, haciendo que **la ruta serpenteante sea la protagonista real y dominante** sin caer en estéticas caricaturescas ajenas:
- Integración fiel de la estructura de navegación existente (`Sidebar` de 264px con logo SVG real y navegación completa: *Inicio, Aprender, Ensayos, Playground, Perfil*).
- Tokens de superficie exactos (`#f8fafc` / `#ffffff` / `#0f172a` en claro y `#0b1020` / `#111827` / `#f8fafc` en oscuro).
- Reemplazo de carteles chillones por una **cabecera ligera y sobria de título y progreso**.
- Nodos con presencia dominante (96px/104px en escritorio, 88px/96px en móvil) pero con **relieve moderado (3-4px)**, evitando saturaciones o brillos excesivos.
- Cabecera móvil en dos filas fluidas y barra inferior de 5 columnas fluidas (ancho 100%, margen cero) que garantizan legibilidad y cero recortes.

---

## 2. Referencias Visuales Oficiales Verificadas de Duolingo

Se examinaron las publicaciones oficiales y recursos verificados del equipo de diseño de Duolingo:

1. **Nuevo Diseño de Pantalla Principal y Recorrido Lineal:**
   * *Referencia oficial:* [Duolingo Blog: Empowering learners through our new home screen design](https://blog.duolingo.com/new-duolingo-home-screen-design/)
   * *Concepto:* Sustitución de árboles dispersos por un camino lineal guiado. El usuario no sufre parálisis de elección: el sistema programa de forma continua e intercalada las sesiones de aprendizaje, mantenimiento y repaso espaciado.
2. **Hub Oficial de Diseño de Duolingo:**
   * *Referencia oficial:* [Duolingo Design Hub](https://blog.duolingo.com/hub/design/)
   * *Concepto:* Principios de gamificación aplicada al aprendizaje: botones con extrusión tridimensional (borde inferior sólido de impacto), microinteracciones táctiles de compresión física (`active: translateY`), estados claros de completitud y señalizadores de foco en el paso actual.

### 2.1 Identidad Propia PAESSED: Sin Copiar Mascotas ni Recursos Ajenos
PAESSED no es una aplicación de idiomas con personajes caricaturescos. Es una plataforma orientada a la **Prueba de Acceso a la Educación Superior (PAES)** en Chile.
- **Tono y Personalidad:** Enfoque preuniversitario, confianza, claridad metodológica y ritmo ágil de entrenamiento.
- **Paleta de Identidad (`DESIGN.md` & `app/globals.css`):**
  - **Naranja PAESSED Primario (`#F97316` / `#EA580C`):** Reservado estrictamente para la sesión activa, foco de avance y botones táctiles principales de acción (CTA), con base de pulsación en `#C2410C`.
  - **Índigo / Violeta Académico (`#6366F1` / `#4F46E5`):** Mantenimiento de conceptos M1, insignias curriculares y rigor matemático.
  - **Esmeralda de Maestría (`#10B981` / `#059669`):** Retenido estrictamente para sesiones completadas y respuestas correctas.
  - **Rojo Coral (`#EF4444` / `#DC2626`):** Señalización constructiva de errores durante la práctica.
  - **Lienzo Limpio (`#F8FAFC` en claro, `#0B1020` en oscuro):** Fondo donde los nodos destacan con relieve natural.
- **Tipografía Oficial:** **Plus Jakarta Sans**, servida localmente mediante [`font-plus-jakarta-sans.woff2`](./font-plus-jakarta-sans.woff2) (sin dependencias de Google Fonts), con pesos `800` para cifras tabulares y `600`/`700` para lectura clara de problemas.

---

## 3. Arquitectura del Recorrido: Siete Sesiones Reales (4:3)

### 3.1 Las Siete Posiciones son Siete Sesiones Reales
De acuerdo con la especificación de producto (`docs/APRENDER.md`), el ciclo continuo se compone de **bloques de 7 sesiones de 5 preguntas cada una**:
- **4 sesiones de Mantenimiento (M):** Rotación equitativa entre los 4 ejes temáticos de M1 (Números, Álgebra y Funciones, Geometría, Probabilidad y Estadística) y sus respectivos subejes.
- **3 sesiones de Refuerzo (R):** Exploratorio hasta reunir 15 respuestas por eje; después, priorización adaptativa sobre debilidades detectadas (umbrales experimentales 10/30).

> [!IMPORTANT]
> Las 7 posiciones de la ruta son **7 sesiones de aprendizaje completas**. Ningún cofre ni hito decorativo sustituye a la séptima sesión. Un hito o bandera de cierre de bloque se sitúa como marcador decorativo independiente al concluir las 7 sesiones del ciclo.

### 3.2 Previsiones Adaptativas Futuras (Sin Candados Artificiales)
Los nodos futuros en la cola no representan "niveles bloqueados con llave" ni prerrequisitos curriculares rígidos; son **previsiones algorítmicas adaptativas** de las siguientes sesiones de la cola 4:3.
- Visualmente se representan en tonos neutros táctiles (`var(--surface)` con borde sobrio `var(--border-strong)` y base de 3px), identificando su tipo (`M` o `R`) y su eje temático previsto.
- Al pulsar una sesión futura, la interfaz informa con amabilidad su contenido previsto y recuerda que se activará automáticamente al completar el paso previo.

### 3.3 Nodos con Presencia Dominante y Relieve Moderado (3-4px)
Para asegurar presencia dominante sin caer en excesos arcade:
- **Dimensiones en Escritorio:**
  - Nodos regulares (completados y próximos): **96px de diámetro**.
  - Nodo activo (foco actual): **104px de diámetro**, coronado por un bocadillo animado ("CONTINÚA AQUÍ").
- **Dimensiones en Móvil (390px / 430px):**
  - Nodos regulares: **88px de diámetro**.
  - Nodo activo: **96px de diámetro**.
- **Relieve Moderado:** Borde inferior sólido de extrusión de **3px a 4px** (`box-shadow: 0 4px 0 0 [pressed-color]`). Al presionar, el nodo desciende 2px con reducción de sombra a 1-2px, entregando una respuesta física táctil limpia y sutil.
- **Insignia M/R:** Mini-medallón superior derecho (28px) con `M` en azul índigo (`#6366F1`) o `R` en ámbar (`#D97706`).

---

## 4. Composición de Pantalla y Navegación Real de PAESSED

### 4.1 Escritorio (≥ 1024px)
- **Sidebar Real de PAESSED (264px de ancho):**
  - Logotipo vectorial oficial (`paessed-logo.svg` en claro, `paessed-logo-dark.svg` en oscuro) con subtítulo *"MATEMÁTICA M1"*.
  - Navegación coherente con iconos outline de Lucide:
    * **Inicio** (`Home`)
    * **Aprender** (`Route` / `CircleDot`, con badge *"Ruta"* y estado activo en naranja `#F97316`)
    * **Ensayos** (`Trophy`)
    * **Playground** (`Gamepad2`)
    * **Perfil** (`UserRound`)
  - Widget inferior de *"Meta del mes"* (ej. 780 pts M1).
- **Ruta Dominante:** Ocupa el centro visual completo de la pantalla (640px de ancho) sin columnas laterales de tarjetas que compitan por la atención.
- **Cabecera Ligera y Sobria:** Reemplaza al gran banner naranja por una tarjeta blanca/superficie limpia (`learning-header-clean`) con subtítulo del bloque, título de la unidad M1, barra de progreso delgada (7px) y conteo (*"Paso 4 de 7 · 3 completados"*).

### 4.2 Móvil y Tablet (< 1024px, 390px / 430px / 768px)
- **Topbar en Dos Filas Flexibles:**
  - **Fila 1:** Logo oficial de PAESSED a la izquierda (`height: 20px`) y subtítulo de eje.
  - **Fila 2:** Fila horizontal de chips compactos (Racha, Meta diaria, XP, botón *Mapa M1*), con iconos outline coherentes (sin emojis de plataforma) y margen suficiente para evitar cortes.
- **Barra de Navegación Inferior Flotante (5 Columnas Fluidas):**
  - Ocupa el 100% del ancho móvil (`left: 0; right: 0; margin: 0;`).
  - Distribuida en 5 columnas simétricas mediante CSS Grid (`grid-template-columns: repeat(5, 1fr)`): *Inicio, Aprender, Ensayos, Playground, Perfil*.
  - Elimina anchos fijos conflictivos (`min-width: 58px`), asegurando que la opción *Perfil* y todas las etiquetas queden perfectamente visibles y centradas sin importar el ancho del smartphone.

---

## 5. Taxonomía Curricular Real y Tratamiento de Calibración

### 5.1 Taxonomía Oficial M1 (`lib/m1-curriculum.ts`)
El temario oficial M1 consta de **16 subejes** distribuidos en 4 ejes temáticos:
1. **Números:** **3 subejes** (demostración: *3 de 3 subejes observados*).
2. **Álgebra y Funciones:** **6 subejes** (demostración: *3 de 6 subejes observados*).
3. **Geometría:** **4 subejes** (demostración: *2 de 4 subejes observados*).
4. **Probabilidad y Estadística:** **3 subejes** (demostración: *2 de 3 subejes observados*).

### 5.2 Calibración a 15 Respuestas y Tono Editorial Humano
En la interfaz visual (drawer y simulador) se adopta un tono amigable y directo hacia el estudiante:
- **Copy Humano:**
  - *"Cada eje se calibra al reunir 15 respuestas originales. Mientras tanto, verás una estimación provisional que se afina con tu práctica. Tus primeras respuestas cuentan."*
  - Se eliminaron términos internos como "criterio estadístico", "respuestas inmutables" o fórmulas algebraicas de decaimiento ($0.95^{\frac{\text{posteriores}}{5}}$). Esas especificaciones matemáticas se conservan exclusivamente en este documento técnico.
- **Provisionales en Gris Neutro:**
  - Los ejes que aún no reúnen 15 respuestas válidas (Álgebra 11/15, Geometría 8/15, Probabilidades 6/15) muestran su porcentaje y barra de avance estrictamente en **gris neutro** (`--muted` / `#64748B`), rotulados como *En calibración · faltan X respuestas*.
  - Solo el eje que alcanza o supera 15 respuestas (Números 18/15) se ilumina en color verde de maestría (`--success`) con el distintivo *Calibrado*.

---

## 6. Realidad del Banco DEMRE y Visor de Preguntas

El catálogo Gold M1 contiene 573 preguntas con clave oficial verificada por DEMRE:
- 451 preguntas no cuentan con explicación en el banco ("ausentes").
- 122 preguntas cuentan con explicaciones provisionales ("provisionales").

### En la Interfaz del Estudiante:
- No se abruma al usuario con conteos técnicos globales (451/122).
- Durante la sesión, si una pregunta requiere revisión tras la corrección, la interfaz señala con transparencia:
  > *"Clave oficial verificada DEMRE: [Alternativa]. Explicación no disponible o provisional según el banco oficial."*
- **Simulador de Demostración:** Se rotula explícitamente como *Vista previa de pregunta (demo sin persistencia)* para no inducir a error respecto a guardado real en base de datos.

---

## 7. Accesibilidad y Ergonomía

1. **Objetivos Táctiles (Touch Targets):**
   - Diámetro de nodos: 88px a 104px (muy superior al estándar de 48px).
   - Botones de acción y alternativas: altura mínima de 50px con espaciado generoso.
2. **Iconografía Coherente:**
   - Se reemplazaron emojis de plataforma por iconos vectoriales outline coherentes con el diseño de la aplicación.
3. **Reducción de Movimiento (`prefers-reduced-motion`):**
   - Si el sistema solicita movimiento reducido, todas las animaciones continuas (flotación de bocadillo, halo de pulsación) se suspenden instantáneamente.
4. **Independencia de Red:**
   - `propuesta.html` enlaza la fuente local `font-plus-jakarta-sans.woff2` y los logos vectoriales locales sin requerir conexión a servicios externos.

---

*Fin del documento de propuesta visual y de experiencia PAESSED.*
