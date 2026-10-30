const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Renderer=require('../lib/paessed-runtime/block-renderer.js');

test('balanced b/i preserve exact text, whitespace, Unicode and nesting',()=>{
 for(const [source,plain] of [
  ['¿Cuál es <b>INCORRECTA</b>?','¿Cuál es INCORRECTA?'],
  [' A <i>á𝑥</i>\n\t<b><i>ambos</i></b>  Z',' A á𝑥\n\tambos  Z'],
  ['<b>uno <b>dos</b></b>','uno dos'],['<b></b>',''],
 ])assert.equal(Renderer.plainText(source),plain);
 assert.deepEqual(Renderer.parseInlineText('<b><i>x</i></b>'),[{text:'x',bold:true,italic:true}]);
});
test('invalid tags and historical literal text remain unchanged',()=>{
 for(const source of ['sin etiquetas\n  $11 000 < 2 &lt;x&gt;','<b>sin cierre','<i>x</b>',
  '<b><i>x</b></i>','</i>texto','<B>x</B>','<b class="x">x</b>',
  '<img src=x onerror=alert(1)>','<script>alert(1)</script>'])assert.equal(Renderer.plainText(source),source);
});
test('large input and arbitrary safe Unicode runs lose no content',()=>{
 const source='Á 𝑥\n\t&<>$ '.repeat(10000);
 assert.equal(Renderer.plainText(`<b><i>${source}</i></b>`),source);
});

require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);
const content=require('../lib/imported-question-content.ts');
test('search and option text strip only valid prose markers; source blocks and LaTeX stay intact',()=>{
 const blocks=[{type:'text',text:'Una <b>palabra</b> '},{type:'math',latex:'x_{<b>}',display:false}];
 const q={stem:blocks,options:[{label:'A',blocks:[{type:'text',text:'<i>Alternativa</i>'}]}]};
 assert.equal(content.questionText(q),'Una palabra x_{<b>}');
 assert.equal(content.getOptions(q)[0].text,'Alternativa');
 assert.deepEqual(q.stem,blocks);
});
