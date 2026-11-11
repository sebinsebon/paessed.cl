import { createLearningState } from "./engine.ts";

export type SavedDefaultExamSession = {id:string;index:number;answers:Record<string,string>;completedAt?:string;assisted?:string[];evidenceDelivered?:boolean};
const DB="paessed-learning";
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{for(const store of ["state","exam-sessions"])if(!request.result.objectStoreNames.contains(store))request.result.createObjectStore(store);};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error("Cierra otras pestañas de PAESSED para abrir tu progreso."));
});}
export function validateExamSessions(value:unknown):Record<string,SavedDefaultExamSession>{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Las sesiones del respaldo son inválidas.");
  const result:Record<string,SavedDefaultExamSession>={};
  for(const [key,v]of Object.entries(value)){
    const s=v as SavedDefaultExamSession;
    if(!/^m1-(invierno|regular|pdt)-\d{4}$/.test(key)||!s||typeof s.id!=="string"||!s.id||!Number.isInteger(s.index)||s.index<0||s.index>=65||!s.answers||typeof s.answers!=="object"||Array.isArray(s.answers)||Object.entries(s.answers).some(([id,a])=>!/^demre:[a-f\d]{64}:([1-9]|[1-5]\d|6[0-5])$/.test(id)||typeof a!=="string"||! /^[A-E]$/.test(a))||(s.completedAt!==undefined&&(!Number.isFinite(Date.parse(s.completedAt))))||(s.assisted!==undefined&&(!Array.isArray(s.assisted)||!s.assisted.every(id=>typeof id==="string"&&/^demre:[a-f\d]{64}:\d+$/.test(id)))))throw new Error("El respaldo contiene un ensayo inválido.");
    if(s.evidenceDelivered!==undefined&&typeof s.evidenceDelivered!=="boolean")throw new Error("Estado de entrega inválido.");
    result[key]=structuredClone(s);
  }return result;
}
export async function readExamSession(id:string):Promise<SavedDefaultExamSession>{
  const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction("exam-sessions","readwrite");const store=tx.objectStore("exam-sessions");const request=store.get(id);let value:SavedDefaultExamSession;
    request.onsuccess=()=>{try{value=request.result??{id:crypto.randomUUID(),index:0,answers:{}};validateExamSessions({[id]:value});if(!request.result)store.put(value,id);}catch(e){tx.abort();reject(e);}};
    tx.oncomplete=()=>{db.close();resolve(value!);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error??new Error("No se pudo cargar el ensayo."));};
  });
}
export async function saveExamSession(id:string,value:SavedDefaultExamSession,change?:{questionId:string;answer:string}):Promise<SavedDefaultExamSession>{
  validateExamSessions({[id]:value});const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction("exam-sessions","readwrite");const store=tx.objectStore("exam-sessions");const request=store.get(id);
    let result=value;
    request.onsuccess=()=>{try{const old=request.result as SavedDefaultExamSession|undefined;if(old?.completedAt){result={...old,evidenceDelivered:old.evidenceDelivered||value.evidenceDelivered};store.put(result,id);return;}const merged=old?{...old.answers}:{...value.answers};if(change){if(change.answer)merged[change.questionId]=change.answer;else delete merged[change.questionId];}result={...value,answers:merged};validateExamSessions({[id]:result});store.put(result,id);}catch(e){tx.abort();reject(e);}};
    tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event("paessed-learning-change"));resolve(result);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error??new Error("No se pudo guardar el ensayo."));};
  });
}
export async function listExamSessions():Promise<Record<string,SavedDefaultExamSession>>{
  const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction("exam-sessions","readonly");const store=tx.objectStore("exam-sessions");const values=store.getAll();const keys=store.getAllKeys();
    tx.oncomplete=()=>{db.close();try{resolve(validateExamSessions(Object.fromEntries(keys.result.map((key,i)=>[String(key),values.result[i]]))));}catch(e){reject(e);}};tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
export async function restoreExamSessions(value:unknown):Promise<void>{
  const records=validateExamSessions(value);const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction("exam-sessions","readwrite");const store=tx.objectStore("exam-sessions");
    let failure:unknown;
    for(const [key,value]of Object.entries(records)){const request=store.get(key);request.onsuccess=()=>{const old=request.result as SavedDefaultExamSession|undefined;if(old&&old.id!==value.id&&Object.keys(old.answers).length){failure=new Error("El respaldo incluye otra sesión de este ensayo. Conserva el progreso actual antes de restaurarla.");tx.abort();return;}if(!old?.completedAt)store.put(old&&old.id===value.id?{...value,answers:{...value.answers,...old.answers}}:value,key);};}
    tx.oncomplete=()=>{db.close();resolve();};tx.onerror=tx.onabort=()=>{db.close();reject(failure??tx.error);};
  });
}
export async function clearLearningState():Promise<void>{
  const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(["state","exam-sessions"],"readwrite");tx.objectStore("state").put(createLearningState(),"current");tx.objectStore("exam-sessions").clear();tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event("paessed-learning-change"));const channel=new BroadcastChannel("paessed-learning");channel.postMessage("changed");channel.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});
}
