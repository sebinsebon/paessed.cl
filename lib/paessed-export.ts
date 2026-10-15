import JSZip from 'jszip';
import {readPaessed,sha256,validatePaessed} from './paessed-package';
import {resolveImportedResources} from './imported-resources';
import type {ImportedExamRecord} from './local-imports';
export async function buildPaessedPackage(record:ImportedExamRecord):Promise<Blob>{
 const validation=validatePaessed(record.finalJson);
 const original=await resolveImportedResources(record);
 if(original.errors.length)throw new Error(original.errors.join('\n'));
 const zip=new JSZip();const encoder=new TextEncoder();
 const finalBytes=encoder.encode(JSON.stringify(record.finalJson,null,2)+'\n');
 const files:Array<{path:string;sha256:string;bytes:number}>=[];
 async function add(path:string,bytes:Uint8Array){zip.file(path,bytes);files.push({path,sha256:await sha256(bytes),bytes:bytes.length});}
 await add('final.json',finalBytes);
 for(const resource of validation.resources.values()){
  const blob=original.byId.get(resource.id);
  if(!blob)throw new Error('Recurso original ausente: '+resource.id);
  const bytes=new Uint8Array(await blob.arrayBuffer());
  if(await sha256(bytes)!==resource.sha256)throw new Error('Recurso modificado: '+resource.id);
  await add(resource.path,bytes);
 }
 zip.file('manifest.json',JSON.stringify({format:'paessed-package',schema_version:'0.1.0',files},null,2)+'\n');
 const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
 await readPaessed(bytes);
 return new Blob([new Uint8Array(bytes)],{type:'application/zip'});
}
