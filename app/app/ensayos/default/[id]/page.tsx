import { DefaultExamSession } from "@/components/default-exam-session";
export default async function DefaultExamPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <DefaultExamSession id={id}/>;
}
