import {readPaessed,validatePaessed,sha256} from './paessed-package';
import Reader from './paessed-runtime/package-reader.js';
import Validator from './paessed-runtime/validator.js';
import {openResourceZip} from './resource-zip';
import type {ImportedExamRecord} from './local-imports';

export type ResourceCoverage={id:string;path:string;found:boolean;loaded:boolean;error?:string};
export type ImportedResources={byId:Map<string,Blob>;byPath:Map<string,Blob>;coverage:ResourceCoverage[];errors:string[]};
type Resource={id:string;path:string;sha256?:string};
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
export function blockAssetIds(value:unknown,depth=0):string[]{
 if(depth>16||!Array.isArray(value))return [];
 return value.flatMap(block=>{
  if(!isRecord(block))return [];
  if(block.type==='image'&&typeof block.asset_id==='string')return [block.asset_id];
  if(block.type==='table'&&Array.isArray(block.rows))return block.rows.flatMap(row=>Array.isArray(row)?row.flatMap(cell=>blockAssetIds(cell,depth+1)):[]);
  return [];
 });
}
export function imageReferences(value:unknown):string[]{
 const found=new Set<string>();
 function visit(item:unknown,depth:number){
  if(depth>16||item==null)return;
  if(typeof item==='string'){
   const matches=item.replace(/\\/g,'/').match(/(?:^|\/)assets\/[^?#\s"'<>]+?\.(?:png|jpe?g|gif|webp|svg)(?=[?#\s"'<>]|$)/gi)??[];
   for(const match of matches)found.add(match.replace(/^.*?(assets\/)/i,'assets/'));
  }else if(Array.isArray(item))for(const child of item)visit(child,depth+1);
  else if(isRecord(item))for(const child of Object.values(item))visit(child,depth+1);
 }
 visit(value,0);return [...found];
}

export async function resolveImportedResources(record:ImportedExamRecord,options:{cancelled?:()=>boolean}={}):Promise<ImportedResources>{
 const cancelled=options.cancelled??(()=>false);
 const data=record.finalJson;
 const contract=isRecord(data)&&data.format==='paessed-benchmark';
 const resources:Resource[]=contract?[...validatePaessed(data).resources.values()]:[];
 if(!contract){
  const assets=isRecord(data)&&Array.isArray(data.assets)?data.assets:[];
  const ids=new Set<string>();
  for(const asset of assets)if(isRecord(asset)&&typeof asset.id==='string'&&typeof asset.path==='string'){
   Validator.safePath(asset.path);if(ids.has(asset.id))throw new Error('Recurso duplicado: '+asset.id);ids.add(asset.id);
   resources.push({id:asset.id,path:asset.path,sha256:typeof asset.sha256==='string'?asset.sha256:undefined});
  }
  for(const path of imageReferences(data))if(!resources.some(r=>r.path===path))resources.push({id:path,path});
 }
 const result:ImportedResources={byId:new Map(),byPath:new Map(),coverage:[],errors:[]};
 if(!record.archive){
  for(const resource of resources){
   const error='Sin archivo de imágenes adjunto: '+resource.id+' ('+resource.path+'). Un final.json solo no contiene los recursos.';
   result.coverage.push({...resource,found:false,loaded:false,error});result.errors.push(error);
  }return result;
 }
 const strict=(record.summary?.sourceKind??'paessed')==='paessed';
 const verified=strict?await readPaessed(record.archive):null;
 const archive=strict?null:await openResourceZip(record.archive,cancelled);
 for(const resource of resources){
  if(cancelled())throw new Error('Carga cancelada');
  const coverage:ResourceCoverage={id:resource.id,path:resource.path,found:false,loaded:false};
  result.coverage.push(coverage);
  try{
   const original=verified?.blobs.get(resource.id);
   const path=archive?.locate(resource.path);
   coverage.found=!!original||!!path;
   if(!coverage.found)throw new Error('Archivo no disponible: '+resource.path);
   const bytes=original?new Uint8Array(await original.arrayBuffer()):await archive!.read(path!);
   if(resource.sha256&&await sha256(bytes)!==resource.sha256.toLowerCase())throw new Error('SHA-256 incorrecto: '+resource.path);
   let mime='image/png';
   if(contract||/\.png$/i.test(resource.path))Reader.checkPng(bytes,resource.path);
   else{
    // Legacy path-based illustrations remain img blobs, never executable HTML.
    const extension=resource.path.split('.').pop()?.toLowerCase();
    const types:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml'};
    if(!extension||!types[extension])throw new Error('Formato de imagen no compatible: '+resource.path);
    mime=types[extension];
   }
   const blob=original??new Blob([new Uint8Array(bytes)],{type:mime});
   result.byId.set(resource.id,blob);result.byPath.set(resource.path,blob);coverage.loaded=true;
  }catch(error){
   coverage.error=(error instanceof Error?error.message:String(error))+' ['+resource.id+']';result.errors.push(coverage.error);
  }
 }
 return result;
}
