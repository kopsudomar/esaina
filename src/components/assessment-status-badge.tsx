import { Badge } from "@/components/ui/badge";

const STATUS: Record<string, { label: string; variant: "soft" | "success" | "warning" }> = {
  DRAFT: { label: "Draf", variant: "soft" },
  OPEN: { label: "Dibuka", variant: "success" },
  CLOSED: { label: "Ditutup", variant: "warning" },
};

export function AssessmentStatusBadge({ status }: { status: string }) {
  const meta = STATUS[status] ?? { label: status, variant: "soft" as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
