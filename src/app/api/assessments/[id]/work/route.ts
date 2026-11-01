import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStudent, route } from "@/lib/auth/guard";
import { conflict, forbidden, notFound, validationError } from "@/lib/api-error";
import { ok, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };
const answerSchema = z.object({ content: z.string().max(5_000) });
const saveSchema = z.object({ version: z.number().int().positive(), answers: z.record(z.string(), z.string().max(5_000)) });

async function getDraft(id: string, studentId: string) {
  const assessment = await prisma.assessment.findFirst({
    where: { id, status: "OPEN", class: { memberships: { some: { studentId } } } },
    select: {
      id: true, title: true, instruction: true,
      durationMinutes: true, openedAt: true, closedAt: true,
      questions: {
        orderBy: { order: "asc" },
        select: { id: true, order: true, text: true, maxScore: true },
      },
    },
  });
  if (!assessment) throw notFound("Asesmen");
  const submission = await prisma.submission.upsert({
    where: { assessmentId_studentId: { assessmentId: id, studentId } },
    update: {},
    create: { assessmentId: id, studentId },
    select: { id: true, status: true, version: true, submittedAt: true, answers: { select: { questionId: true, content: true, version: true } } },
  });
  if (submission.status === "SUBMITTED") throw conflict("Pekerjaan ini sudah dikumpulkan.");
  return { assessment, submission };
}

export const GET = route(async (_req, ctx: Ctx) => {
  const student = await requireStudent();
  const { id } = await ctx.params;
  const data = await getDraft(id, student.id);
  return ok(data);
});

export const PUT = route(async (req, ctx: Ctx) => {
  const student = await requireStudent();
  const { id } = await ctx.params;
  const data = await getDraft(id, student.id);
  const parsed = saveSchema.safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten());
  if (parsed.data.version !== data.submission.version) {
    throw conflict("Draf berubah di tab lain. Muat ulang agar jawaban tidak tertimpa.");
  }

  const allowed = new Set(data.assessment.questions.map((q) => q.id));
  if (Object.keys(parsed.data.answers).some((questionId) => !allowed.has(questionId))) {
    throw forbidden();
  }

  const saved = await prisma.$transaction(async (tx) => {
    for (const [questionId, content] of Object.entries(parsed.data.answers)) {
      await tx.answer.upsert({
        where: { submissionId_questionId: { submissionId: data.submission.id, questionId } },
        update: { content, version: { increment: 1 }, savedAt: new Date() },
        create: { submissionId: data.submission.id, questionId, content },
      });
    }
    return tx.submission.update({
      where: { id: data.submission.id, version: parsed.data.version, status: "IN_PROGRESS" },
      data: { version: { increment: 1 } },
      select: { id: true, version: true, status: true },
    });
  });
  return ok({ submission: saved, savedAt: new Date().toISOString() });
});

// Body kecil untuk satu jawaban; dipakai autosave debounce.
export const PATCH = route<[Ctx]>(async (req, ctx) => {
  const student = await requireStudent();
  const { id } = await ctx.params;
  const data = await getDraft(id, student.id);
  const parsed = z.object({ version: z.number().int().positive(), questionId: z.string(), content: answerSchema.shape.content }).safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten());
  if (parsed.data.version !== data.submission.version) throw conflict("Draf berubah di tab lain. Muat ulang.");
  if (!data.assessment.questions.some((q) => q.id === parsed.data.questionId)) throw forbidden();

  const result = await prisma.$transaction(async (tx) => {
    await tx.answer.upsert({
      where: { submissionId_questionId: { submissionId: data.submission.id, questionId: parsed.data.questionId } },
      update: { content: parsed.data.content, version: { increment: 1 }, savedAt: new Date() },
      create: { submissionId: data.submission.id, questionId: parsed.data.questionId, content: parsed.data.content },
    });
    return tx.submission.update({
      where: { id: data.submission.id, version: parsed.data.version, status: "IN_PROGRESS" },
      data: { version: { increment: 1 } },
      select: { version: true },
    });
  });
  return ok({ version: result.version, savedAt: new Date().toISOString() });
});
