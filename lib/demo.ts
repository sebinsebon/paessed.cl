/** Original, synthetic M1 examples exclusively for the UI prototype. Not DEMRE material. */
export type AxisId = 'numeros' | 'algebra' | 'geometria' | 'datos';
export type Skill = 'Resolver' | 'Modelar' | 'Argumentar' | 'Representar';
export type Question = { id: string; axis: AxisId; skill: Skill; topic: string; level: string; question: string; options: [string, string, string, string]; correct: number; explanation: string };
export const AXES: { id: AxisId; name: string; short: string; units: string[] }[] = [
  { id: 'numeros', name: 'Números', short: 'Números', units: ['Números enteros y racionales', 'Porcentajes', 'Potencias y raíces'] },
  { id: 'algebra', name: 'Álgebra y Funciones', short: 'Álgebra', units: ['Expresiones algebraicas', 'Ecuaciones e inecuaciones', 'Funciones'] },
  { id: 'geometria', name: 'Geometría', short: 'Geometría', units: ['Figuras geométricas', 'Semejanza y Tales', 'Transformaciones'] },
  { id: 'datos', name: 'Probabilidad y Estadística', short: 'Datos y azar', units: ['Representación de datos', 'Medidas de tendencia', 'Probabilidad'] },
];
export const QUESTIONS: Question[] = [
  { id: 'n1', axis:'numeros', skill:'Resolver', topic:'Fracciones', level:'Básica', question:'¿Cuánto es 3/4 + 1/4?', options:['1/2','1','3/8','4/8'], correct:1, explanation:'Como tienen el mismo denominador, sumamos 3 + 1 y obtenemos 4/4 = 1.' },
  { id: 'n2', axis:'numeros', skill:'Modelar', topic:'Porcentajes', level:'Intermedia', question:'Una mochila cuesta $15.000 y tiene un descuento del 20 %. ¿Cuál es su precio final?', options:['$3.000','$12.000','$13.000','$18.000'], correct:1, explanation:'El descuento es 0,20 × 15.000 = 3.000. El precio final es 15.000 − 3.000 = 12.000.' },
  { id: 'n3', axis:'numeros', skill:'Argumentar', topic:'Potencias', level:'Avanzada', question:'¿Cuál afirmación sobre (−3)² es correcta?', options:['Vale −9 porque la base es negativa.','Vale 6 porque el exponente es 2.','Vale 9 porque (−3) × (−3) = 9.','Vale −6 por la regla de signos.'], correct:2, explanation:'La potencia incluye el signo dentro del paréntesis; multiplicar dos negativos entrega un positivo.' },
  { id: 'a1', axis:'algebra', skill:'Representar', topic:'Ecuaciones', level:'Básica', question:'¿Qué ecuación representa «el doble de un número es 18»?', options:['x + 2 = 18','2x = 18','x/2 = 18','18x = 2'], correct:1, explanation:'Si x es el número, su doble se expresa como 2x.' },
  { id: 'a2', axis:'algebra', skill:'Resolver', topic:'Ecuaciones', level:'Intermedia', question:'Si 3x − 5 = 16, ¿cuánto vale x?', options:['5','7','11','21'], correct:1, explanation:'Sumamos 5 a ambos lados: 3x = 21. Después dividimos por 3: x = 7.' },
  { id: 'a3', axis:'algebra', skill:'Modelar', topic:'Funciones', level:'Avanzada', question:'Un viaje cobra $1.200 de base y $350 por kilómetro. ¿Qué expresión entrega el precio por x kilómetros?', options:['1.200x + 350','1.550x','1.200 + 350x','350 + x'], correct:2, explanation:'El valor fijo es 1.200 y cada kilómetro suma 350; el total es 1.200 + 350x.' },
  { id: 'g1', axis:'geometria', skill:'Argumentar', topic:'Ángulos', level:'Básica', question:'¿Por qué dos ángulos que forman una línea recta suman 180°?', options:['Porque son complementarios.','Porque forman un ángulo llano.','Porque ambos miden 90° siempre.','Porque forman un giro completo.'], correct:1, explanation:'Los ángulos adyacentes sobre una línea recta forman juntos un ángulo llano de 180°.' },
  { id: 'g2', axis:'geometria', skill:'Representar', topic:'Áreas', level:'Intermedia', question:'Un rectángulo mide 8 cm de largo y 5 cm de ancho. ¿Qué expresión representa su área?', options:['2(8 + 5)','8 + 5','8 × 5','8 ÷ 5'], correct:2, explanation:'El área de un rectángulo se representa multiplicando largo por ancho.' },
  { id: 'g3', axis:'geometria', skill:'Resolver', topic:'Semejanza', level:'Avanzada', question:'Dos figuras semejantes tienen razón de lados 2:3. Si el lado menor mide 10 cm, ¿cuánto mide el correspondiente mayor?', options:['12 cm','15 cm','20 cm','30 cm'], correct:1, explanation:'Para pasar de 2 a 3 multiplicamos por 3/2. Entonces, 10 × 3/2 = 15 cm.' },
  { id: 'd1', axis:'datos', skill:'Modelar', topic:'Probabilidad', level:'Básica', question:'En una bolsa hay 3 fichas rojas y 2 azules. ¿Qué fracción representa la probabilidad de sacar una azul?', options:['2/3','2/5','3/5','1/2'], correct:1, explanation:'Hay 2 casos favorables de 5 posibles. La probabilidad es 2/5.' },
  { id: 'd2', axis:'datos', skill:'Argumentar', topic:'Media', level:'Intermedia', question:'Se agrega un valor muy alto a un conjunto de notas. ¿Cuál afirmación es correcta?', options:['La media necesariamente disminuye.','La media puede aumentar.','La mediana siempre será cero.','La cantidad de datos no cambia.'], correct:1, explanation:'Un valor superior a la media anterior hace que la nueva media aumente.' },
  { id: 'd3', axis:'datos', skill:'Representar', topic:'Gráficos', level:'Avanzada', question:'¿Qué tipo de gráfico usarías para comparar la cantidad de estudiantes de cuatro cursos?', options:['Gráfico de barras','Plano cartesiano sin datos','Diagrama de dispersión de dos variables continuas','Ningún gráfico permite comparar cursos'], correct:0, explanation:'Un gráfico de barras facilita comparar cantidades entre categorías distintas.' },
];
export type Diagnostic = { answers: (number | null)[]; current: number; startedAt: number; completedAt?: number };
export type DemoAccount = { name: string; email: string; createdAt: number };
const DIAGNOSTIC_KEY = 'paessed-prototype-diagnostic-v1';
const ACCOUNT_KEY = 'paessed-prototype-account-v1';
const PRACTICE_KEY = 'paessed-prototype-practice-v1';
const storage = () => typeof window !== 'undefined' ? window.localStorage : null;
export function freshDiagnostic(): Diagnostic { return { answers: QUESTIONS.map(() => null), current: 0, startedAt: Date.now() }; }
export function readDiagnostic(): Diagnostic | null {
  try { const raw = storage()?.getItem(DIAGNOSTIC_KEY); if (!raw) return null; const state = JSON.parse(raw) as Diagnostic;
    return Array.isArray(state.answers) && state.answers.length === QUESTIONS.length ? state : null;
  } catch { return null; }
}
export function saveDiagnostic(value: Diagnostic) { storage()?.setItem(DIAGNOSTIC_KEY, JSON.stringify(value)); }
export function readAccount(): DemoAccount | null {
  try { const raw = storage()?.getItem(ACCOUNT_KEY); return raw ? JSON.parse(raw) as DemoAccount : null; } catch { return null; }
}
export function saveAccount(value: DemoAccount) { storage()?.setItem(ACCOUNT_KEY, JSON.stringify(value)); }
export function savePractice(value: { kind: string; correct: number; total: number; finishedAt: number }) { storage()?.setItem(PRACTICE_KEY, JSON.stringify(value)); }
export function readPractice(): { kind: string; correct: number; total: number; finishedAt: number } | null {
  try { const raw = storage()?.getItem(PRACTICE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function getOutcome(diagnostic: Diagnostic) {
  return AXES.map(axis => {
    const questions = QUESTIONS.map((q,i) => ({...q, index:i})).filter(q => q.axis === axis.id);
    const correct = questions.filter(q => diagnostic.answers[q.index] === q.correct).length;
    const answered = questions.filter(q => diagnostic.answers[q.index] !== null).length;
    return { ...axis, correct, answered, total: questions.length, percent: Math.round(correct / questions.length * 100) };
  });
}
export function resetPrototype() { storage()?.removeItem(DIAGNOSTIC_KEY); storage()?.removeItem(ACCOUNT_KEY); storage()?.removeItem(PRACTICE_KEY); storage()?.removeItem('paessed-dashboard-tour-seen'); }
