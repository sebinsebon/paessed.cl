/* Banco original de demostración. No son preguntas oficiales DEMRE. */
window.PAES_SKILLS = [
  {id:'enteros', title:'Números enteros', short:'Enteros', axis:'Números', unit:1, icon:'±', color:'#f97316', description:'Operaciones, signos y orden'},
  {id:'fracciones', title:'Fracciones y racionales', short:'Fracciones', axis:'Números', unit:1, icon:'½', color:'#fb923c', description:'Fracciones y números decimales'},
  {id:'porcentajes', title:'Porcentajes cotidianos', short:'Porcentajes', axis:'Números', unit:1, icon:'%', color:'#f59e0b', description:'Descuentos, aumentos y proporciones'},
  {id:'ecuaciones', title:'Ecuaciones de primer grado', short:'Ecuaciones', axis:'Álgebra y funciones', unit:2, icon:'x', color:'#6366f1', description:'Despejar incógnitas y resolver problemas'},
  {id:'funciones', title:'Funciones y gráficos', short:'Funciones', axis:'Álgebra y funciones', unit:2, icon:'ƒ', color:'#818cf8', description:'Interpretar pendientes y evaluar funciones'},
  {id:'geometria', title:'Geometría esencial', short:'Geometría', axis:'Geometría', unit:3, icon:'△', color:'#0ea5e9', description:'Áreas, perímetros y Pitágoras'},
  {id:'estadistica', title:'Estadística y datos', short:'Estadística', axis:'Probabilidad y estadística', unit:4, icon:'▥', color:'#14b8a6', description:'Promedio, mediana y lectura de datos'},
  {id:'probabilidad', title:'Probabilidad', short:'Probabilidad', axis:'Probabilidad y estadística', unit:4, icon:'◈', color:'#10b981', description:'Eventos y cálculo de probabilidades'}
];
// [Enunciado, [alternativas], alternativa correcta (0-3), explicación, pista]
const BANK = {
 enteros:[
 ['¿Cuál es el resultado de −7 + 12?', ['−19','−5','5','19'],2,'Desde −7 avanzas 12 unidades a la derecha: llegas a 5.','Dibuja la recta numérica.'],
 ['Calcula 6 − (−4).',['2','−2','10','−10'],2,'Restar un negativo equivale a sumar: 6 + 4 = 10.','Dos signos negativos seguidos cambian a suma.'],
 ['¿Cuál número es menor?',['−2','0','−9','3'],2,'Entre números negativos, el que está más lejos de cero es menor: −9.','Piensa en la recta numérica.'],
 ['Resuelve −3 × (−5).',['−15','15','−8','8'],1,'El producto de dos negativos es positivo: 3 × 5 = 15.','¿Qué signo resulta de negativo por negativo?'],
 ['Calcula 18 ÷ (−6).',['−3','3','−12','12'],0,'Positivo dividido por negativo da negativo: 18 ÷ 6 = 3, entonces −3.','Revisa primero el signo.'],
 ['¿Cuánto vale |−11| − 4?',['−15','−7','7','15'],2,'El valor absoluto de −11 es 11; 11 − 4 = 7.','El valor absoluto representa distancia al cero.']
 ],
 fracciones:[
 ['¿Cuánto es 1/2 + 1/4?',['2/6','3/4','1/8','1/4'],1,'1/2 equivale a 2/4, así que 2/4 + 1/4 = 3/4.','Busca denominador común.'],
 ['¿Cuánto es 3/5 de 20?',['8','10','12','15'],2,'20 ÷ 5 = 4 y 4 × 3 = 12.','Divide por el denominador y multiplica por el numerador.'],
 ['¿Cuál es equivalente a 0,75?',['1/4','2/3','3/4','4/5'],2,'0,75 = 75/100 = 3/4 después de simplificar.','Escribe 75 centésimos.'],
 ['Calcula 2/3 × 3/4.',['1/2','5/7','6/7','2'],0,'Multiplicas numeradores y denominadores: 6/12 = 1/2.','Multiplicación directa y simplificación.'],
 ['¿Qué fracción es mayor?',['2/5','1/2','3/8','1/4'],1,'1/2 = 0,5; las otras son 0,4; 0,375 y 0,25.','Convierte a decimales.'],
 ['¿Cuánto vale 5/6 − 1/3?',['2/3','4/3','1/2','1/3'],2,'1/3 = 2/6; 5/6 − 2/6 = 3/6 = 1/2.','Usa denominador 6.']
 ],
 porcentajes:[
 ['¿Cuánto es el 20% de 150?',['15','20','30','50'],2,'20% = 1/5, y 150 ÷ 5 = 30.','20% es la quinta parte.'],
 ['Una polera de $20.000 tiene 25% de descuento. ¿Cuál es su precio final?',['$5.000','$10.000','$15.000','$18.000'],2,'25% de 20.000 son 5.000; 20.000 − 5.000 = 15.000.','Calcula el descuento antes de restarlo.'],
 ['Un valor sube de 40 a 50. ¿En qué porcentaje aumentó?',['10%','20%','25%','50%'],2,'El aumento fue 10 respecto del valor inicial 40: 10/40 = 25%.','Divide el cambio por el valor original.'],
 ['¿Qué número tiene 10% igual a 7?',['0,7','17','70','700'],2,'Si una décima parte vale 7, el total es 7 × 10 = 70.','10% equivale a 1/10.'],
 ['¿Cuánto es el 50% del 30% de 200?',['15','30','60','100'],1,'30% de 200 = 60; la mitad de 60 es 30.','Aplica un porcentaje y luego el otro.'],
 ['Un producto de $8.000 aumenta 15%. ¿Cuál es el nuevo precio?',['$8.150','$9.000','$9.200','$9.500'],2,'15% de 8.000 = 1.200; 8.000 + 1.200 = 9.200.','15% = 10% + 5%.']
 ],
 ecuaciones:[
 ['Si 3x + 5 = 20, ¿cuánto vale x?',['3','5','7','15'],1,'3x = 20 − 5 = 15, entonces x = 15/3 = 5.','Resta 5 de ambos lados.'],
 ['Resuelve 2(x − 3) = 10.',['2','5','8','13'],2,'Divide por 2: x − 3 = 5; luego x = 8.','Primero elimina el factor 2.'],
 ['Si x/4 = 7, ¿cuánto vale x?',['3','11','21','28'],3,'Multiplica ambos lados por 4: x = 28.','Deshaz la división por cuatro.'],
 ['Si 5x = 2x + 18, entonces x = …',['3','6','9','18'],1,'5x − 2x = 18, por tanto 3x = 18 y x = 6.','Agrupa las x en un lado.'],
 ['El triple de un número menos 4 es 11. ¿Cuál es?',['3','5','7','11'],1,'3x − 4 = 11; 3x = 15; x = 5.','Traduce las palabras a una ecuación.'],
 ['Resuelve 4 − x = −2.',['−6','−2','2','6'],3,'Restar 4 da −x = −6; al multiplicar por −1, x = 6.','Aísla −x y cambia los signos.']
 ],
 funciones:[
 ['Si f(x) = 2x + 3, ¿cuánto es f(4)?',['7','8','11','14'],2,'Sustituye x = 4: 2 × 4 + 3 = 11.','Reemplaza la x por 4.'],
 ['La función y = 3x − 2 tiene pendiente…',['−2','1','2','3'],3,'En y = mx + b, la pendiente es el coeficiente m: 3.','Busca el número que multiplica a x.'],
 ['¿En qué punto corta al eje y la recta y = 2x + 5?',['(5,0)','(0,5)','(0,2)','(2,0)'],1,'En el eje y, x = 0; entonces y = 5 y el punto es (0,5).','En el eje vertical, x vale cero.'],
 ['Si f(x) = x² − 1, ¿cuánto es f(−3)?',['−10','−8','6','8'],3,'(−3)² = 9; 9 − 1 = 8.','Recuerda elevar el número negativo entre paréntesis.'],
 ['Una tarifa fija de $1.000 más $500 por km se modela mediante…',['f(x)=1000x+500','f(x)=500x+1000','f(x)=1500x','f(x)=500+x'],1,'Cada kilómetro agrega 500x; el cobro inicial es 1.000.','Distingue costo fijo y costo variable.'],
 ['¿Cuál de estas funciones es decreciente?',['y=4x+1','y=2x','y=−3x+2','y=x+5'],2,'Una recta decrece si su pendiente es negativa; aquí −3.','Busca una pendiente menor que cero.']
 ],
 geometria:[
 ['Un triángulo de base 8 cm y altura 5 cm tiene área…',['13 cm²','20 cm²','40 cm²','80 cm²'],1,'Área = base × altura ÷ 2 = 8 × 5 ÷ 2 = 20 cm².','No olvides dividir entre dos.'],
 ['Un cuadrado de lado 6 cm tiene perímetro…',['12 cm','24 cm','36 cm','48 cm'],1,'El perímetro suma sus cuatro lados: 4 × 6 = 24 cm.','Perímetro es la distancia alrededor.'],
 ['Un triángulo rectángulo tiene catetos 3 y 4. ¿Su hipotenusa?',['5','6','7','12'],0,'Por Pitágoras: c² = 3² + 4² = 25; c = 5.','Usa a² + b² = c².'],
 ['¿Cuántos grados suman los ángulos interiores de un triángulo?',['90°','180°','270°','360°'],1,'La suma de los tres ángulos interiores es 180°.','Imagina los tres ángulos formando una línea recta.'],
 ['Un rectángulo de lados 7 cm y 4 cm tiene área…',['11 cm²','22 cm²','28 cm²','49 cm²'],2,'Área del rectángulo = largo × ancho = 7 × 4 = 28 cm².','Multiplica las dos medidas.'],
 ['Un cubo de arista 3 cm tiene volumen…',['9 cm³','18 cm³','27 cm³','36 cm³'],2,'El volumen de un cubo es arista³: 3³ = 27 cm³.','Volumen: largo × ancho × alto.']
 ],
 estadistica:[
 ['Calcula el promedio de 4, 6 y 8.',['5','6','7','8'],1,'(4 + 6 + 8) ÷ 3 = 18 ÷ 3 = 6.','Suma y divide por el número de datos.'],
 ['¿Cuál es la mediana de 2, 3, 7, 9 y 12?',['3','7','9','12'],1,'Los datos ya están ordenados; el valor central (tercero) es 7.','Busca el valor que queda al medio.'],
 ['¿Cuál es la moda de 1, 2, 2, 4, 5?',['1','2','4','5'],1,'La moda es el valor más frecuente; 2 aparece dos veces.','Moda es frecuencia, no promedio.'],
 ['Si las edades son 12, 14, 16 y 18, el rango es…',['4','6','8','15'],1,'Rango = máximo − mínimo = 18 − 12 = 6.','Resta el menor al mayor.'],
 ['En una tabla, lunes 5, martes 8 y miércoles 7 libros. ¿Total?',['15','18','20','21'],2,'Se suman las frecuencias: 5 + 8 + 7 = 20.','Total = suma de cada categoría.'],
 ['¿Cuál es la mediana de 2, 4, 6 y 10?',['4','5','6','5,5'],1,'Con cuatro datos, promedia los dos centrales: (4 + 6)/2 = 5.','Hay dos números en el centro.']
 ],
 probabilidad:[
 ['Al lanzar un dado justo, ¿P(obtener 6)?',['1/2','1/3','1/6','1/12'],2,'Hay 1 caso favorable entre 6 posibles: 1/6.','Probabilidad = favorables ÷ posibles.'],
 ['En una bolsa hay 3 rojas y 2 azules. ¿P(roja)?',['2/5','3/5','1/3','3/2'],1,'Hay 3 rojas de un total de 5: probabilidad 3/5.','Cuenta primero el total.'],
 ['Al lanzar una moneda justa, ¿P(cara)?',['0','1/4','1/2','1'],2,'La moneda tiene dos resultados equiprobables: cara y sello.','Uno de dos resultados.'],
 ['Si P(A) = 0,3, ¿cuál es P(no A)?',['0,3','0,5','0,7','1,3'],2,'Un evento y su complemento suman 1: 1 − 0,3 = 0,7.','Usa la regla del complemento.'],
 ['En un dado, ¿P(obtener un número par)?',['1/6','1/3','1/2','2/3'],2,'Los pares son 2, 4 y 6: 3 de 6 resultados = 1/2.','Enumera los pares.'],
 ['Si lanzas dos monedas justas, ¿P(dos caras)?',['1/2','1/3','1/4','1/8'],2,'Los pares posibles son CC, CS, SC, SS; solo CC cumple: 1/4.','Haz una lista de los cuatro resultados.']
 ]
};
window.PAES_QUESTIONS = Object.entries(BANK).flatMap(([skill, rows]) => rows.map((row, index) => ({id:skill+'-'+(index+1),skill,question:row[0],options:row[1],answer:row[2],explanation:row[3],hint:row[4],difficulty:index<2?1:index<4?2:3})));