const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const files=['questions.js','app.js'];
function setup(cache={}){
 let html='',click,keyboard,store={...cache};
 const el={set innerHTML(s){html=s},get innerHTML(){return html}};
 const c={window:{scrollTo:()=>{}},document:{getElementById:()=>el,addEventListener:(n,cb)=>{if(n==='click')click=cb;else keyboard=cb},title:''},localStorage:{getItem:k=>store[k],setItem:(k,v)=>{store[k]=v}},console,setTimeout,clearTimeout,Date,URL,Blob};
 vm.createContext(c);for(const f of files)vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,f),'utf8'),c,{filename:f});
 const act=(action,value)=>click({target:{closest:()=>({dataset:{action,value}})}});
 return {act,get html(){return html},get state(){return c.window.PAES_DEBUG.read()},get data(){return c.window.PAES_DEBUG.questions},cache:store};
}
const a=setup();assert.match(a.html,/La PAES se prepara/);a.act('start-from-zero');assert.match(a.html,/Tu recorrido/);assert.match(a.html,/8 habilidades/);assert.equal(a.state.onboarded,true);
a.act('lesson','enteros');assert.equal(a.state.session.ids.length,5);assert.match(a.html,/Selecciona la alternativa/);
// Every question: answer correctly and verify duplicate clicks never create duplicate statistics.
for(let i=0;i<5;i++){
 const id=a.state.session.ids[i],q=a.data.find(x=>x.id===id);
 a.act('choose',String(q.answer));a.act('check');a.act('check');assert.equal(a.state.session.answers[i].correct,true);
 a.act('next');
}
assert.equal(a.state.completed[0],'enteros');assert.equal(a.state.stats.enteros.total,5);
assert.equal(a.state.history.length,1);assert.equal(a.state.history[0].xp,40);assert.equal(a.state.streak,1);assert.equal(a.state.hearts,5);
assert.match(a.html,/¡Impecable!/);a.act('result-route');assert.match(a.html,/Fracciones y racionales/);
const saved=a.cache;const b=setup(saved);assert.equal(b.state.xp,40);assert.equal(b.state.completed.length,1);
b.act('lesson','fracciones');b.act('choose','0');b.act('check');assert.equal(b.state.stats.fracciones.total,1);b.act('quiz-exit');assert.match(b.html,/Reanudar lección/);
const c=setup(b.cache);assert.equal(c.state.session.index,0);assert.equal(c.state.session.answers.length,1);assert.match(c.html,/Explicación|correcto|Casi|error/i);
c.act('next');assert.equal(c.state.session.index,1);c.act('quiz-exit');c.act('resume');assert.equal(c.state.session.index,1);
// Review after a mistake must include it. Streak persists on same day; XP only paid once at completion.
const before=c.state.xp;c.act('quiz-exit');c.act('tab','practice');assert.match(c.html,/Repaso inteligente/);c.act('start-review');assert(c.state.session.ids.some(x=>c.state.mistakes.includes(x)));
assert.equal(c.state.xp,before);
// Reset and choose diagnostic.
const d=setup();d.act('start-diagnostic');assert.equal(d.state.session.ids.length,8);
for(let i=0;i<8;i++){const q=d.data.find(x=>x.id===d.state.session.ids[i]);d.act('choose',String(q.answer));d.act('check');d.act('next');}
assert.equal(d.state.diagnosticDone,true);assert.equal(d.state.history[0].type,'diagnostic');assert.equal(d.state.completed.length,0);
// Content integrity.
assert.equal(d.data.length,48);assert.equal(new Set(d.data.map(x=>x.id)).size,48);
for(const q of d.data){assert.equal(q.options.length,4);assert(q.answer>=0 && q.answer<4);assert(q.explanation&&q.hint)}
console.log('PASS: bienvenida, ruta, 5 preguntas, corrección única, XP sin duplicar, desbloqueo, racha, persistencia, reanudación, repaso, diagnóstico y banco de 48 preguntas');
// Failing a lesson must keep the next lesson locked but preserve learning history.
const f=setup();f.act('start-from-zero');f.act('lesson','enteros');
for(let i=0;i<5;i++){const q=f.data.find(x=>x.id===f.state.session.ids[i]);f.act('choose',String((q.answer+1)%4));f.act('check');f.act('next');}
assert.equal(f.state.completed.length,0);assert.equal(f.state.xp,15);assert.equal(f.state.hearts,1);assert.equal(f.state.mistakes.length,5);f.act('result-route');
assert.match(f.html,/Números enteros/);assert(!f.state.completed.includes('fracciones'));
f.act('tab','practice');f.act('start-review');assert(f.state.session.ids.some(id=>f.state.mistakes.includes(id)));
// Reanswering an error correctly in practice clears it and schedules tomorrow.
const q=f.data.find(x=>x.id===f.state.session.ids[0]);const wasWrong=f.state.mistakes.includes(q.id);
f.act('choose',String(q.answer));f.act('check');if(wasWrong)assert(!f.state.mistakes.includes(q.id));
assert.equal(f.state.reviews[q.id].interval,1);
// The daily mission, calendar-based streak and weekly XP should update only on completion.
assert.equal(f.state.streak,1);assert.equal(f.state.history.length,1);
console.log('PASS: lección reprobada bloquea avance, conserva errores, repaso corrige y reprograma, no se acreditan sesiones incompletas');
// A new activity cannot silently overwrite an interrupted session.
const hold=setup();hold.act('start-from-zero');hold.act('lesson','enteros');const id=hold.state.session.ids[0];hold.act('quiz-exit');hold.act('tab','practice');hold.act('start-review');assert.equal(hold.state.session.ids[0],id);
console.log('PASS: una sesión pausada no puede ser reemplazada accidentalmente');
