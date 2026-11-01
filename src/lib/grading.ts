import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/api-error";
import type { SessionUser } from "@/lib/auth/types";

export async function teacherSubmission(id: string, teacher: SessionUser) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      assessment: { select: { id: true, title: true, class: { select: { teacherId: true } } } },
    },
  });
  if (!submission) throw notFound("Lembar kerja");
  if (submission.assessment.class.teacherId !== teacher.id) throw forbidden();
  return submission;
}

export function gradeStatus(revision: { status: "DRAFT" | "FINAL" } | null) {
  return revision?.status ?? "UNGRADED";
}

export function sumScores(items: { score: number | null }[]) {
  return items.reduce((sum, item) => (item.score === null ? sum : sum + item.score), 0);
}

type StoredItem = { questionId: string; criterionId: string; score: number | null; feedback: string; source: "MANUAL" | "AI"; aiResultId: string | null };
type DraftItem = { questionId: string; criterionId: string; score: number | null; feedback: string };

export function withProvenance(previous: StoredItem[], items: DraftItem[]): StoredItem[] {
  const byKey = new Map(previous.map((item) => [`${item.questionId}:${item.criterionId}`, item]));
  return items.map((item) => {
    const old = byKey.get(`${item.questionId}:${item.criterionId}`);
    const keepAi = old?.source === "AI" && old.score === item.score && old.feedback === item.feedback;
    return { ...item, source: keepAi ? "AI" : "MANUAL", aiResultId: keepAi ? old.aiResultId : null };
  });
}
