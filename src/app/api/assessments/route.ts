import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireClassOwner, requireTeacher, route } from "@/lib/auth/guard";
import { validationError } from "@/lib/api-error";
import { ok, readJson } from "@/lib/http";
import { createAssessmentSchema } from "@/lib/validations/assessment";

const bodySchema = z.object({ classId: z.string().min(1) }).and(createAssessmentSchema);

export const POST = route(async (req) => {
  const teacher = await requireTeacher();
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) throw validationError(parsed.error.flatten());

  const { classId, title, instruction, durationMinutes, questions } = parsed.data;
  await requireClassOwner(classId, teacher);

  const created = await prisma.assessment.create({
    data: {
      classId,
      title,
      instruction,
      durationMinutes,
      questions: {
        create: questions.map((q) => ({
          order: q.order,
          text: q.text,
          referenceAnswer: q.referenceAnswer,
          maxScore: q.maxScore,
          criteria: {
            create: q.criteria.map((c, i) => ({
              code: c.code,
              description: c.description,
              minScore: c.minScore,
              maxScore: c.maxScore,
              levels: c.levels ?? {},
              order: i + 1,
            })),
          },
        })),
      },
    },
    select: { id: true, title: true, status: true, version: true },
  });

  return ok(created, 201);
});

export const GET = route(async (req) => {
  const teacher = await requireTeacher();
  const classId = new URL(req.url).searchParams.get("classId");
  if (!classId) throw validationError({ classId: "Parameter classId wajib." });
  await requireClassOwner(classId, teacher);

  const assessments = await prisma.assessment.findMany({
    where: { classId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      version: true,
      openedAt: true,
      durationMinutes: true,
      _count: { select: { questions: true, submissions: true } },
    },
  });

  return ok({
    assessments: assessments.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      version: a.version,
      openedAt: a.openedAt,
      durationMinutes: a.durationMinutes,
      questionCount: a._count.questions,
      submissionCount: a._count.submissions,
    })),
  });
});
