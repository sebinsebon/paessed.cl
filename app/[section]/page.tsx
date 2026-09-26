import { notFound } from 'next/navigation';
import { isSection, SectionPage } from '@/components/sections';
export default async function Route({params}:{params:Promise<{section:string}>}) {
  const {section}=await params;
  if(!isSection(section)) notFound();
  return <SectionPage section={section}/>;
}
