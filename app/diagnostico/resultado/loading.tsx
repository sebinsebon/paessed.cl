import { DiagnosticShell } from "@/components/learning/diagnostic-shell";
import { DiagnosticSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return <DiagnosticShell><DiagnosticSkeleton /></DiagnosticShell>;
}
