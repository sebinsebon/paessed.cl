'use client';
import {useEffect,useRef} from 'react';
import Renderer from '@/lib/paessed-runtime/block-renderer.js';
import katex from '@/lib/paessed-runtime/katex.js';
export function PaessedBlocks({blocks,assetUrls}:{blocks:unknown[];assetUrls:Map<string,string>}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(ref.current) Renderer.renderBlocks(ref.current,blocks,{katex,assetUrls});},[blocks,assetUrls]);
 return <div ref={ref} className='paessed-blocks'/>;
}
