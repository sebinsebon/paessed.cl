import JSZip from 'jszip';
import Reader from './paessed-runtime/package-reader.js';
import Validator from './paessed-runtime/validator.js';

type Entry = {name:string;directory:boolean;size:number;crc:number};

// Generic containers may have audit files or a nested final.json. Only their
// inventory differs from a .paessed package: bounds, paths and CRC stay checked.
// The strict package reader is deliberately unchanged and never uses this path.
function inspect(bytes:Uint8Array):Map<string,Entry>{
 const {assert,LIMITS,safePath}=Validator;
 assert(bytes.length>=22&&bytes.length<=LIMITS.archiveBytes,'ZIP','tamaño no permitido');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const within=(at:number,n:number)=>assert(Number.isSafeInteger(at)&&at>=0&&at+n<=bytes.length,'ZIP','estructura truncada');
 const u16=(at:number)=>{within(at,2);return view.getUint16(at,true);};
 const u32=(at:number)=>{within(at,4);return view.getUint32(at,true);};
 const utf8=new TextDecoder('utf-8',{fatal:true});
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(u32(i)===0x06054b50&&i+22+u16(i+20)===bytes.length){end=i;break;}}
 assert(end>=0,'ZIP','directorio final ausente');
 assert(u16(end+4)===0&&u16(end+6)===0,'ZIP','volúmenes múltiples');
 const count=u16(end+10),start=u32(end+16),size=u32(end+12);
 assert(count>0&&count<=LIMITS.entries&&u16(end+8)===count,'ZIP','cantidad de entradas no permitida');
 assert(start!==0xffffffff&&size!==0xffffffff&&start+size===end,'ZIP','directorio inválido o ZIP64');
 within(start,size);
 const entries=new Map<string,Entry>(),folded=new Set<string>(),ranges:Array<[number,number]>=[];
 let cursor=start,total=0;
 for(let i=0;i<count;i++){
  assert(cursor+46<=end&&u32(cursor)===0x02014b50,'ZIP','entrada central inválida');
  const flags=u16(cursor+8),method=u16(cursor+10),crc=u32(cursor+16),compressed=u32(cursor+20),uncompressed=u32(cursor+24);
  const nameLength=u16(cursor+28),extra=u16(cursor+30),comment=u16(cursor+32),offset=u32(cursor+42),attributes=u32(cursor+38);
  assert(!(flags&(1|32|64|8192))&&[0,8].includes(method),'ZIP','cifrado o compresión no compatible');
  assert(u16(cursor+34)===0&&compressed!==0xffffffff&&uncompressed!==0xffffffff&&offset!==0xffffffff,'ZIP','ZIP64 o volumen múltiple');
  assert(((attributes>>>16)&0xf000)!==0xa000,'ZIP','enlace simbólico');
  const next=cursor+46+nameLength+extra+comment;
  assert(next<=end,'ZIP','entrada truncada');
  const name=utf8.decode(bytes.subarray(cursor+46,cursor+46+nameLength)),directory=name.endsWith('/');
  safePath(name,directory);
  assert(!folded.has(name.toLowerCase()),'ZIP','ruta duplicada: '+name);folded.add(name.toLowerCase());
  assert(!directory||uncompressed===0,'ZIP','directorio con contenido');
  total+=uncompressed;assert(total<=LIMITS.totalBytes,'ZIP','supera límite descomprimido');
  assert(!name.toLowerCase().endsWith('.json')||uncompressed<=LIMITS.jsonBytes,name,'JSON demasiado grande');
  assert(offset+30<=start&&u32(offset)===0x04034b50,'ZIP','cabecera local inválida');
  const localNameLength=u16(offset+26),dataStart=offset+30+localNameLength+u16(offset+28);
  assert(dataStart+compressed<=start,'ZIP','datos fuera del área local');
  assert(utf8.decode(bytes.subarray(offset+30,offset+30+localNameLength))===name&&u16(offset+6)===flags&&u16(offset+8)===method,'ZIP','cabeceras no coinciden');
  if(!(flags&8))assert(u32(offset+14)===crc&&u32(offset+18)===compressed&&u32(offset+22)===uncompressed,'ZIP','tamaños/CRC no coinciden');
  if(method===0)assert(compressed===uncompressed,'ZIP','tamaño STORE inválido');
  ranges.push([offset,dataStart+compressed]);entries.set(name,{name,directory,size:uncompressed,crc});cursor=next;
 }
 assert(cursor===end,'ZIP','datos centrales inesperados');
 ranges.sort((a,b)=>a[0]-b[0]);
 for(let i=1;i<ranges.length;i++)assert(ranges[i-1][1]<=ranges[i][0],'ZIP','entradas superpuestas');
 return entries;
}

