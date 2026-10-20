/* Temas de demostración adicionales. No son preguntas oficiales ni contenido GOLD. */
(function(){
  const newSkills=[
    ['potencias_raices','Potencias y raíces','Potencias','Números',1,'√','#e89e1e','Potencias, radicales y propiedades'],
    ['expresiones','Expresiones algebraicas','Expresiones','Álgebra y funciones',2,'a²','#7765d7','Productos notables y factorización'],
    ['proporcionalidad','Proporcionalidad','Proporciones','Álgebra y funciones',2,'∝','#6563db','Razones y proporcionalidad directa e inversa'],
    ['sistemas','Sistemas 2×2','Sistemas','Álgebra y funciones',2,'2×2','#6e64c8','Dos ecuaciones y dos incógnitas'],
    ['cuadratica','Función cuadrática','Cuadrática','Álgebra y funciones',2,'x²','#6655c8','Raíces, vértice y parábolas'],
    ['cuerpos','Cuerpos geométricos','Cuerpos','Geometría',3,'▣','#189cc8','Superficie y volumen'],
    ['transformaciones','Transformaciones','Movimientos','Geometría',3,'↗','#128cbe','Traslación, reflexión y rotación'],
    ['semejanza','Semejanza de figuras','Semejanza','Geometría',3,'△','#238dba','Escalas y lados proporcionales'],
    ['medidas_posicion','Medidas de posición','Cuartiles','Probabilidad y estadística',4,'▥','#0b9683','Cuartiles, percentiles y diagramas de caja']
  ];
  window.PAES_SKILLS.push(...newSkills.map(([id,title,short,axis,unit,icon,color,description])=>({id,title,short,axis,unit,icon,color,description})));
  // [enunciado, alternativas, clave 0-3, explicación, pista].
  const bank={
    potencias_raices:[
      ['¿Cuánto es 2³ × 2²?',['16','25','32','64'],2,'Al multiplicar potencias de la misma base se suman exponentes: 2⁵ = 32.','Suma los exponentes.'],
      ['¿Cuál es la raíz cuadrada principal de 81?',['8','9','-9','18'],1,'9 × 9 = 81; la raíz cuadrada principal es no negativa.','Busca un cuadrado perfecto.'],
      ['¿Cuánto vale 3⁰?',['0','1','3','9'],1,'Toda base distinta de cero elevada a cero vale 1.','Recuerda la propiedad del exponente cero.'],
      ['Calcula √49 + 2.',['7','8','9','11'],2,'La raíz de 49 es 7; 7 + 2 = 9.','Calcula la raíz primero.'],
      ['Simplifica 4³ ÷ 4².',['1','2','4','16'],2,'Al dividir potencias de igual base restas exponentes: 4¹ = 4.','Resta los exponentes.'],
      ['¿Cuánto es √(16 × 9)?',['6','12','18','25'],1,'16 × 9 = 144 y √144 = 12.','Calcula el producto.']
    ],
    expresiones:[
      ['Reduce 2x + 3x.',['5x','6x','5x²','x'],0,'Se suman los coeficientes de términos semejantes: 2x + 3x = 5x.','Ambos términos contienen x.'],
      ['Desarrolla (x + 2)(x − 2).',['x² + 4','x² − 4','x² − 2','2x²'],1,'Es una diferencia de cuadrados: x² − 2² = x² − 4.','Aplica suma por diferencia.'],
      ['Factoriza x² + 4x + 4.',['(x + 4)²','(x − 2)²','(x + 2)²','x(x + 4)'],2,'Es trinomio cuadrado perfecto: x² + 2·x·2 + 2² = (x + 2)².','Reconoce un cuadrado de binomio.'],
      ['Factoriza x² − 9.',['(x − 9)(x + 1)','(x − 3)²','(x + 3)²','(x − 3)(x + 3)'],3,'La diferencia de cuadrados se escribe (x − 3)(x + 3).','9 es 3².'],
      ['Simplifica 3(x + 2) − 2x.',['x + 6','5x + 6','x + 2','3x + 4'],0,'Distribuye: 3x + 6 − 2x = x + 6.','Distribuye el 3 y reúne x.'],
      ['¿Cuál es el cuadrado de 2x?',['2x²','4x','4x²','x² + 4'],2,'(2x)² = 2²·x² = 4x².','Eleva también el coeficiente.']
    ],
    proporcionalidad:[
      ['Si 3 cuadernos cuestan $6.000, ¿cuánto cuestan 5 iguales?',['$8.000','$10.000','$12.000','$15.000'],1,'Cada cuaderno cuesta $2.000, así que cinco cuestan $10.000.','Calcula el valor unitario.'],
      ['Si 4 personas tardan 6 horas en una tarea, ¿cuánto tardan 8 al mismo ritmo?',['3 horas','6 horas','9 horas','12 horas'],0,'Al duplicar trabajadores se reduce a la mitad el tiempo: 3 horas.','Es proporcionalidad inversa.'],
      ['En una receta, 2 tazas de harina requieren 3 huevos. ¿Cuántos huevos para 4 tazas?',['3','4','6','8'],2,'Duplicar la harina duplica también los huevos: 6.','Mantén la razón.'],
      ['Un mapa tiene escala 1:100. Si una distancia mide 3 cm en el mapa, ¿cuánto mide en realidad?',['3 cm','30 cm','300 cm','300 m'],2,'3 × 100 = 300 cm, equivalentes a 3 m.','Multiplica por el factor de escala.'],
      ['Un automóvil recorre 150 km en 3 horas a rapidez constante. ¿Cuánto recorre en 1 hora?',['30 km','45 km','50 km','75 km'],2,'150 ÷ 3 = 50 km por hora.','Divide distancia entre tiempo.'],
      ['Si 10 trabajadores tardan 4 días, ¿cuántos días tardan 5 con igual productividad?',['2','4','6','8'],3,'Con la mitad de trabajadores el trabajo tarda el doble: 8 días.','Más trabajadores implica menos días.']
    ],
    sistemas:[
      ['Si x + y = 7 y x − y = 1, ¿cuánto vale x?',['2','3','4','5'],2,'Al sumar las ecuaciones queda 2x = 8, por tanto x = 4.','Suma ambas ecuaciones.'],
      ['Si 2x + y = 8 y x + y = 5, ¿cuánto vale y?',['1','2','3','4'],1,'Restar la segunda ecuación da x = 3; entonces y = 5 − 3 = 2.','Resta para encontrar x.'],
      ['Si x + y = 9 y y = 4, ¿cuánto vale x?',['4','5','9','13'],1,'Sustituye y = 4: x + 4 = 9, así que x = 5.','Reemplaza la variable conocida.'],
      ['Si 3a + b = 11 y a + b = 5, ¿cuánto vale a?',['2','3','4','6'],1,'Al restar las ecuaciones resulta 2a = 6, de modo que a = 3.','Elimina b mediante resta.'],
      ['Si x + y = 6 y 2x + y = 10, ¿cuánto vale x?',['2','3','4','6'],2,'Restar la primera ecuación de la segunda deja x = 4.','Resta las ecuaciones.'],
      ['Dos entradas de adulto y una infantil cuestan $5.000; una de cada una cuesta $3.000. ¿Precio de la adulta?',['$1.000','$1.500','$2.000','$3.000'],2,'Restando los totales, una entrada adulta cuesta $2.000.','Resta la compra menor de la mayor.']
    ],
    cuadratica:[
      ['¿Cuáles son las soluciones de x² − 9 = 0?',['-3 y 3','0 y 9','solo 3','-9 y 9'],0,'x² = 9 tiene las dos soluciones x = −3 y x = 3.','Despeja x².'],
      ['¿Cuál es el vértice de y = (x − 2)² + 1?',['(−2,1)','(2,1)','(1,2)','(2,−1)'],1,'En forma de vértice y = (x − h)² + k, el vértice es (h,k) = (2,1).','Lee h y k de la expresión.'],
      ['Si f(x) = x² − 4x + 3, ¿cuánto es f(0)?',['0','-4','3','7'],2,'Sustituyendo x = 0 queda f(0) = 3.','Reemplaza x por cero.'],
      ['¿Cuáles son las raíces de x² − 5x + 6 = 0?',['1 y 6','−2 y −3','−1 y −6','2 y 3'],3,'Se factoriza como (x − 2)(x − 3), por eso x = 2 o x = 3.','Busca dos números cuyo producto sea 6 y suma 5.'],
      ['Si el coeficiente de x² es negativo, ¿hacia dónde abre la parábola?',['Arriba','Abajo','Izquierda','Derecha'],1,'El coeficiente principal negativo hace que la parábola abra hacia abajo.','Observa el signo de a.'],
      ['¿Cuál es el discriminante de x² − 4x + 4 = 0?',['-4','4','0','16'],2,'b² − 4ac = (−4)² − 4·1·4 = 16 − 16 = 0.','Usa b² − 4ac.']
    ],
    cuerpos:[
      ['¿Cuál es el volumen de un prisma de 2 cm × 3 cm × 4 cm?',['9 cm³','12 cm³','24 cm³','48 cm³'],2,'Volumen = largo × ancho × alto = 2 × 3 × 4 = 24 cm³.','Multiplica las tres dimensiones.'],
      ['¿Cuál es el área total de un cubo de arista 4 cm?',['16 cm²','64 cm²','96 cm²','128 cm²'],2,'Tiene 6 caras de 4 × 4 = 16 cm²; 6 × 16 = 96 cm².','Cuenta las seis caras.'],
      ['Un cilindro tiene radio 2 cm y altura 3 cm. Su volumen es…',['6π cm³','12π cm³','18π cm³','36π cm³'],1,'V = πr²h = π × 4 × 3 = 12π cm³.','Recuerda πr² por altura.'],
      ['Si se duplica la arista de un cubo, su volumen se multiplica por…',['2','4','6','8'],3,'El volumen depende del cubo de la escala: 2³ = 8.','El volumen depende de tres dimensiones.'],
      ['¿Cuál es el área total de un cubo de arista 3 cm?',['18 cm²','27 cm²','36 cm²','54 cm²'],3,'Área = 6 × 3² = 54 cm².','Seis caras cuadradas.'],
      ['Un cilindro cerrado tiene radio 3 cm y altura 2 cm. Su área total es…',['12π cm²','18π cm²','24π cm²','30π cm²'],3,'Área total = 2πrh + 2πr² = 12π + 18π = 30π cm².','Suma superficie lateral y las dos bases.']
    ],
    transformaciones:[
      ['Trasladar (1,2) mediante el vector (3,−1) da…',['(4,1)','(3,2)','(−2,3)','(1,−2)'],0,'Sumas cada coordenada: (1+3, 2−1) = (4,1).','Suma coordenadas.'],
      ['La reflexión del punto (2,−3) respecto del eje x es…',['(−2,−3)','(−2,3)','(2,3)','(3,2)'],2,'Reflejar en el eje x cambia el signo de y y conserva x.','Cambia la segunda coordenada.'],
      ['La reflexión de (−4,1) respecto del eje y es…',['(−4,−1)','(4,1)','(1,−4)','(4,−1)'],1,'En el eje y se invierte el signo de x: (4,1).','Cambia la primera coordenada.'],
      ['Rotar (1,0) 90° en sentido antihorario en torno al origen da…',['(−1,0)','(0,−1)','(1,1)','(0,1)'],3,'Una rotación de 90° antihoraria lleva el eje x positivo al y positivo.','Piensa en un cuarto de vuelta.'],
      ['¿Qué magnitud conserva siempre una traslación?',['Las distancias','La coordenada x','La coordenada y','El punto de origen'],0,'Una traslación es isometría y conserva las distancias.','Las figuras mantienen su tamaño.'],
      ['Rotar (2,−1) 180° alrededor del origen da…',['(2,1)','(−2,−1)','(−2,1)','(1,−2)'],2,'Una media vuelta transforma (x,y) en (−x,−y).','Cambia ambos signos.']
    ],
    semejanza:[
      ['Dos lados correspondientes miden 3 cm y 6 cm. ¿Cuál es el factor de escala del pequeño al grande?',['1/2','2','3','6'],1,'El factor de escala es 6 ÷ 3 = 2.','Divide lado final por lado inicial.'],
      ['Si la escala de longitud es 2, el área se multiplica por…',['2','3','4','8'],2,'Las áreas cambian con el cuadrado del factor: 2² = 4.','Eleva el factor al cuadrado.'],
      ['Si un modelo está a escala 1:50 y mide 4 cm, ¿cuánto mide el objeto real?',['50 cm','100 cm','200 cm','400 cm'],2,'4 cm × 50 = 200 cm = 2 m.','Multiplica por cincuenta.'],
      ['Un triángulo de lados 3, 4 y 5 se amplía al doble. Sus lados nuevos son…',['5,6,7','6,8,10','3,8,10','9,12,15'],1,'Multiplicas cada lado por 2: 6, 8 y 10.','Aplica el mismo factor a todos los lados.'],
      ['Si una figura se amplía por un factor de 3, su perímetro se multiplica por…',['3','6','9','27'],0,'El perímetro es suma de longitudes y se multiplica por el mismo factor 3.','El perímetro escala linealmente.'],
      ['Una longitud pasa de 2 cm a 8 cm en figuras semejantes. ¿Factor de escala?',['2','3','4','6'],2,'El factor de escala es 8 ÷ 2 = 4.','Compara las longitudes correspondientes.']
    ],
    medidas_posicion:[
      ['¿Qué medida corresponde al percentil 50 de un conjunto de datos?',['Moda','Mediana','Máximo','Promedio'],1,'El percentil 50 coincide con la mediana bajo las convenciones habituales.','Divide los datos ordenados por la mitad.'],
      ['Si Q1 = 5 y Q3 = 12, ¿cuál es el rango intercuartílico?',['5','7','12','17'],1,'Rango intercuartílico = Q3 − Q1 = 12 − 5 = 7.','Resta el primer cuartil al tercero.'],
      ['¿Qué porcentaje de datos queda aproximadamente bajo el primer cuartil?',['10%','25%','50%','75%'],1,'El primer cuartil es el percentil 25.','Los cuartiles dividen en cuatro partes.'],
      ['En un diagrama de caja, ¿qué representa la línea dentro de la caja?',['Mínimo','Mediana','Máximo','Moda'],1,'La línea interior suele representar la mediana (Q2).','Es el segundo cuartil.'],
      ['Si Q1 = 10 y Q3 = 18, ¿cuánto mide la caja en el diagrama?',['4','8','10','28'],1,'La longitud de la caja es el rango intercuartílico: 18 − 10 = 8.','Busca Q3 menos Q1.'],
      ['El percentil 75 indica que aproximadamente…',['75% de los datos son mayores','25% de los datos son menores','75% de los datos son menores o iguales','Todos son iguales'],2,'Por la definición usual, cerca del 75% de observaciones queda en ese valor o por debajo.','Imagina cien observaciones ordenadas.']
    ]
  };
  const questions=Object.entries(bank).flatMap(([skill,rows])=>rows.map((row,index)=>({id:skill+'-'+(index+1),skill,question:row[0],options:row[1],answer:row[2],explanation:row[3],hint:row[4],difficulty:index<2?1:index<4?2:3})));
  window.PAES_QUESTIONS.push(...questions);
})();