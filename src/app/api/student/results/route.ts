import { prisma } from "@/lib/prisma";
import { requireStudent, route } from "@/lib/auth/guard";
import { ok } from "@/lib/http";

export const GET = route(async () => {
  const student = await requireStudent();
  const publications = await prisma.publication.findMany({ where: { revision: { status: "FINAL", submission: { studentId: student.id } } }, orderBy: { publishedAt: "desc" }, select: { id: true, publishedAt: true, assessment: { select: { id: true, title: true } }, revision: { select: { id: true, totalScore: true, status: true, submission: { select: { id: true } } } } } });
  return ok({ results: publications.map((p) => ({ id: p.id, assessment: p.assessment, publishedAt: p.publishedAt, totalScore: p.revision.totalScore, submissionId: p.revision.submission.id })) });
});