export async function openResourceZip(input:Blob,cancelled:()=>boolean=()=>false){
 Validator.assert(input.size<=Validator.LIMITS.archiveBytes,'ZIP','archivo demasiado grande');
 const bytes=new Uint8Array(await input.arrayBuffer());
 const entries=inspect(bytes);
 if(cancelled())throw new Error('Carga cancelada');
 const zip=await JSZip.loadAsync(bytes,{createFolders:false});
 Validator.assert(Object.keys(zip.files).length===entries.size,'ZIP','inventario normalizado');
 for(const[name,entry]of entries){
  const file=zip.files[name];
  Validator.assert(file&&file.name===name&&file.dir===entry.directory,'ZIP','ruta alterada: '+name);
  if(file.unsafeOriginalName!==undefined)Validator.assert(file.unsafeOriginalName===name,'ZIP','nombre original alterado');
 }
 let budget=0;
 const cache=new Map<string,Promise<Uint8Array>>();
 function read(name:string):Promise<Uint8Array>{
  if(cache.has(name))return cache.get(name)!;
  const entry=entries.get(name),file=zip.file(name);
  if(!entry||entry.directory||!file)return Promise.reject(new Error('Archivo no disponible: '+name));
  const promise=new Promise<Uint8Array>((resolve,reject)=>{
   const stream=(file as JSZip.JSZipObject&{internalStream(type:'uint8array'):JSZip.JSZipStreamHelper<Uint8Array>}).internalStream('uint8array'),chunks:Uint8Array[]=[];
   let count=0,stopped=false;
   const stop=(error:Error)=>{if(!stopped){stopped=true;stream.pause();reject(error);}};
   stream.on('data',(chunk:Uint8Array)=>{
    if(stopped)return;
    count+=chunk.length;budget+=chunk.length;
    if(cancelled())return stop(new Error('Carga cancelada'));
    if(count>entry.size||budget>Validator.LIMITS.totalBytes)return stop(new Error('Descompresión fuera de límite: '+name));
    chunks.push(chunk);
   });
   stream.on('error',stop);
   stream.on('end',()=>{
    if(stopped)return;
    try{
     Validator.assert(count===entry.size,name,'tamaño descomprimido inesperado');
     const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
     Validator.assert(Reader.crc32(bytes)===entry.crc,name,'CRC incorrecto');resolve(bytes);
    }catch(error){stop(error instanceof Error?error:new Error(String(error)));}
   });stream.resume();
  });cache.set(name,promise);return promise;
 }
 const finalPath=[...entries.keys()].filter(name=>/(^|\/)final\.json$/i.test(name)).sort((a,b)=>a.split('/').length-b.split('/').length||a.length-b.length)[0];
 const base=finalPath?.includes('/')?finalPath.slice(0,finalPath.lastIndexOf('/')+1):'';
 function locate(path:string):string|undefined{
  Validator.safePath(path);
  return [base+path,path].find(name=>entries.has(name)&&!entries.get(name)!.directory);
 }
 return {entries,locate,read};
}
