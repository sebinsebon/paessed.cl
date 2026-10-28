module.exports=function fixture(){
 const q={id:'emphasis-q1',source_id:'synthetic',number:'1',regions:[{page:1,bbox:[0,0,400,400]}],
  stem:[{type:'text',text:'¿Cuál afirmación es <b>INCORRECTA</b>? Una palabra en <i>cursiva</i> y <b><i>ambos estilos</i></b>. '},{type:'math',latex:'\\frac{1}{2}+x^2',display:false},{type:'table',rows:[[[{type:'text',text:'<b>Valor</b>'}],[{type:'text',text:'<i>Unidad</i>'}]],[[{type:'math',latex:'2',display:false}],[{type:'text',text:'cm'}]]]}],
  options:[{label:'A',blocks:[{type:'text',text:'La <i>primera</i> alternativa.'}]},{label:'B',blocks:[{type:'text',text:'La <b>segunda</b> alternativa.'}]}],
  answer:{label:'A',status:'verified',origin:'answer-key',source_ref:'synthetic-key'},
  explanation:{blocks:[{type:'text',text:'Explicación <b>sintética</b> con <i>énfasis</i>.'}],status:'verified'},
  fidelity:{status:'reviewed',review_ref:'synthetic-ui-state-only'},issues:['SYNTHETIC_UI_FIXTURE_NOT_GOLD'],curriculum:{eje:'Números',subeje:'Conjunto de los números enteros y racionales',en_temario:'si'}};
 return {format:'paessed-benchmark',schema_version:'0.2.0',pipeline:'demo',run:{id:'emphasis-demo',cli:'test',model:'none',created_at:'2026-10-28'},exam:{id:'emphasis-demo',title:'Demostración sintética de negrita y cursiva',scope:'demo',expected_questions:[{id:q.id,source_id:q.source_id,number:q.number}]},sources:[{id:'synthetic',name:'synthetic.pdf',sha256:'a'.repeat(64),page_count:1,role:'exam'}],questions:[q],assets:[],evidence:[]};
};
