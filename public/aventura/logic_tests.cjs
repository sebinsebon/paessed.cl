/* Contract tests for the self-contained PAESSED learning prototype.
 * Run with: node public/aventura/logic_tests.cjs
 */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const base=__dirname;
function setup(cache={}, clock='2026-10-20T10:00:00-03:00'){
  let html='',click,key,store={...cache};
  const el={set innerHTML(s){html=s},get innerHTML(){return html}};
  class FixedDate extends Date {
    constructor(...args){super(...(args.length?args:[clock]));}
    static now(){return new Date(clock).getTime();}
  }
  const doc={getElementById:()=>el,addEventListener:(n,fn)=>{if(n==='click')click=fn;else if(n==='keydown')key=fn;},title:''};
  const c={window:{scrollTo(){}},document:doc,localStorage:{getItem:k=>store[k],setItem:(k,v)=>{store[k]=v;}},Date:FixedDate,console,setTimeout,clearTimeout,URL,Blob};
  vm.createContext(c);
  for(const file of ['questions.js','questions-extra.js','app.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),c,{filename:file});
  return {
    act(action,value){click({target:{closest:()=>({dataset:{action,value}})}});},
    get html(){return html;},
    get state(){return c.window.PAES_DEBUG.read();},
    get questions(){return c.window.PAES_DEBUG.questions;},
    get skills(){return c.window.PAES_SKILLS;},
    get cache(){return store;},
    key
  };
}
function respond(a,correct=true){
  const session=a.state.session,q=a.questions.find(q=>q.id===session.ids[session.index]);
  a.act('choose',String(correct?q.answer:(q.answer+1)%4));a.act('check');a.act('check');
  assert.equal(a.state.session.answers.length,session.index+1,'duplicate check must not add answers');
  a.act('next');
}
const first=setup();
assert.match(first.html,/La PAES se prepara/);
assert.equal(first.skills.length,17);
assert.equal(first.questions.length,102);
assert.equal(new Set(first.questions.map(q=>q.id)).size,102);
for(const q of first.questions){
  assert.equal(q.options.length,4);
  assert(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4);
  assert(q.explanation&&q.hint);
  assert(first.skills.some(s=>s.id===q.skill));
}
first.act('start-from-zero');
assert.match(first.html,/17 microlecciones/);
first.act('lesson','semejanza'); // no hard lock on curricular units
assert.equal(first.state.session.skill,'semejanza');
assert.equal(first.state.session.ids.length,5);
for(let i=0;i<5;i++)respond(first);
assert(first.state.completed.includes('semejanza'));
assert.equal(first.state.history.length,1);
assert(first.state.xp>0);
const cache=first.cache;
const reopened=setup(cache);
assert(reopened.state.completed.includes('semejanza'));
assert.equal(reopened.state.history.length,1);
console.log('PASS route: 17 lessons, 102 demo questions, skip units, completion and persistence');

const diagn=setup();diagn.act('start-diagnostic');
assert.equal(diagn.state.session.ids.length,12);
const axisCounts={};
for(const id of diagn.state.session.ids){
  const q=diagn.questions.find(q=>q.id===id);
  const axis=diagn.skills.find(s=>s.id===q.skill).axis;
  axisCounts[axis]=(axisCounts[axis]||0)+1;
}
assert.deepEqual(Object.values(axisCounts).sort(),[3,3,3,3]);
for(let i=0;i<12;i++)respond(diagn,i%3!==0);
assert.equal(diagn.state.diagnosticDone,true);
assert.equal(diagn.state.completed.length,0);
assert.match(diagn.html,/Resultado inicial aproximado/);
diagn.act('result-route');assert.match(diagn.html,/Tu recorrido/);
console.log('PASS diagnostic: 12 questions across 4 axes, estimates without fake unlocks');

const wrong=setup();wrong.act('start-from-zero');wrong.act('lesson','enteros');
for(let i=0;i<5;i++)respond(wrong,false);
assert.equal(wrong.state.completed.length,0);
assert.equal(wrong.state.mistakes.length,5);
wrong.act('result-route');
wrong.act('lesson','fracciones'); // a failed lesson cannot lock other content
assert.equal(wrong.state.session.skill,'fracciones');
wrong.act('quiz-exit');wrong.act('tab','practice');wrong.act('start-review');
assert.equal(wrong.state.session.skill,'fracciones','session should not be overwritten on resume');
for(let i=0;i<5;i++)respond(wrong,true);
wrong.act('result-route');wrong.act('start-review');
assert(wrong.state.session.ids.some(id=>wrong.state.mistakes.includes(id)),'errors should be prioritized');
const pendingId=wrong.state.session.ids[0];wrong.act('quiz-exit');
assert.equal(setup(wrong.cache).state.session.ids[0],pendingId);
console.log('PASS adaptive: mistakes, review priority, soft prerequisites and resumable sessions');

const ranked=setup();ranked.act('start-from-zero');ranked.act('tab','league');
assert.match(ranked.html,/No hay rivales/);
ranked.act('start-ranked');
assert.equal(ranked.state.session.type,'ranked');
assert.equal(ranked.state.session.ids.length,10);
assert.equal(new Set(ranked.state.session.ids).size,10);
assert.doesNotMatch(ranked.html,/hint-btn/);
ranked.act('hint');assert.doesNotMatch(ranked.html,/hint-box/);
for(let i=0;i<10;i++)respond(ranked,true);
assert.equal(ranked.state.lastResult.points,100);
assert.equal(ranked.state.league.scores['2026-10-20'].points,100);
assert.equal(ranked.state.history.length,1);
ranked.act('result-route');
assert.match(ranked.html,/Desafío completado/);
ranked.act('start-ranked');assert.equal(ranked.state.session,null);
assert.equal(setup(ranked.cache).state.league.scores['2026-10-20'].points,100);
console.log('PASS ranked: deterministic 10 questions, one daily result, points separate from XP, no fake leaderboard');

const rollover=JSON.parse(ranked.cache['paessed-aventura-m1-v1']);
rollover.league.week='2026-10-19';
rollover.league.scores={};
for(const d of ['19','20','21','22','23'])rollover.league.scores['2026-10-'+d]={points:100,correct:10,total:10};
const next=setup({'paessed-aventura-m1-v1':JSON.stringify(rollover)},'2026-10-26T10:00:00-03:00');
assert.equal(next.state.league.tier,1);
assert.equal(next.state.league.week,'2026-10-26');
assert.equal(next.state.league.lastAward.points,500);
assert.equal(next.state.league.lastAward.to,1);
assert.equal(next.state.league.scores['2026-10-20'].points,100);
console.log('PASS weekly rollover: promotions once, archive history and preserve past scores');
console.log('ALL PAESSED AVENTURA TESTS PASSED');
