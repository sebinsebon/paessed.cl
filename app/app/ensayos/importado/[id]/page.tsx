import { ImportedExamViewer } from "@/components/imported-exam-viewer";

export default async function ImportedExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ImportedExamViewer id={id} />;
}
