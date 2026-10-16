import { notFound } from "next/navigation";
import { PackageAuditViewer } from "@/components/package-audit-viewer";

export default async function PackageAuditPage({ params }: { params: Promise<{ id: string }> }) {
  // This server-only gate also excludes the viewer from production responses.
  if (process.env.NODE_ENV !== "development" || process.env.PAESSED_AUDIT_MODE !== "1") {
    notFound();
  }
  const { id } = await params;
  return <PackageAuditViewer id={id} />;
}
