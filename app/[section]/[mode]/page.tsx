import { notFound } from 'next/navigation';
import { PracticePage } from '@/components/practice';
export default async function Route({params}:{params:Promise<{section:string;mode:string}>}) {
  const {section,mode}=await params;
  if(!((section==='ensayos' && mode==='practicar')||(section==='aprender' && mode==='leccion')||(section==='playground' && mode==='practicar'))) notFound();
  return <PracticePage section={section} mode={mode}/>;
}
