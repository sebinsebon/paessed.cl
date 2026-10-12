'use client';
import {useEffect,useRef} from 'react';
import Renderer from '@/lib/paessed-runtime/block-renderer.js';
import katex from '@/lib/paessed-runtime/katex.js';
export function PaessedBlocks({blocks,assetUrls}:{blocks:unknown[];assetUrls:Map<string,string>}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const container=ref.current;
  if(!container)return;
  Renderer.renderBlocks(container,blocks,{katex,assetUrls});
  const fit=()=>Renderer.fitMath(container);
  const observer=new ResizeObserver(fit);
  observer.observe(container);
  let active=true;
  // Font metrics can change after the initial DOM render.
  void document.fonts.ready.then(()=>{if(active)fit();});
  return ()=>{active=false;observer.disconnect();};
 },[blocks,assetUrls]);
 // Styles belong to structured content, independently of the import extension.
 // React waits for these resources and deduplicates them across question/options.
 return <>
  <link rel="stylesheet" href="/paessed/katex/katex.min.css" precedence="paessed-katex" />
  <link rel="stylesheet" href="/paessed/block-renderer.css" precedence="paessed-blocks" />
  <div ref={ref} className='paessed-blocks'/>
 </>;
}
