import { ExamSession } from "@/components/exam-session";

const demoTitles: Record<string, string> = {
  "example-invierno-2026": "Ensayo M1 Invierno 2026",
  "example-cpech-2026": "Ensayo Cpech 2026",
};

export default async function NewExamPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source } = await searchParams;
  const sourceId = typeof source === "string" && Object.prototype.hasOwnProperty.call(demoTitles, source) ? source : undefined;
  return <ExamSession sourceId={sourceId} sourceTitle={sourceId ? demoTitles[sourceId] : "Ensayo M1 de práctica"} />;
}
