import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTeacher, route } from "@/lib/auth/guard";
import { conflict, notFound, validationError } from "@/lib/api-error";
import { ok, readJson } from "@/lib/http";
import { sumScores, teacherSubmission, withProvenance } from "@/lib/grading";

type Ctx = { params: Promise<{ id: string }> };
const itemSchema = z.object({ questionId: z.string(), criterionId: z.string(), score: z.number().int().nullable(), feedback: z.string().max(5000).default("") });
const bodySchema = z.object({ version: z.number().int().positive(), items: z.array(itemSchema) });

export const PUT = route(async (req, ctx: Ctx) => {
  const teacher = await requireTeacher();
  const { id } = await ctx.params;
  const submission = await teacherSubmission(id, teacher);
  if (submission.status !== "SUBMITTED") throw conflict("Lembar kerja belum dikumpulkan.");
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten());
  if (parsed.data.version !== submission.version) throw conflict("Lembar kerja berubah. Muat ulang sebelum menyimpan.");

  const detail = await prisma.submission.findUnique({ where: { id }, select: { assessment: { select: { questions: { select: { id: true, maxScore: true, criteria: { select: { id: true, minScore: true, maxScore: true } } } } } } } });
  if (!detail) throw notFound("Lembar kerja");
  const criteria = new Map(detail.assessment.questions.flatMap((q) => q.criteria.map((c) => [c.id, { ...c, questionId: q.id }] as const)));
  const seen = new Set<string>();
  for (const item of parsed.data.items) {
    const criterion = criteria.get(item.criterionId);
    if (!criterion || criterion.questionId !== item.questionId || seen.has(item.criterionId)) throw validationError({ items: "Kriteria tidak valid atau duplikat." });
    seen.add(item.criterionId);
    if (item.score !== null && (item.score < criterion.minScore || item.score > criterion.maxScore)) throw validationError({ score: `Skor ${item.criterionId} di luar rentang.` });
  }
  const totalScore = sumScores(parsed.data.items);
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.gradeRevision.findFirst({ where: { submissionId: id, status: "DRAFT" }, orderBy: { version: "desc" }, select: { id: true, items: { select: { questionId: true, criterionId: true, score: true, feedback: true, source: true, aiResultId: true } } } });
    const items = withProvenance(current?.items ?? [], parsed.data.items);
    const revision = current
      ? await tx.gradeRevision.update({ where: { id: current.id }, data: { totalScore, version: { increment: 1 }, items: { deleteMany: {}, create: items } }, select: { id: true, version: true, status: true, totalScore: true } })
      : await tx.gradeRevision.create({ data: { submissionId: id, authorId: teacher.id, totalScore, items: { create: items } }, select: { id: true, version: true, status: true, totalScore: true } });
    return revision;
  });
  return ok({ revision: result });
});
