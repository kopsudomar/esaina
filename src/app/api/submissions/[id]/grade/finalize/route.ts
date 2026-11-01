import { prisma } from "@/lib/prisma";
import { requireTeacher, route } from "@/lib/auth/guard";
import { conflict, notFound } from "@/lib/api-error";
import { ok } from "@/lib/http";
import { sumScores, teacherSubmission } from "@/lib/grading";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_req, ctx: Ctx) => {
  const teacher = await requireTeacher();
  const { id } = await ctx.params;
  const submission = await teacherSubmission(id, teacher);
  if (submission.status !== "SUBMITTED") throw conflict("Lembar kerja belum dikumpulkan.");
  const detail = await prisma.submission.findUnique({ where: { id }, select: { assessment: { select: { questions: { select: { id: true, criteria: { select: { id: true } } } } } }, gradeRevisions: { where: { status: "DRAFT" }, orderBy: { version: "desc" }, take: 1, select: { id: true, version: true, items: { select: { criterionId: true, score: true } } } } } });
  if (!detail) throw notFound("Lembar kerja");
  const expected = detail.assessment.questions.flatMap((q) => q.criteria.map((c) => c.id));
  const draft = detail.gradeRevisions[0];
  if (!draft || draft.items.length !== expected.length || draft.items.some((i) => i.score === null) || expected.some((id) => !draft.items.some((i) => i.criterionId === id))) throw conflict("Semua kriteria harus diberi skor sebelum disahkan.");

  const finalized = await prisma.$transaction(async (tx) => {
    const revision = await tx.gradeRevision.update({ where: { id: draft.id, status: "DRAFT" }, data: { status: "FINAL", totalScore: sumScores(draft.items), approvedById: teacher.id, approvedAt: new Date() }, select: { id: true, status: true, totalScore: true, version: true } });
    await tx.auditEvent.create({ data: { actorId: teacher.id, action: "APPROVE", entityType: "GradeRevision", entityId: revision.id, versionBefore: draft.version, versionAfter: revision.version } });
    return revision;
  });
  const next = await prisma.submission.findFirst({ where: { assessmentId: submission.assessmentId, status: "SUBMITTED", id: { not: id }, gradeRevisions: { none: { status: "FINAL" } } }, orderBy: { submittedAt: "asc" }, select: { id: true } });
  return ok({ revision: finalized, nextSubmissionId: next?.id ?? null });
});
